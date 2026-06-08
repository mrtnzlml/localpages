// Snapshot-style assertions over the rendered HTML for examples/basic.
// We don't compare byte-for-byte (CSS/script payloads are heavy and fragile);
// instead we check the structural markers a regression would notice.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createMarkdownRenderer, wrapStandaloneImages } from '../src/render.mjs';
import { renderPage } from '../src/page.mjs';
import { listDocs } from '../src/export.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE = path.resolve(HERE, '..', 'examples', 'basic');

function renderDoc(name) {
  const md = createMarkdownRenderer();
  const src = fs.readFileSync(path.join(FIXTURE, name), 'utf8');
  const body = wrapStandaloneImages(md.render(src));
  return renderPage(body, {
    title: name,
    currentFile: name,
    docs: listDocs(FIXTURE),
  });
}

test('renders index.md with all live-mode chrome', () => {
  const html = renderDoc('index.md');
  assert.match(html, /<!doctype html>/);
  assert.match(html, /<title>index\.md<\/title>/);
  assert.match(html, /class="docs-nav"/);
  // Both top-level docs appear in the nav, with index marked active.
  assert.match(html, /<li><a href="\/index\.md" class="active">index\.md<\/a><\/li>/);
  assert.match(html, /<li><a href="\/architecture\.md">architecture\.md<\/a><\/li>/);
  // Live-mode artefacts are present.
  assert.match(html, /EventSource\('\/__reload'\)/);
  assert.match(html, /href="\/__export\.zip"/);
  // Source-viewer modal markup is in place.
  assert.match(html, /id="srcOverlay"/);
});

test('alerts, anchors, and figures render', () => {
  const html = renderDoc('index.md');
  // GitHub Alerts produce markdown-alert-* wrapper classes.
  assert.match(html, /markdown-alert-note/);
  assert.match(html, /markdown-alert-warning/);
  // Anchor permalinks injected into headings.
  assert.match(html, /class="anchor"/);
  // Standalone image wrapped as <figure> with caption.
  assert.match(html, /<figure>.*<figcaption>.*<\/figcaption><\/figure>/s);
});

test('mermaid block renders as inline SVG', () => {
  const html = renderDoc('architecture.md');
  assert.match(html, /<div class="wide">.*<svg/s);
});

test('export-mode rendering omits live-only chrome and rewrites .md → .html', () => {
  const md = createMarkdownRenderer();
  const src = fs.readFileSync(path.join(FIXTURE, 'index.md'), 'utf8');
  const body = wrapStandaloneImages(md.render(src, { forExport: true }));
  const html = renderPage(body, {
    title: 'index.md',
    currentFile: 'index.md',
    forExport: true,
    docs: listDocs(FIXTURE),
  });
  assert.doesNotMatch(html, /EventSource\('\/__reload'\)/);
  assert.doesNotMatch(html, /href="\/__export\.zip"/);
  // Cross-doc .md links rewritten to .html siblings.
  assert.match(html, /href="architecture\.html"/);
  // Nav entries use relative .html paths in export mode.
  assert.match(html, /<li><a href="architecture\.html">/);
});
