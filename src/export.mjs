// Static-HTML export. Bundles a docs directory as a ZIP of self-contained HTML
// pages so the rendered documentation can be shared without running the
// preview server. Each top-level `.md` becomes a sibling `.html`; assets are
// copied verbatim; referenced source files are embedded as <template> elements
// so the source-viewer modal works offline.

import fs from 'node:fs';
import path from 'node:path';
import { wrapStandaloneImages, hljs } from './render.mjs';
import { renderPage } from './page.mjs';
import { makeZip } from './zip.mjs';
import { EXT_TO_LANG, SOURCE_EXTS } from './constants.mjs';

function escAttr(s) {
  return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// Recursively collect non-Markdown files under `dir`. Returns paths relative to
// `base`. Skips dotfiles and node_modules.
export function collectFiles(dir, base) {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.')) continue;
    if (entry.name === 'node_modules') continue;
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...collectFiles(abs, base));
    else if (entry.isFile()) out.push(path.relative(base, abs));
  }
  return out;
}

// Top-level `.md` files under `docsDir`, sorted with index.md pinned first so
// the landing page is always the leftmost tab.
export function listDocs(docsDir) {
  const names = fs.readdirSync(docsDir, { withFileTypes: true })
    .filter(d => d.isFile() && d.name.toLowerCase().endsWith('.md'))
    .map(d => d.name);
  names.sort((a, b) => {
    if (a === 'index.md') return -1;
    if (b === 'index.md') return 1;
    return a.localeCompare(b);
  });
  return names;
}

// Extract source-file hrefs from rendered HTML so they can be embedded as
// <template> elements in the static export.
function collectSourceRefs(html) {
  const hrefs = new Set();
  const re = /<a\s[^>]*href="([^"]+)"[^>]*>/g;
  let m;
  while ((m = re.exec(html)) !== null) {
    const href = m[1];
    if (/^[a-z][a-z0-9+.-]*:/i.test(href) || href.startsWith('#')) continue;
    const clean = href.split('#')[0].split('?')[0];
    const ext = path.extname(clean).toLowerCase();
    if (!SOURCE_EXTS.has(ext)) continue;
    // .md links within docs should navigate, not popup — skip unless outside.
    if (ext === '.md' && !href.includes('..')) continue;
    hrefs.add(clean);
  }
  return hrefs;
}

function highlightSourceFile(absPath) {
  const ext = path.extname(absPath).toLowerCase();
  const raw = fs.readFileSync(absPath, 'utf8');
  const lang = EXT_TO_LANG[ext];
  try {
    return lang && lang !== 'plaintext'
      ? hljs.highlight(raw, { language: lang }).value
      : hljs.highlightAuto(raw).value;
  } catch {
    return raw.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
}

// Render a single Markdown file into a self-contained HTML page.
function renderMarkdownForExport(md, mdAbsPath, sourceRoot, isBlocked, docs) {
  const src = fs.readFileSync(mdAbsPath, 'utf8');
  const body = wrapStandaloneImages(md.render(src, { forExport: true }));

  // Embed every referenced source file as a hidden <template>. The viewer
  // script reads from these instead of hitting the network.
  const refs = collectSourceRefs(body);
  let templates = '';
  for (const href of refs) {
    try {
      const decoded = decodeURIComponent(href);
      const abs = path.resolve(path.dirname(mdAbsPath), decoded);
      if (abs !== sourceRoot && !abs.startsWith(sourceRoot + path.sep)) continue;
      if (isBlocked(abs, sourceRoot)) continue;
      if (!fs.existsSync(abs) || !fs.statSync(abs).isFile()) continue;
      const ext = path.extname(abs).toLowerCase();
      if (!SOURCE_EXTS.has(ext)) continue;
      const highlighted = highlightSourceFile(abs);
      templates += `<template data-source-path="${escAttr(decoded)}">${highlighted}</template>\n`;
    } catch { /* skip unreadable files */ }
  }

  return renderPage(body, {
    title: path.basename(mdAbsPath),
    currentFile: path.basename(mdAbsPath),
    forExport: true,
    docs,
    templates,
  });
}

// Build the export ZIP. Returns { zip: Buffer, entries }.
// Renders top-level .md → .html, copies all other non-md files verbatim.
export function buildExportBundle(md, docsDir, sourceRoot, isBlocked) {
  const entries = [];
  const seen = new Set();
  const docs = listDocs(docsDir);

  for (const dirent of fs.readdirSync(docsDir, { withFileTypes: true })) {
    if (!dirent.isFile()) continue;
    if (!dirent.name.toLowerCase().endsWith('.md')) continue;
    const mdAbs = path.join(docsDir, dirent.name);
    const htmlName = dirent.name.replace(/\.md$/i, '.html');
    entries.push({
      path: htmlName,
      data: renderMarkdownForExport(md, mdAbs, sourceRoot, isBlocked, docs),
    });
    seen.add(dirent.name);
  }

  for (const rel of collectFiles(docsDir, docsDir)) {
    if (seen.has(rel)) continue;
    if (rel.toLowerCase().endsWith('.md')) continue;
    const abs = path.join(docsDir, rel);
    entries.push({ path: rel.split(path.sep).join('/'), data: fs.readFileSync(abs) });
  }

  entries.sort((a, b) => a.path.localeCompare(b.path));
  return { zip: makeZip(entries), entries };
}
