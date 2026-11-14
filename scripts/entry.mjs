// node keeps symlinks and raw spaces in process.argv[1], but a module URL is the resolved real
// path, percent-encoded, so comparing the two strings misses a run through either.
import { realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export function isMain(importMetaUrl) {
  if (!process.argv[1]) return false;
  try {
    return realpathSync(process.argv[1]) === realpathSync(fileURLToPath(importMetaUrl));
  } catch {
    return false;
  }
}
