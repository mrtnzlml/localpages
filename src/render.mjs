// MarkdownIt configuration: GitHub Alerts, anchors, mermaid fences,
// JSON5-as-JS highlighting, image figures, and link rewriting for static export.

import MarkdownIt from 'markdown-it';
import alerts from 'markdown-it-github-alerts';
import anchor from 'markdown-it-anchor';
import { renderMermaidSVG } from 'beautiful-mermaid';
import hljs from 'highlight.js';

// JSON5 fenced blocks (JSON-with-comments) are highlighted with the JS grammar
// so `//` comments render cleanly. Other tags pass through to highlight.js.
function highlight(str, lang) {
  if (!lang || lang === 'mermaid') return ''; // mermaid handled by the fence override
  const effective = lang === 'json5' ? 'javascript' : lang;
  if (hljs.getLanguage(effective)) {
    try {
      const { value } = hljs.highlight(str, { language: effective, ignoreIllegals: true });
      return `<pre><code class="hljs language-${lang}">${value}</code></pre>`;
    } catch { /* fall through */ }
  }
  return '';
}

// Highlight TODO/TBD inside Mermaid SVGs (where <mark> can't reach).
function highlightTodoInSvg(svg) {
  svg = svg.replace(
    '</style>',
    '  .todo-hl { stroke: #ffdd33; stroke-width: 7px; stroke-linejoin: round; paint-order: stroke fill; fill: #1f2328; font-weight: 700; }\n</style>',
  );
  svg = svg.replace(/(>[^<]*?)\b(TODO|TBD)\b/g, '$1<tspan class="todo-hl">$2</tspan>');
  return svg;
}

// Wrap "standalone" images — an image alone in its paragraph — in <figure> with
// the alt text as <figcaption>. Mixed paragraphs are left alone. The alt has
// already been HTML-escaped inside the <img> tag, so it's safe to drop into
// <figcaption>.
export function wrapStandaloneImages(html) {
  return html.replace(
    /<p>\s*(<img\b[^>]*?\balt="([^"]*)"[^>]*?>)\s*<\/p>/g,
    (_m, imgTag, alt) => alt
      ? `<figure>${imgTag}<figcaption>${alt}</figcaption></figure>`
      : `<figure>${imgTag}</figure>`,
  );
}

export function createMarkdownRenderer() {
  const md = new MarkdownIt({
    html: true,
    linkify: true,
    typographer: true,
    highlight,
  })
    .use(alerts)
    .use(anchor, {
      permalink: anchor.permalink.linkInsideHeader({
        symbol: '#',
        placement: 'before',
        ariaHidden: true,
        class: 'anchor',
      }),
      slugify: (s) => s.toLowerCase()
        .replace(/[^\w\s-]/g, '')
        .trim()
        .replace(/\s+/g, '-'),
    })
    // Disable the typographer "replacements" rule so technical text like "(c)",
    // "(r)", "(tm)" stays literal instead of becoming ©/®/™. Smart quotes (the
    // other half of typographer: true) remain enabled.
    .disable('replacements');

  // Render ```mermaid blocks as inline SVGs via beautiful-mermaid.
  const defaultFence = md.renderer.rules.fence.bind(md.renderer.rules);
  md.renderer.rules.fence = (tokens, idx, options, env, self) => {
    const token = tokens[idx];
    if (token.info.trim() === 'mermaid') {
      try {
        const svg = highlightTodoInSvg(renderMermaidSVG(token.content, {
          bg: '#ffffff', fg: '#1f2328', accent: '#0969da',
          muted: '#656d76', surface: '#f6f8fa', border: '#d0d7de',
        }));
        return `<div class="wide">${svg}</div>`;
      } catch (e) {
        console.error('Mermaid render error:', e.message);
      }
    }
    return defaultFence(tokens, idx, options, env, self);
  };

  // Rewrite relative `*.md` links to `*.html` for static-export rendering.
  // Invoked via md.render(src, { forExport: true }).
  const defaultLinkOpen = md.renderer.rules.link_open
    || ((tokens, idx, opts, env, self) => self.renderToken(tokens, idx, opts));
  md.renderer.rules.link_open = (tokens, idx, options, env, self) => {
    if (env && env.forExport) {
      const token = tokens[idx];
      const hrefIdx = token.attrIndex('href');
      if (hrefIdx >= 0) {
        let href = token.attrs[hrefIdx][1];
        // linkify auto-converts bare "foo.md" prose into "http://foo.md" anchors
        // (treating .md as a TLD). Detect and rewrite to a same-dir HTML
        // sibling so the bundle's in-doc references resolve.
        const bogus = href.match(/^https?:\/\/([^\/?#]+\.md)(#[^?]*)?$/i);
        if (bogus) href = bogus[1].replace(/\.md$/i, '.html') + (bogus[2] || '');
        const isScheme = /^[a-z][a-z0-9+.-]*:/i.test(href);
        const isRootAbs = href.startsWith('/');
        const isFragment = href.startsWith('#');
        if (!isScheme && !isRootAbs && !isFragment) {
          href = href.replace(/\.md(#[^?]*)?$/i, '.html$1');
        }
        if (href !== token.attrs[hrefIdx][1]) token.attrs[hrefIdx][1] = href;
      }
    }
    return defaultLinkOpen(tokens, idx, options, env, self);
  };

  return md;
}

export { hljs };
