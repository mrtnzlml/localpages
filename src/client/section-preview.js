// Section-reference hover preview.
// For same-page anchor links (href="#foo") whose target is a heading, show a
// floating card after a short hover delay. The card contains the target heading
// plus the following sibling blocks up to the next same-or-higher-level heading
// (capped by block count so very long sections don't fill the viewport). Click
// behaviour is untouched — the link still scrolls to the target; the card also
// has an explicit "Jump to section" footer.
(function() {
  var HOVER_DELAY_MS = 280;
  var HIDE_DELAY_MS  = 160;
  var MAX_BLOCKS     = 8;

  var card = null;
  var showTimer = null;
  var hideTimer = null;
  var activeLink = null;

  function ensureCard() {
    if (card) return card;
    card = document.createElement('div');
    card.className = 'section-preview markdown-body';
    card.innerHTML = '<div class="section-preview-body"><div class="section-preview-inner"></div></div>' +
                     '<a class="section-preview-jump" href="#">Jump to section ↗</a>';
    card.addEventListener('mouseenter', function() { clearTimeout(hideTimer); });
    card.addEventListener('mouseleave', scheduleHide);
    card.querySelector('.section-preview-jump').addEventListener('click', hideNow);
    document.body.appendChild(card);
    return card;
  }

  function isHeading(el) {
    return el && /^H[1-6]$/.test(el.tagName);
  }

  function collectSection(targetHeading) {
    var level = parseInt(targetHeading.tagName.slice(1), 10);
    var parts = [targetHeading.cloneNode(true)];
    var el = targetHeading.nextElementSibling;
    var n = 0;
    while (el && n < MAX_BLOCKS) {
      if (isHeading(el) && parseInt(el.tagName.slice(1), 10) <= level) break;
      parts.push(el.cloneNode(true));
      n++;
      el = el.nextElementSibling;
    }
    return parts;
  }

  function populate(c, parts, href) {
    var inner = c.querySelector('.section-preview-inner');
    inner.innerHTML = '';
    parts.forEach(function(p) {
      // Strip anchor permalinks from cloned headings so they don't render as
      // orphaned "#" marks inside the popup.
      p.querySelectorAll('.anchor').forEach(function(a) { a.remove(); });
      inner.appendChild(p);
    });
    c.querySelector('.section-preview-jump').setAttribute('href', href);
  }

  function positionCard(link, c) {
    var lr = link.getBoundingClientRect();
    var cr = c.getBoundingClientRect();
    var margin = 8;
    var vw = window.innerWidth;
    var vh = window.innerHeight;
    var left = lr.left + window.scrollX;
    var maxLeft = window.scrollX + vw - cr.width - margin;
    if (left > maxLeft) left = maxLeft;
    if (left < window.scrollX + margin) left = window.scrollX + margin;
    var below = lr.bottom + margin;
    var above = lr.top - cr.height - margin;
    var top;
    if (below + cr.height <= vh || above < 0) {
      top = lr.bottom + window.scrollY + margin;
    } else {
      top = lr.top + window.scrollY - cr.height - margin;
    }
    c.style.left = Math.round(left) + 'px';
    c.style.top  = Math.round(top) + 'px';
  }

  function showFor(link) {
    var href = link.getAttribute('href');
    if (!href || href.charAt(0) !== '#' || href.length < 2) return;
    var id;
    try { id = decodeURIComponent(href.slice(1)); } catch (e) { id = href.slice(1); }
    var target = document.getElementById(id);
    if (!isHeading(target)) return;
    var c = ensureCard();
    populate(c, collectSection(target), href);
    c.classList.add('open');
    positionCard(link, c);
  }

  function scheduleShow(link) {
    clearTimeout(showTimer);
    clearTimeout(hideTimer);
    showTimer = setTimeout(function() { showFor(link); }, HOVER_DELAY_MS);
  }
  function scheduleHide() {
    clearTimeout(showTimer);
    clearTimeout(hideTimer);
    hideTimer = setTimeout(function() {
      if (card) card.classList.remove('open');
      activeLink = null;
    }, HIDE_DELAY_MS);
  }
  function hideNow() {
    clearTimeout(showTimer);
    clearTimeout(hideTimer);
    if (card) card.classList.remove('open');
    activeLink = null;
  }

  function eligible(link) {
    if (!link) return false;
    if (link.classList.contains('anchor')) return false;
    if (link.closest('.toc')) return false;
    if (link.closest('.section-preview')) return false;
    var href = link.getAttribute('href');
    if (!href || href.charAt(0) !== '#' || href.length < 2) return false;
    var id;
    try { id = decodeURIComponent(href.slice(1)); } catch (e) { id = href.slice(1); }
    var target = document.getElementById(id);
    return isHeading(target);
  }

  var body = document.querySelector('.markdown-body');
  if (!body) return;
  body.addEventListener('mouseover', function(e) {
    var link = e.target.closest('a');
    if (!eligible(link)) return;
    if (link === activeLink) return;
    activeLink = link;
    scheduleShow(link);
  });
  body.addEventListener('mouseout', function(e) {
    var link = e.target.closest('a');
    if (!link || link !== activeLink) return;
    if (card && card.contains(e.relatedTarget)) return;
    scheduleHide();
  });
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') hideNow();
  });
  // Page scroll dismisses the card — re-positioning relative to the link while
  // the page scrolls would feel unstable. But if the pointer is currently over
  // the card, the user is likely scrolling its own contents, so leave it alone.
  window.addEventListener('scroll', function() {
    if (!card || !card.classList.contains('open')) return;
    if (card.matches(':hover')) return;
    hideNow();
  }, { passive: true });
})();
