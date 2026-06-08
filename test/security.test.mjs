// Source-root resolution + blocklist behaviour.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { makeBlocker, resolveSourceRoot, DEFAULT_BLOCKS, isInsideRoot } from '../src/security.mjs';

test('default blocklist hides secret-shaped basenames', () => {
  const isBlocked = makeBlocker();
  assert.ok(isBlocked('/r/credentials.yaml', '/r'));
  assert.ok(isBlocked('/r/credentials.json', '/r'));
  assert.ok(isBlocked('/r/.env', '/r'));
  assert.ok(isBlocked('/r/.env.production', '/r'));
  assert.ok(isBlocked('/r/.envrc', '/r'));
  assert.ok(isBlocked('/r/server.pem', '/r'));
  assert.ok(isBlocked('/r/private.key', '/r'));
  assert.ok(isBlocked('/r/id_rsa', '/r'));
  assert.ok(isBlocked('/r/id_rsa.pub', '/r'));
  assert.ok(isBlocked('/r/secrets.json', '/r'));
});

test('default blocklist allows ordinary source files', () => {
  const isBlocked = makeBlocker();
  assert.ok(!isBlocked('/r/sample.py', '/r'));
  assert.ok(!isBlocked('/r/index.md', '/r'));
  assert.ok(!isBlocked('/r/config.yaml', '/r'));
  assert.ok(!isBlocked('/r/README.md', '/r'));
});

test('extra patterns extend the blocklist', () => {
  const isBlocked = makeBlocker(['*.private', 'internal-*']);
  assert.ok(isBlocked('/r/notes.private', '/r'));
  assert.ok(isBlocked('/r/internal-spec.md', '/r'));
  assert.ok(!isBlocked('/r/notes.md', '/r'));
});

test('.git and node_modules segments are always blocked', () => {
  const isBlocked = makeBlocker();
  assert.ok(isBlocked('/r/.git/config', '/r'));
  assert.ok(isBlocked('/r/sub/.git/HEAD', '/r'));
  assert.ok(isBlocked('/r/node_modules/foo/package.json', '/r'));
});

test('isInsideRoot rejects path-traversal attempts', () => {
  const root = '/r';
  assert.ok(isInsideRoot('/r', root));
  assert.ok(isInsideRoot('/r/sub/file.md', root));
  assert.ok(!isInsideRoot('/other', root));
  assert.ok(!isInsideRoot('/r-suffix-trick', root));
});

test('DEFAULT_BLOCKS is exported and non-empty', () => {
  assert.ok(Array.isArray(DEFAULT_BLOCKS));
  assert.ok(DEFAULT_BLOCKS.length >= 5);
});

test('resolveSourceRoot honours an explicit override', () => {
  const out = resolveSourceRoot('/some/dir', '/explicit/override');
  assert.equal(out, path.resolve('/explicit/override'));
});
