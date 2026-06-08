// Source-file viewer modal. Intercepts clicks on links to repo files
// (.py, .json, etc.) and shows their content in a popup. In live mode, fetches
// from /__source; in export mode, reads from embedded
// <template data-source-path="..."> elements baked into the page.
(function() {
  var overlay = document.getElementById('srcOverlay');
  var titleEl = document.getElementById('srcTitle');
  var pathEl = document.getElementById('srcPath');
  var codeEl = document.getElementById('srcCode');
  var closeBtn = document.getElementById('srcClose');
  var copyBtn = document.getElementById('srcCopy');
  var sourceExts = /\.(py|json|ya?ml|txt|csv|xml|html|css|js|mjs|toml|sh|bash)$/i;

  var copyResetTimer = null;
  function flashCopyBtn(state, label) {
    copyBtn.classList.remove('copied', 'failed');
    copyBtn.classList.add(state);
    copyBtn.textContent = label;
    if (copyResetTimer) clearTimeout(copyResetTimer);
    copyResetTimer = setTimeout(function() {
      copyBtn.classList.remove('copied', 'failed');
      copyBtn.textContent = 'Copy';
    }, 1500);
  }
  function fallbackCopy(text) {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.top = '0';
    ta.style.left = '0';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    var ok = false;
    try { ok = document.execCommand('copy'); } catch (err) { ok = false; }
    document.body.removeChild(ta);
    flashCopyBtn(ok ? 'copied' : 'failed', ok ? 'Copied!' : 'Failed');
  }
  copyBtn.addEventListener('click', function(e) {
    e.preventDefault();
    var text = codeEl.textContent || '';
    if (!text) { flashCopyBtn('failed', 'Empty'); return; }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text)
        .then(function() { flashCopyBtn('copied', 'Copied!'); })
        .catch(function() { fallbackCopy(text); });
    } else {
      fallbackCopy(text);
    }
  });

  function isSourceLink(href) {
    if (!href) return false;
    var clean = href.split('#')[0].split('?')[0];
    if (/^[a-z][a-z0-9+.-]*:/i.test(href)) return false;
    if (sourceExts.test(clean)) return true;
    if (/\.md$/i.test(clean) && href.indexOf('..') !== -1) return true;
    return false;
  }

  function openModal(title, displayPath, rawHref) {
    titleEl.textContent = title;
    pathEl.textContent = displayPath;
    overlay.classList.add('open');
    document.body.style.overflow = 'hidden';
    var decoded = rawHref.split('#')[0].split('?')[0];
    try { decoded = decodeURIComponent(decoded); } catch(e) {}
    // Embedded template (static export) — instant, no server needed.
    var tpls = document.querySelectorAll('template[data-source-path]');
    for (var i = 0; i < tpls.length; i++) {
      if (tpls[i].dataset.sourcePath === decoded) {
        codeEl.innerHTML = tpls[i].innerHTML;
        return;
      }
    }
    // Live mode — fetch from the preview server.
    codeEl.textContent = 'Loading…';
    fetch('/__source?path=' + encodeURIComponent(decoded))
      .then(function(r) {
        if (!r.ok) throw new Error(r.status + ' ' + r.statusText);
        return r.text();
      })
      .then(function(html) { codeEl.innerHTML = html; })
      .catch(function(err) { codeEl.textContent = 'Failed to load: ' + err.message; });
  }

  function closeModal() {
    overlay.classList.remove('open');
    document.body.style.overflow = '';
    if (copyResetTimer) { clearTimeout(copyResetTimer); copyResetTimer = null; }
    copyBtn.classList.remove('copied', 'failed');
    copyBtn.textContent = 'Copy';
  }

  closeBtn.addEventListener('click', closeModal);
  overlay.addEventListener('click', function(e) { if (e.target === overlay) closeModal(); });
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape' && overlay.classList.contains('open')) closeModal();
  });

  var body = document.querySelector('.markdown-body');
  if (!body) return;
  body.addEventListener('click', function(e) {
    var link = e.target.closest('a');
    if (!link) return;
    var href = link.getAttribute('href');
    if (!isSourceLink(href)) return;
    e.preventDefault();
    var clean = href.split('#')[0].split('?')[0];
    var decoded;
    try { decoded = decodeURIComponent(clean); } catch(ex) { decoded = clean; }
    var parts = decoded.split('/');
    var filename = parts[parts.length - 1];
    var displayPath = decoded;
    while (displayPath.indexOf('../') === 0) displayPath = displayPath.slice(3);
    openModal(filename, displayPath, href);
  });

  // Mark eligible links with a visual cue.
  document.querySelectorAll('.markdown-body a').forEach(function(link) {
    if (isSourceLink(link.getAttribute('href'))) {
      link.classList.add('source-link');
      link.title = 'Click to preview file content';
    }
  });
})();
