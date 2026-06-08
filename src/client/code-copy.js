// Copy-to-clipboard buttons on every fenced code block in the rendered doc.
// Scoped to .markdown-body so the source-viewer modal's <pre> is left alone.
(function() {
  var pres = document.querySelectorAll('.markdown-body pre');
  pres.forEach(function(pre) {
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'code-copy-btn';
    btn.textContent = 'Copy';
    btn.setAttribute('aria-label', 'Copy code to clipboard');
    var resetTimer = null;
    function flash(state, label) {
      btn.classList.remove('copied', 'failed');
      btn.classList.add(state);
      btn.textContent = label;
      if (resetTimer) clearTimeout(resetTimer);
      resetTimer = setTimeout(function() {
        btn.classList.remove('copied', 'failed');
        btn.textContent = 'Copy';
      }, 1500);
    }
    btn.addEventListener('click', function(e) {
      e.preventDefault();
      var code = pre.querySelector('code');
      var text = (code || pre).textContent || '';
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text)
          .then(function() { flash('copied', 'Copied!'); })
          .catch(function() { fallbackCopy(text); });
      } else {
        fallbackCopy(text);
      }
    });
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
      flash(ok ? 'copied' : 'failed', ok ? 'Copied!' : 'Failed');
    }
    pre.appendChild(btn);
  });
})();
