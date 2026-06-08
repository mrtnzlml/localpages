# localpages

**Preview Markdown like GitHub renders it — locally, with one command.**

[![npm version](https://img.shields.io/npm/v/localpages.svg)](https://www.npmjs.com/package/localpages)
[![license](https://img.shields.io/npm/l/localpages.svg)](LICENSE)
[![Node.js >= 20](https://img.shields.io/badge/node-%3E%3D20-brightgreen.svg)](https://nodejs.org/)

<!-- TODO: hero screenshot — three-up: live preview, hover anchor card, source-file modal -->

```bash
cd path/to/your/markdown
npx localpages
```

Opens at `http://localhost:8000`. Live-reloads on save. Renders entirely in your terminal — no GitHub API, no headless Chrome, no third-party calls.

---

## Features

### Faithful GitHub rendering

The output uses [`github-markdown-css`](https://github.com/sindresorhus/github-markdown-css) (the official GitHub stylesheet) and matches what github.com displays for `README.md` files. Tables, blockquotes, task lists, fenced code blocks, footnotes, and image figures all render the same way.

### GitHub-flavored alerts

The `> [!NOTE]` syntax renders identically to github.com:

```markdown
> [!NOTE]
> Highlights useful information.

> [!WARNING]
> Critical action that the user should take.
```

Five callout types: `NOTE`, `TIP`, `IMPORTANT`, `WARNING`, `CAUTION`. Each gets a coloured rule, icon, and a subtle hue-matched background.

### Mermaid diagrams, server-side

Fenced ` ```mermaid ` blocks render to inline SVG in Node, via [`beautiful-mermaid`](https://www.npmjs.com/package/beautiful-mermaid). No headless Chrome, no client-side JavaScript, no flash of unstyled content. The same fenced blocks render natively when the Markdown is later viewed on github.com or gitlab.com.

`TODO` and `TBD` text inside diagrams gets a yellow stroke automatically — useful for marking unfinished work that should be hard to miss.

### Click-to-anchor headings

Every heading gets a GitHub-compatible slug id. Hovering reveals a `#` permalink at the left margin. Deep-link via fragments: `…/index.html#installation`.

### Sidebar table of contents

A 220 px sidebar lists every `<h2>` and `<h3>`. The active entry tracks the scroll position. Below 1280 px viewport width the sidebar hides automatically and the content column takes over.

### Hover preview for in-doc references

Hover any `[link](#anchor)` whose target is a heading and a floating card appears with a peek of that section. Click to navigate, hover-out to dismiss. Works in the static export too — all data lives in the DOM.

### Copy-to-clipboard on every code block

Hover a fenced code block and a "Copy" button appears top-right. Falls back to `document.execCommand('copy')` outside secure contexts.

### Print-quality PDF

`Cmd-P` (macOS) or `Ctrl-P` (Windows/Linux) produces a clean PDF: no nav bar, no sidebar, no modal, no copy buttons. Page-break rules keep headings with their content; tables, code blocks, figures, and Mermaid diagrams avoid mid-element splits. `<details>` is force-expanded so collapsed content makes it into the export.

### Standalone images become figures

A paragraph that contains nothing but a single image is auto-wrapped in `<figure>`, with the image's `alt` text as a `<figcaption>`. Mixed paragraphs (text + inline image) are left alone.

### Wide-content breakout

Wrap a wide table or diagram in `<div class="wide">` and it extends past the 980 px content column, up to the available viewport width. The breakout reserves space for the TOC sidebar so wide tables don't slide underneath. Mermaid blocks get wrapped automatically.

### Hot reload that doesn't break print preview

Saving a `.md` while a print dialog is open used to slam the dialog shut. `localpages` defers the reload until the dialog closes. EventSource reconnects don't trigger reloads either — only genuine server restarts (tracked by per-process ID) do.

---

## Static HTML export

```bash
npx localpages --export             # writes ./docs.zip
npx localpages --export bundle.zip  # custom output path
```

Or while the server is running, visit `http://localhost:8000/__export.zip`.

The ZIP contains:

- One `<name>.html` per top-level `.md` file in your docs directory
- Every non-Markdown asset (images, PDFs, raw source files referenced via the modal) copied verbatim
- All CSS, fonts, and JavaScript inlined per page — no external requests on open

Unzip and double-click `index.html`. No server needed. Works under `file://`, behind any web host, anywhere — even mailed as an attachment.

The ZIP is a vanilla DEFLATE-compressed archive written with `node:zlib` — no `archiver` or `jszip` dependency.

---

## Source-file viewer

Click a link to a `.py`, `.json`, `.yaml`, or other text file from inside your Markdown — instead of navigating away, a modal opens with the file's contents, syntax-highlighted. Press `Esc` or click outside to close; press the **Copy** button to put the contents on the clipboard.

This works in two modes:

- **Live preview** — the modal fetches `/__source?path=…` from the running server.
- **Static export** — referenced source files are embedded as hidden `<template>` elements in the rendered HTML, so the modal works offline too.

By default, the source root is your git repository toplevel (`git rev-parse --show-toplevel`). Override with `--source-root <path>` to widen or narrow it.

Sensitive files are blocked. The default blocklist is:

```
credentials.*  .env*  .envrc  *.pem  *.key  id_rsa*  secrets.*
```

Add to it with `--block <pattern>` (repeatable). Path-traversal protection always applies on top of the blocklist: source-viewer requests that resolve outside `--source-root` return 403.

Supported source extensions: `.py`, `.json`, `.yaml`, `.yml`, `.txt`, `.csv`, `.xml`, `.html`, `.css`, `.js`, `.mjs`, `.toml`, `.sh`, `.bash`.

---

## CLI reference

```
localpages [file] [options]
```

| Flag | Default | Description |
|---|---|---|
| `[file]` | `./index.md` (or first `.md` in cwd) | Markdown file served at `/`. Other `.md` files in the same directory are still reachable at `/<name>.md`. |
| `--port N` | `8000` | TCP port to listen on. |
| `--open` | off | Open the browser when the server is ready. |
| `--no-watch` | watch on | Disable file watching and live reload. Useful in CI. |
| `--export [path]` | — | Write a static-HTML ZIP and exit. Default output `./docs.zip`. |
| `--source-root <path>` | git toplevel | Restrict the source-file viewer to files under this directory. |
| `--block <pattern>` | (see above) | Glob to never expose via the source viewer. Repeatable. |
| `--version` | — | Print version and exit. |
| `--help` | — | Print help and exit. |

---

## Authoring notes

`localpages` is opinionated about a few details. Documenting them because the output is what you'll be reading.

### Markdown dialect

GitHub-Flavored Markdown only. **Don't use:**

- `!!! note ...` (MkDocs Material)
- `??? details ...` (collapsibles, MkDocs)
- `=== "Tab"` (tabbed content, MkDocs)
- `==highlight==` (renders as literal `==text==` on GitHub/GitLab)

**Do use:**

- `> [!NOTE]` for callouts
- `<details><summary>Click</summary>...</details>` for collapsibles
- `<mark>highlighted</mark>` for inline highlights

### JSON5 fences

Code fences tagged ` ```json5 ` are highlighted with the JavaScript grammar so `//` comments render cleanly:

````markdown
```json5
{
  "scope": "stock",     // S, D, C
  "limit": 1000         // dollar amount
}
```
````

### TODO / TBD highlights

Wrap unfinished prose in `<mark>this is TBD</mark>` for a yellow inline highlight. Inside Mermaid diagrams, the literal words `TODO` and `TBD` get a yellow stroke automatically — no markup needed.

### Standalone images get auto-captioned

```markdown
![Architecture overview of the order flow](assets/architecture.png)
```

The image becomes a `<figure>` and the alt text becomes its `<figcaption>`. Inline images mid-paragraph are untouched.

### Wide tables and diagrams

Wrap content in `<div class="wide">` to break out past the 980 px content column:

````markdown
<div class="wide">

| ID | Description | Long column 1 | Long column 2 | More |
|----|-------------|---------------|---------------|------|

</div>
````

Mermaid blocks are wrapped automatically.

---

## How it compares

| | localpages | grip | mkdocs (Material) | VitePress | markserv |
|---|---|---|---|---|---|
| Install | `npx` | `pip install` | `pip` + theme | `npm i` + scaffold | `npm i -g` |
| External API | none | github.com (rate-limited) | none | none | none |
| Live reload | yes | yes | yes | yes | yes |
| Static export | one ZIP | no | yes (site dir) | yes (site dir) | no |
| GitHub fidelity | direct (uses GitHub's CSS) | exact (uses GitHub's API) | theme-dependent | own theme | basic |
| Mermaid | server-side SVG | no | plugin | plugin | no |
| Source-file modal | yes | no | no | no | no |
| Hover anchor preview | yes | no | no | no | no |
| Print/PDF discipline | yes | basic | depends on theme | basic | no |
| Multi-page nav | top-level tabs | single page | full sidebar | full sidebar | basic |
| Search | no | no | yes (plugin) | yes | no |
| Config files | none | none | `mkdocs.yml` | `.vitepress/config.ts` | none |

`localpages` is the right tool when you have a handful of Markdown files in a project repo and want to read them rendered, share a link with a colleague, or ship a static-HTML snapshot — without inheriting an SSG's structure, themes, and config.

It's **not** the right tool when you have hundreds of pages, need full-text search, want a custom theme, or are building a public documentation site. Reach for VitePress or MkDocs for those.

---

## How it works

`localpages` is a small Node script. The dependency tree is short on purpose:

- [`markdown-it`](https://github.com/markdown-it/markdown-it) — Markdown parser
- [`markdown-it-github-alerts`](https://www.npmjs.com/package/markdown-it-github-alerts) — `> [!NOTE]` plugin
- [`markdown-it-anchor`](https://www.npmjs.com/package/markdown-it-anchor) — heading anchors
- [`github-markdown-css`](https://github.com/sindresorhus/github-markdown-css) — the official GitHub stylesheet
- [`highlight.js`](https://highlightjs.org/) — code-block syntax highlighting
- [`beautiful-mermaid`](https://www.npmjs.com/package/beautiful-mermaid) — Mermaid → SVG in Node

The HTTP server uses `node:http`. File watching uses `fs.watch({ recursive: true })` with a flat-watch fallback for older Linux. Live reload is plain Server-Sent Events. The ZIP export hand-writes the DEFLATE archive with `node:zlib` and `Buffer` — no `archiver`, no `jszip`.

That's the whole stack. There is no client-side framework — the in-page scripts (TOC scroll-spy, modal, hover card, copy buttons) are vanilla JS, inlined.

---

## Customization

`localpages` is intentionally zero-config. Theme colours, content width, fonts, and the Markdown plugin set are not exposed in `0.1.0`.

If you need to extend it, fork the repo — every feature lives in a single readable codebase. Open an issue with your use case before forking, ideally.

---

## Roadmap

- [ ] Sub-directory navigation (currently only top-level `.md` files appear in the nav bar)
- [ ] `localpages.config.mjs` for registering markdown-it plugins and theming
- [ ] Built-in client-side search across pages
- [ ] Dark-mode toggle
- [ ] Single-file bundled distribution (`curl … > localpages.mjs`) for air-gapped environments

PRs welcome on the items above. For new features outside this list, please open an issue first.

---

## FAQ

**Is this related to GitHub Pages?**
No. The name is a nod to the spirit ("a personal page, but local"). GitHub Pages is GitHub's static-site hosting service — `localpages` is unaffiliated software for previewing Markdown on your own machine.

**Why not just use `grip`?**
`grip` calls the GitHub API for every render. It's rate-limited, needs a personal access token for any real use, and won't work offline or behind corporate firewalls. `localpages` does the rendering in your terminal.

**Why a ZIP instead of a directory for `--export`?**
A single file is easier to attach to an email, drop into Slack, or hand someone over USB. Unzipping is one step on every OS. The format is a vanilla DEFLATE-compressed ZIP — `unzip`, double-click, or upload it anywhere.

**Does it support TypeScript or JSX in code fences?**
Yes — `highlight.js` ships grammars for both. Use ` ```ts `, ` ```tsx `, or ` ```jsx `.

**Does it work on Windows?**
It should. The watcher uses `fs.watch({ recursive: true })`, supported on Windows since Node 12. Open an issue if a path translation breaks.

**Can I serve a directory with hundreds of `.md` files?**
You can, but the top nav lists every file and there's no search. Reach for an SSG instead — see "How it compares".

**Does it generate a sitemap, RSS feed, or canonical URLs?**
No. It's a preview tool, not a publishing pipeline.

**My Mermaid diagram doesn't render — why?**
Run with `node …` in a terminal you can watch; rendering errors are logged to stdout. Common causes: a diagram type unsupported by `beautiful-mermaid`, a syntax error in the diagram itself, or a malformed Mermaid front-matter line.

---

## Contributing

PRs welcome on bug fixes, accessibility improvements, and the roadmap items above. For new features, open an issue first to align on scope — `localpages` aims to stay small.

```bash
git clone https://github.com/mrtnzlml/localpages.git
cd localpages
npm install
node bin/localpages.mjs examples/basic
npm test
```

Tests are `node:test` snapshots over fixtures in `examples/basic`. The whole codebase is around 2 000 lines (≈ 1 000 ESM, 400 client JS, 440 CSS, 180 tests).

---

## License

MIT — see [`LICENSE`](LICENSE).
