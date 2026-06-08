// HTML page shell. Reads CSS (theme + github-markdown + highlight.js) and
// client scripts off disk once at startup, then assembles per-request.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const SRC_DIR = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

// Resolve a node_modules asset whether the package is installed locally or
// hoisted up the tree by npm/pnpm/yarn.
function resolveAsset(specifier) {
  return require.resolve(specifier);
}

// Read once at startup. If a user upgrades a dep mid-server, restart picks it up.
const githubCss = fs.readFileSync(
  resolveAsset('github-markdown-css/github-markdown-light.css'),
  'utf8',
);
const hljsCss = fs.readFileSync(
  resolveAsset('highlight.js/styles/github.css'),
  'utf8',
);
const themeCss = fs.readFileSync(path.join(SRC_DIR, 'theme.css'), 'utf8');

const CLIENT_DIR = path.join(SRC_DIR, 'client');
const reloadJs = fs.readFileSync(path.join(CLIENT_DIR, 'reload.js'), 'utf8');
const tocJs = fs.readFileSync(path.join(CLIENT_DIR, 'toc.js'), 'utf8');
const codeCopyJs = fs.readFileSync(path.join(CLIENT_DIR, 'code-copy.js'), 'utf8');
const sourceViewerJs = fs.readFileSync(path.join(CLIENT_DIR, 'source-viewer.js'), 'utf8');
const sectionPreviewJs = fs.readFileSync(path.join(CLIENT_DIR, 'section-preview.js'), 'utf8');

// Modal markup, identical for live and export. The viewer script targets these
// IDs.
const sourceModalHtml = `
<div class="source-overlay" id="srcOverlay">
  <div class="source-modal">
    <div class="source-modal-header">
      <div class="source-modal-info">
        <div class="source-modal-title" id="srcTitle"></div>
        <div class="source-modal-path" id="srcPath"></div>
      </div>
      <button type="button" class="source-modal-copy" id="srcCopy" aria-label="Copy file content to clipboard">Copy</button>
      <button class="source-modal-close" id="srcClose">&times;</button>
    </div>
    <div class="source-modal-body">
      <pre><code id="srcCode" class="hljs"></code></pre>
    </div>
  </div>
</div>`;

export function escHtml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function buildDocsNav(docs, currentFile, forExport) {
  return docs.map(name => {
    const href = forExport ? name.replace(/\.md$/i, '.html') : `/${name}`;
    const label = escHtml(name);
    const cls = name === currentFile ? ' class="active"' : '';
    return `<li><a href="${escHtml(href)}"${cls}>${label}</a></li>`;
  }).join('');
}

// Render a complete HTML page. `body` is the rendered Markdown HTML.
//   title       — <title> contents
//   currentFile — basename of the doc being rendered (highlights the nav tab)
//   forExport   — true to omit live-only bits (SSE, download link)
//   docs        — ordered list of top-level .md filenames for the nav
//   templates   — optional <template> elements for embedded source files
export function renderPage(body, opts = {}) {
  const {
    title = 'Document',
    currentFile = '',
    forExport = false,
    docs = [],
    templates = '',
  } = opts;

  // Favicon: relative path for export (works under file:// and any web host),
  // root-absolute for the live server.
  const faviconHref = forExport ? 'favicon.svg' : '/favicon.svg';
  const docsNavHtml = buildDocsNav(docs, currentFile, forExport);
  const reloadScript = forExport ? '' : `<script>${reloadJs}</script>`;
  const downloadLink = forExport
    ? ''
    : `<a class="export-link" href="/__export.zip" download title="Download this documentation as a static HTML ZIP">Download ZIP</a>`;

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escHtml(title)}</title>
  <link rel="icon" type="image/svg+xml" href="${faviconHref}">
  <style>${githubCss}</style>
  <style>${hljsCss}</style>
  <style>${themeCss}</style>
</head>
<body>
  <nav class="docs-nav">
    <ul class="docs-nav-list">${docsNavHtml}</ul>
    ${downloadLink}
  </nav>
  <main class="markdown-body">
${body}
  </main>
${reloadScript}
<script>${tocJs}</script>
<script>${codeCopyJs}</script>
${templates}
${sourceModalHtml}
<script>${sourceViewerJs}</script>
<script>${sectionPreviewJs}</script>
</body>
</html>`;
}
