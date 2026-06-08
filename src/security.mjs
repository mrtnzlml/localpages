// Source-file viewer security: where the viewer is allowed to look, and which
// files are off-limits inside that scope.

import { execSync } from 'node:child_process';
import path from 'node:path';

export const DEFAULT_BLOCKS = [
  'credentials.*',
  '.env*',
  '.envrc',
  '*.pem',
  '*.key',
  'id_rsa*',
  'secrets.*',
];

// Resolve the viewer's outer boundary. Tries git toplevel of `docsDir`, falls
// back to `docsDir` when not in a git repo or git isn't installed.
export function resolveSourceRoot(docsDir, override) {
  if (override) return path.resolve(override);
  try {
    const out = execSync('git rev-parse --show-toplevel', {
      cwd: docsDir,
      stdio: ['ignore', 'pipe', 'ignore'],
    }).toString().trim();
    if (out) return out;
  } catch {
    // not a git repo, or git missing — fall through
  }
  return docsDir;
}

// Compile a basename glob to a regex. * matches any chars, ? matches one.
function globToRegex(pattern) {
  const re = pattern
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*/g, '.*')
    .replace(/\?/g, '.');
  return new RegExp(`^${re}$`, 'i');
}

// Returns isBlocked(absPath, root) — true if the file is unsafe to expose.
// Always blocks `.git/` and `node_modules/` at any depth (security-critical,
// not configurable). Then matches the basename against the configured globs.
export function makeBlocker(extraPatterns = []) {
  const patterns = [...DEFAULT_BLOCKS, ...extraPatterns];
  const regexes = patterns.map(globToRegex);
  return function isBlocked(absPath, root) {
    if (root) {
      const rel = path.relative(root, absPath);
      const segments = rel.split(path.sep);
      if (segments.some(s => s === '.git' || s === 'node_modules')) return true;
    }
    const basename = path.basename(absPath);
    return regexes.some(r => r.test(basename));
  };
}

// String-safe path-traversal check.
export function isInsideRoot(absPath, root) {
  return absPath === root || absPath.startsWith(root + path.sep);
}
