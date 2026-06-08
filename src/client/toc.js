// Build a minimalistic TOC from h2/h3 headings that have id attributes.
(function() {
  var headings = document.querySelectorAll('.markdown-body h2[id], .markdown-body h3[id]');
  if (!headings.length) return;
  var nav = document.createElement('nav');
  nav.className = 'toc';
  headings.forEach(function(h) {
    var a = document.createElement('a');
    a.href = '#' + h.id;
    // Strip the leading '#' anchor symbol injected by markdown-it-anchor
    a.textContent = h.textContent.replace(/^#\s*/, '');
    a.title = a.textContent;
    a.className = 'toc-' + h.tagName.toLowerCase();
    nav.appendChild(a);
  });
  document.body.prepend(nav);

  // Chrome aborts an opening print preview if the page touches history or
  // scrolls programmatically while the dialog is setting up. Cmd+P's print
  // reflow (TOC hidden, padding shrunk) fires a scroll event — without this
  // guard, the resulting updateActive() → history.replaceState() would slam
  // the preview dialog shut the instant it appears.
  var isPrinting = false;
  window.addEventListener('beforeprint', function() { isPrinting = true; });
  window.addEventListener('afterprint', function() { isPrinting = false; });

  // Scroll spy — find the last heading scrolled past the viewport top.
  var links = nav.querySelectorAll('a');
  function updateActive() {
    if (isPrinting || (window.matchMedia && window.matchMedia('print').matches)) return;
    var scrollY = window.scrollY;
    var current = null;
    headings.forEach(function(h) {
      if (h.getBoundingClientRect().top + scrollY - 80 <= scrollY) {
        current = h;
      }
    });
    links.forEach(function(l) { l.classList.remove('active'); });
    if (current) {
      var hit = nav.querySelector('a[href="#' + CSS.escape(current.id) + '"]');
      if (hit) {
        hit.classList.add('active');
        hit.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        var wanted = '#' + current.id;
        if (location.hash !== wanted) history.replaceState(null, '', wanted);
      }
    }
  }
  document.addEventListener('scroll', updateActive, { passive: true });
  updateActive();
})();
