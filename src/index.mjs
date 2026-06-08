// CLI entry point: parses argv, resolves the target file, sets up source-viewer
// security, and either runs `--export` or starts the server.

import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createMarkdownRenderer } from './render.mjs';
import { startServer } from './server.mjs';
import { buildExportBundle } from './export.mjs';
import { resolveSourceRoot, makeBlocker, DEFAULT_BLOCKS } from './security.mjs';

const HELP = `localpages — Local Markdown preview and static export.

Usage:
  localpages [file] [options]

Arguments:
  file                       Markdown file to serve at /. Defaults to ./index.md
                             (or first .md found in cwd).

Options:
  --port N                   TCP port (default 8000).
  --open                     Open the browser when ready.
  --no-watch                 Disable file watching and live reload.
  --export [path]            Write a static-HTML ZIP and exit.
                             Default output: ./docs.zip
  --source-root <path>       Restrict the source-file viewer to this directory.
                             Default: git toplevel of the served file, else its
                             directory.
  --block <pattern>          Glob (basename) to never expose via the source
                             viewer. Repeatable. Default blocklist:
                             ${DEFAULT_BLOCKS.join(' ')}
  --version, -v              Print version and exit.
  --help, -h                 Print this help and exit.

Examples:
  localpages                              # serve ./index.md on :8000
  localpages docs/architecture.md         # serve a specific file
  localpages --port 9000 --open
  localpages --export bundle.zip
`;

function parseArgs(argv) {
  const opts = {
    port: 8000,
    open: false,
    watch: true,
    export: false,
    exportOut: 'docs.zip',
    sourceRoot: null,
    blocks: [],
    version: false,
    help: false,
    file: null,
  };
  const positional = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--help' || a === '-h') opts.help = true;
    else if (a === '--version' || a === '-v') opts.version = true;
    else if (a === '--open') opts.open = true;
    else if (a === '--no-watch') opts.watch = false;
    else if (a === '--port') opts.port = Number.parseInt(argv[++i], 10);
    else if (a.startsWith('--port=')) opts.port = Number.parseInt(a.slice(7), 10);
    else if (a === '--export') {
      opts.export = true;
      const next = argv[i + 1];
      if (next && !next.startsWith('-')) { opts.exportOut = next; i++; }
    }
    else if (a.startsWith('--export=')) { opts.export = true; opts.exportOut = a.slice(9); }
    else if (a === '--source-root') opts.sourceRoot = argv[++i];
    else if (a.startsWith('--source-root=')) opts.sourceRoot = a.slice('--source-root='.length);
    else if (a === '--block') opts.blocks.push(argv[++i]);
    else if (a.startsWith('--block=')) opts.blocks.push(a.slice('--block='.length));
    else if (a.startsWith('-')) {
      console.error(`Unknown option: ${a}`);
      process.exit(2);
    } else {
      positional.push(a);
    }
  }
  if (positional[0]) opts.file = positional[0];
  // Back-compat: 2nd positional = port (matches the old preview.mjs CLI).
  if (positional[1] && /^\d+$/.test(positional[1])) {
    opts.port = Number.parseInt(positional[1], 10);
  }
  return opts;
}

// Resolve the target file. Directory or empty input → index.md, else first
// alphabetical .md, else null.
function resolveFile(input) {
  let target = input ? path.resolve(input) : process.cwd();
  if (fs.existsSync(target) && fs.statSync(target).isDirectory()) {
    const indexMd = path.join(target, 'index.md');
    if (fs.existsSync(indexMd)) return indexMd;
    const mds = fs.readdirSync(target)
      .filter(n => n.toLowerCase().endsWith('.md'))
      .sort();
    if (mds.length) return path.join(target, mds[0]);
    return null;
  }
  return target;
}

function openBrowser(url) {
  const cmd = process.platform === 'darwin' ? 'open'
    : process.platform === 'win32' ? 'cmd'
    : 'xdg-open';
  const args = process.platform === 'win32' ? ['/c', 'start', '""', url] : [url];
  try {
    spawn(cmd, args, { detached: true, stdio: 'ignore' }).unref();
  } catch {
    // Best-effort only — never fail the server because we couldn't open a browser.
  }
}

function readVersion() {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const pkgPath = path.resolve(here, '..', 'package.json');
  return JSON.parse(fs.readFileSync(pkgPath, 'utf8')).version;
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));

  if (opts.help) { console.log(HELP); process.exit(0); }
  if (opts.version) { console.log(readVersion()); process.exit(0); }

  const file = resolveFile(opts.file);
  if (!opts.export && !file) {
    console.error('No Markdown file found. Pass a path or run from a directory containing .md files.');
    process.exit(1);
  }
  if (!opts.export && !fs.existsSync(file)) {
    console.error(`File not found: ${file}`);
    process.exit(1);
  }

  // For --export without a file, fall back to cwd as the docs directory.
  const docsDir = file ? path.dirname(file) : process.cwd();
  const sourceRoot = resolveSourceRoot(docsDir, opts.sourceRoot);
  const isBlocked = makeBlocker(opts.blocks);
  const md = createMarkdownRenderer();

  if (opts.export) {
    const { zip, entries } = buildExportBundle(md, docsDir, sourceRoot, isBlocked);
    const outPath = path.resolve(opts.exportOut);
    fs.writeFileSync(outPath, zip);
    const htmlCount = entries.filter(e => e.path.endsWith('.html')).length;
    const assetCount = entries.length - htmlCount;
    const rel = path.relative(process.cwd(), outPath) || outPath;
    console.log(`Exported ${entries.length} files (${htmlCount} HTML, ${assetCount} assets) → ${rel}  (${(zip.length / 1024).toFixed(1)} KiB)`);
    process.exit(0);
  }

  await startServer({
    md, file, docsDir, port: opts.port,
    sourceRoot, isBlocked, watch: opts.watch,
  });

  if (opts.open) {
    openBrowser(`http://localhost:${opts.port}`);
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
