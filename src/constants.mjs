// Map file extensions to highlight.js language identifiers.
export const EXT_TO_LANG = {
  '.py': 'python', '.json': 'json', '.yaml': 'yaml', '.yml': 'yaml',
  '.js': 'javascript', '.mjs': 'javascript', '.html': 'xml', '.xml': 'xml',
  '.css': 'css', '.sh': 'bash', '.bash': 'bash', '.toml': 'ini',
  '.md': 'markdown', '.txt': 'plaintext', '.csv': 'plaintext',
};

// Text file extensions the source-file viewer modal can display.
export const SOURCE_EXTS = new Set([
  '.py', '.json', '.yaml', '.yml', '.txt', '.md', '.csv', '.xml',
  '.html', '.css', '.js', '.mjs', '.toml', '.sh', '.bash',
]);

// MIME types served by the static-file route.
export const MIME = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.gif': 'image/gif', '.webp': 'image/webp', '.svg': 'image/svg+xml',
  '.css': 'text/css', '.js': 'application/javascript', '.mjs': 'application/javascript',
  '.txt': 'text/plain; charset=utf-8',
  '.pdf': 'application/pdf',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.zip': 'application/zip',
};
