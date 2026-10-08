// Driver version is read from the repo's package.json at runtime so there's
// a single source of truth. The module dir resolves to build/lib at runtime (compiled),
// so the repo root is two levels up. Falls back to "unknown" if the read fails —
// version stamping is cosmetic and shouldn't block session creation.
import {readFileSync} from 'node:fs';
import {dirname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

export const DRIVER_VERSION: string = (() => {
  try {
    const pkgPath = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', 'package.json');
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf8')) as {version?: string};
    return pkg.version ?? 'unknown';
  } catch {
    return 'unknown';
  }
})();
