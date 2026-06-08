// HTTP server: serves rendered Markdown, static assets, the source-viewer
// endpoint, the export ZIP, and a Server-Sent Events stream for live reload.

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import hljs from 'highlight.js';
import { wrapStandaloneImages } from './render.mjs';
import { renderPage, escHtml } from './page.mjs';
import { listDocs, buildExportBundle } from './export.mjs';
import { EXT_TO_LANG, SOURCE_EXTS, MIME } from './constants.mjs';

const tty = process.stdout.isTTY;
const C = {
  dim: tty ? '\x1b[2m' : '', bold: tty ? '\x1b[1m' : '',
  green: tty ? '\x1b[32m' : '', yellow: tty ? '\x1b[33m' : '',
  red: tty ? '\x1b[31m' : '', cyan: tty ? '\x1b[36m' : '',
  reset: tty ? '\x1b[0m' : '',
};
function ts() {
  const d = new Date();
  return [d.getHours(), d.getMinutes(), d.getSeconds()]
    .map(n => String(n).padStart(2, '0')).join(':');
}
function log(msg) { console.log(`${C.dim}${ts()}${C.reset} ${msg}`); }
function statusStyle(code) {
  if (code < 300) return C.green;
  if (code < 500) return C.yellow;
  return C.red;
}

export function startServer({ md, file, docsDir, port, sourceRoot, isBlocked, watch = true }) {
  // Per-process ID emitted with every SSE `hello` so clients can tell a real
  // server restart (new ID) apart from a transient EventSource reconnect (same
  // ID) and only reload on the former.
  const SERVER_ID = `${process.pid}.${Date.now()}`;
  const sseClients = new Set();

  // Export ZIP filename derives from the docs directory's basename so a `--export`
  // download names itself something users recognise.
  const dirBase = path.basename(docsDir);
  const exportName = dirBase && dirBase !== '/' ? `${dirBase}.zip` : 'docs.zip';

  const server = http.createServer((req, res) => {
    const reqStart = Date.now();
    let logExtra = '';
    let url;
    try {
      url = decodeURIComponent((req.url || '/').split('?')[0]);
    } catch {
      // Malformed percent-escape — don't let URIError crash the process.
      res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Bad Request');
      return;
    }

    res.on('finish', () => {
      if (url === '/__reload') return; // SSE logged separately
      const ms = Date.now() - reqStart;
      const sc = statusStyle(res.statusCode);
      log(`${sc}${res.statusCode}${C.reset} ${req.method} ${url}${logExtra} ${C.dim}${ms}ms${C.reset}`);
    });

    // Downloadable static-HTML bundle of the whole docs tree.
    if (url === '/__export.zip') {
      try {
        const { zip } = buildExportBundle(md, docsDir, sourceRoot, isBlocked);
        logExtra = ` ${C.dim}${(zip.length / 1024).toFixed(1)} KiB${C.reset}`;
        res.writeHead(200, {
          'Content-Type': 'application/zip',
          'Content-Disposition': `attachment; filename="${exportName}"`,
          'Content-Length': zip.length,
          'Cache-Control': 'no-store',
        });
        res.end(zip);
      } catch (e) {
        console.error('Export failed:', e);
        res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end(`Export failed: ${e.message}`);
      }
      return;
    }

    // Source-file viewer endpoint. Resolves paths relative to docsDir, scoped
    // to sourceRoot, with the configured blocklist applied.
    if (url === '/__source') {
      try {
        const reqUrl = new URL(req.url, 'http://localhost');
        const filePath = reqUrl.searchParams.get('path');
        if (!filePath) {
          res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
          res.end('Missing path parameter');
          return;
        }
        const abs = path.resolve(docsDir, filePath);
        if (abs !== sourceRoot && !abs.startsWith(sourceRoot + path.sep)) {
          res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
          res.end('Forbidden');
          return;
        }
        if (isBlocked(abs, sourceRoot)) {
          res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
          res.end('Forbidden');
          return;
        }
        const ext = path.extname(abs).toLowerCase();
        if (!SOURCE_EXTS.has(ext)) {
          res.writeHead(415, { 'Content-Type': 'text/plain; charset=utf-8' });
          res.end('Not a viewable source file');
          return;
        }
        if (!fs.existsSync(abs) || !fs.statSync(abs).isFile()) {
          res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
          res.end('File not found');
          return;
        }
        logExtra = ` ${C.dim}→${C.reset} ${path.basename(abs)}`;
        const raw = fs.readFileSync(abs, 'utf8');
        const lang = EXT_TO_LANG[ext];
        let highlighted;
        try {
          highlighted = lang && lang !== 'plaintext'
            ? hljs.highlight(raw, { language: lang }).value
            : hljs.highlightAuto(raw).value;
        } catch {
          highlighted = raw.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        }
        res.writeHead(200, {
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'no-store',
        });
        res.end(highlighted);
      } catch {
        res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('Internal error');
      }
      return;
    }

    // Live-reload SSE stream.
    if (url === '/__reload') {
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      });
      res.write(`event: hello\ndata: ${SERVER_ID}\n\n`);
      sseClients.add(res);
      log(`${C.cyan}SSE${C.reset} ${C.dim}+client (${sseClients.size} total)${C.reset}`);
      req.on('close', () => {
        sseClients.delete(res);
        log(`${C.cyan}SSE${C.reset} ${C.dim}-client (${sseClients.size} total)${C.reset}`);
      });
      return;
    }

    // Markdown route: render the CLI-selected FILE at `/`, and any other `.md`
    // under DOCS_DIR at its own path. This makes in-doc links like
    // `[...](./other.md)` resolve in live preview.
    const mdAbs = (() => {
      if (url === '/') return file;
      if (!url.toLowerCase().endsWith('.md')) return null;
      const abs = path.resolve(docsDir, url.replace(/^\/+/, ''));
      if (abs !== docsDir && !abs.startsWith(docsDir + path.sep)) return null;
      return (fs.existsSync(abs) && fs.statSync(abs).isFile()) ? abs : null;
    })();
    if (mdAbs) {
      let body;
      try { body = wrapStandaloneImages(md.render(fs.readFileSync(mdAbs, 'utf8'))); }
      catch (e) { res.writeHead(500); res.end(String(e)); return; }
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(renderPage(body, {
        title: path.basename(mdAbs),
        currentFile: path.basename(mdAbs),
        docs: listDocs(docsDir),
      }));
      return;
    }

    // Static file under docsDir.
    const requested = path.resolve(docsDir, url.replace(/^\/+/, ''));
    if (requested !== docsDir && !requested.startsWith(docsDir + path.sep)) {
      res.writeHead(403); res.end('Forbidden'); return;
    }
    if (fs.existsSync(requested) && fs.statSync(requested).isFile()) {
      const mime = MIME[path.extname(requested).toLowerCase()] || 'application/octet-stream';
      res.writeHead(200, { 'Content-Type': mime });
      fs.createReadStream(requested).pipe(res);
      return;
    }

    // 404 — list every available top-level `.md` and link back to the index.
    const docList = listDocs(docsDir)
      .map(name => `<li><a href="/${escHtml(name)}">${escHtml(name)}</a></li>`)
      .join('');
    const indexName = path.basename(file);
    const body404 = `<h1>404 &mdash; Not Found</h1>
<p>No file matches <code>${escHtml(url)}</code>.</p>
<h2>Available documents</h2>
<ul>${docList}</ul>
<p><a href="/">&larr; Back to <code>${escHtml(indexName)}</code></a></p>`;
    res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(renderPage(body404, {
      title: '404 — Not Found',
      currentFile: '__404__',
      docs: listDocs(docsDir),
    }));
  });

  if (watch) {
    let broadcastTimer;
    function broadcastChange() {
      for (const client of [...sseClients]) {
        try { client.write('event: change\ndata: \n\n'); }
        catch { sseClients.delete(client); }
      }
    }
    function onFsChange(_event, filename) {
      if (!filename || !filename.toString().toLowerCase().endsWith('.md')) return;
      // Debounced because macOS emits multiple events per save.
      clearTimeout(broadcastTimer);
      broadcastTimer = setTimeout(() => {
        if (sseClients.size) {
          log(`${C.cyan} Δ ${C.reset} ${filename} ${C.dim}→ ${sseClients.size} client(s)${C.reset}`);
        }
        broadcastChange();
      }, 50);
    }
    try {
      fs.watch(docsDir, { recursive: true }, onFsChange);
    } catch (e) {
      // Recursive watching needs macOS, Windows, or Linux 6.13+. Fall back to a
      // top-level watch on older Linux.
      if (e.code === 'ERR_FEATURE_UNAVAILABLE_ON_PLATFORM') {
        console.warn('Recursive watch unavailable on this platform — falling back to top-level watch.');
        fs.watch(docsDir, onFsChange);
      } else throw e;
    }
  }

  return new Promise((resolve, reject) => {
    server.on('error', reject);
    server.listen(port, () => {
      console.log(`Serving ${path.relative(process.cwd(), file)} at http://localhost:${port}  (Ctrl+C to stop)`);
      resolve(server);
    });
  });
}
