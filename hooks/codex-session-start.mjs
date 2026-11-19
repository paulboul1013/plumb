import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { isMain } from '../scripts/entry.mjs';
import { record } from './stop-gate.mjs';

if (isMain(import.meta.url)) {
  if (process.env.PLUMB_HOOK === 'off') process.exit(0);
  let input;
  try { input = JSON.parse(readFileSync(0, 'utf8')); } catch { process.exit(0); }
  try { record(input.cwd ?? process.cwd(), input.session_id, input.source); } catch {
    // A baseline failure must not prevent the router from loading.
  }

  const context = readFileSync(new URL('./session-start-context.md', import.meta.url), 'utf8').trim();
  const root = fileURLToPath(new URL('../', import.meta.url));
  const paths = `Plumb is installed at ${JSON.stringify(root)}. Use this absolute path in Plumb shell commands when PLUGIN_ROOT is unset. Read skills/plumb/CODEX.md under this root for Codex-specific workflow instructions.`;
  process.stdout.write(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'SessionStart',
      additionalContext: `${context}\n\n${paths}`,
    },
  }) + '\n');
}
