// Split a shell command line into the simple commands it runs, each as an argv array.
// Quoted text and heredoc bodies stay data, so a guard sees only what the shell would execute.
// Command substitutions and `sh -c` strings run too, so their commands are listed too.
const OPERATORS = new Set([';', '&', '|', '(', ')', '\n']);
const SHELLS = new Set(['sh', 'bash', 'zsh', 'dash']);

export function commands(line) {
  const out = [];
  let argv = [];
  let word = null;
  let heredocs = [];
  let redirectTarget = false;
  let i = 0;
  const endWord = () => {
    if (word !== null && !redirectTarget) argv.push(word);
    if (word !== null) redirectTarget = false;
    word = null;
  };
  const endCommand = () => {
    endWord();
    if (argv.length) {
      out.push(argv);
      const shellString = SHELLS.has(argv[0]) && argv.indexOf('-c') > 0 ? argv[argv.indexOf('-c') + 1] : null;
      if (shellString) out.push(...commands(shellString));
      if (argv[0] === 'eval') out.push(...commands(argv.slice(1).join(' ')));
    }
    argv = [];
    redirectTarget = false;
  };
  // Read `$( ... )` or a backtick span starting at `start`, return its inner text and the index after it.
  const substitution = (start) => {
    if (line[start] === '`') {
      const end = line.indexOf('`', start + 1);
      const stop = end < 0 ? line.length : end;
      return [line.slice(start + 1, stop), stop + 1];
    }
    let depth = 1;
    let j = start + 2;
    let quote = null;
    while (j < line.length && depth) {
      const c = line[j];
      if (quote) { if (c === quote) quote = null; else if (c === '\\' && quote === '"') j++; }
      else if (c === "'" || c === '"') quote = c;
      else if (c === '\\') j++;
      else if (c === '(') depth++;
      else if (c === ')') depth--;
      j++;
    }
    return [line.slice(start + 2, depth ? j : j - 1), j];
  };
  const runSubstitution = (start) => {
    const [inner, next] = substitution(start);
    out.push(...commands(inner));
    return next;
  };
  // Skip heredoc bodies that start after the newline at `i`.
  const skipHeredocs = () => {
    for (const { tag, strip } of heredocs) {
      while (i < line.length) {
        const eol = line.indexOf('\n', i);
        const end = eol < 0 ? line.length : eol;
        const text = line.slice(i, end);
        i = end + 1;
        if ((strip ? text.replace(/^\t+/, '') : text) === tag) break;
      }
    }
    heredocs = [];
  };

  while (i < line.length) {
    const c = line[i];
    if (c === '\\') {
      if (line[i + 1] === '\n') { i += 2; continue; }
      word = (word ?? '') + (line[i + 1] ?? '');
      i += 2;
      continue;
    }
    if (c === "'") {
      const end = line.indexOf("'", i + 1);
      const stop = end < 0 ? line.length : end;
      word = (word ?? '') + line.slice(i + 1, stop);
      i = stop + 1;
      continue;
    }
    if (c === '"') {
      word = word ?? '';
      i++;
      while (i < line.length && line[i] !== '"') {
        if (line[i] === '\\' && i + 1 < line.length) { word += line[i + 1]; i += 2; }
        else if (line.startsWith('$(', i) || line[i] === '`') i = runSubstitution(i);
        else word += line[i++];
      }
      i++;
      continue;
    }
    if (line.startsWith('$(', i) || c === '`') {
      i = runSubstitution(i);
      continue;
    }
    if (c === '#' && word === null) {
      while (i < line.length && line[i] !== '\n') i++;
      continue;
    }
    if (line.startsWith('<<', i) && !line.startsWith('<<<', i)) {
      endWord();
      const m = /^<<(-?)\s*(['"]?)([\w.-]+)\2/.exec(line.slice(i));
      if (m) {
        heredocs.push({ tag: m[3], strip: m[1] === '-' });
        i += m[0].length;
        continue;
      }
    }
    if (OPERATORS.has(c)) {
      endCommand();
      i++;
      if (c === '\n') skipHeredocs();
      continue;
    }
    if (c === '<' || c === '>') {
      // A redirect: drop a file-descriptor number before it and the target after it.
      if (word !== null && /^\d+$/.test(word)) word = null;
      endWord();
      i++;
      while ('<>&|'.includes(line[i] ?? ' ') && i < line.length) i++;
      redirectTarget = true;
      continue;
    }
    if (c === ' ' || c === '\t') {
      endWord();
      i++;
      continue;
    }
    word = (word ?? '') + c;
    i++;
  }
  endCommand();
  return out;
}

const RESERVED = new Set(['{', '}', '!', 'if', 'then', 'elif', 'else', 'fi', 'do', 'done', 'while', 'until']);
// Wrappers that run the rest of the argv as a command, each with the options that take a separate value.
const WRAPPERS = {
  env: ['-u', '-C', '-S'],
  sudo: ['-u', '-g', '-h', '-p', '-C', '-U', '-r', '-t'],
  doas: ['-u', '-C'],
  command: [],
  builtin: [],
  exec: ['-a'],
  nohup: [],
  time: ['-f', '-o'],
  nice: ['-n'],
  ionice: ['-c', '-n', '-p'],
  timeout: ['-s', '-k'],
  xargs: ['-n', '-I', '-L', '-P', '-d', '-E', '-s', '-a'],
  stdbuf: ['-i', '-o', '-e'],
};
const basename = (word) => word.replace(/^.*\//, '');

// Drop leading reserved words, `NAME=value` assignments, and wrappers such as `sudo` or `timeout 60`,
// so argv[0] is the program that runs, by its basename.
export function program(argv) {
  let k = 0;
  while (k < argv.length) {
    if (RESERVED.has(argv[k]) || /^[A-Za-z_][A-Za-z0-9_]*=/.test(argv[k])) { k++; continue; }
    const valueOptions = WRAPPERS[basename(argv[k])];
    if (!valueOptions) break;
    const wrapper = basename(argv[k++]);
    while (k < argv.length && argv[k].startsWith('-')) k += valueOptions.includes(argv[k]) ? 2 : 1;
    if (wrapper === 'timeout' && k < argv.length) k++;
  }
  const rest = argv.slice(k);
  return rest.length ? [basename(rest[0]), ...rest.slice(1)] : rest;
}

const GIT_OPTIONS_WITH_VALUE = new Set(['-C', '-c', '--git-dir', '--work-tree', '--namespace', '--config-env', '--super-prefix']);

// For a git argv, return [subcommand, ...its args] after git's global options, or null if it is not git.
export function gitSubcommand(argv) {
  const a = program(argv);
  if (a[0] !== 'git') return null;
  let k = 1;
  while (k < a.length && a[k].startsWith('-')) k += GIT_OPTIONS_WITH_VALUE.has(a[k]) ? 2 : 1;
  return k < a.length ? a.slice(k) : null;
}
