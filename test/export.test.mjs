// Smoke test for the static-HTML export bundle.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createMarkdownRenderer } from '../src/render.mjs';
import { buildExportBundle } from '../src/export.mjs';
import { resolveSourceRoot, makeBlocker } from '../src/security.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE = path.resolve(HERE, '..', 'examples', 'basic');

test('export bundle contains rendered HTML, copied assets, and a valid ZIP', () => {
  const md = createMarkdownRenderer();
  const sourceRoot = resolveSourceRoot(FIXTURE);
  const isBlocked = makeBlocker();
  const { zip, entries } = buildExportBundle(md, FIXTURE, sourceRoot, isBlocked);

  // ZIP magic.
  assert.equal(zip.slice(0, 4).toString('hex'), '504b0304');

  const paths = entries.map(e => e.path);
  // Each top-level .md becomes a sibling .html.
  assert.ok(paths.includes('index.html'), `expected index.html, got ${paths}`);
  assert.ok(paths.includes('architecture.html'));
  // Non-.md files are copied verbatim.
  assert.ok(paths.includes('sample.py'));
  assert.ok(paths.includes('assets/diagram.svg'));
  // No raw .md files in the bundle.
  assert.ok(!paths.some(p => p.endsWith('.md')));

  // Embedded source <template> for sample.py is present in HTML pages that
  // reference it.
  const indexHtml = entries.find(e => e.path === 'index.html').data;
  assert.match(indexHtml, /<template data-source-path="sample\.py">/);
  // Source viewer script is inlined.
  assert.match(indexHtml, /id="srcOverlay"/);
});

test('a .md link with no `..` becomes a .html link in export', () => {
  const md = createMarkdownRenderer();
  const sourceRoot = resolveSourceRoot(FIXTURE);
  const { entries } = buildExportBundle(md, FIXTURE, sourceRoot, makeBlocker());
  const html = entries.find(e => e.path === 'index.html').data;
  assert.match(html, /href="architecture\.html"/);
  assert.doesNotMatch(html, /href="architecture\.md"/);
});
