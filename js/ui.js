// Alpha Oficial — UI: Mobile menu + Products toggle + Footer mobile accordion
(function () {
  'use strict';

  var MENU_ICON = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-menu w-6 h-6"><line x1="4" x2="20" y1="12" y2="12"/><line x1="4" x2="20" y1="6" y2="6"/><line x1="4" x2="20" y1="18" y2="18"/></svg>';
  var CLOSE_ICON = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-x w-6 h-6"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>';

  // ── 0. Mobile hamburger menu ───────────────────────────────────────────────
  function initMobileMenu() {
    var btn = document.getElementById('alpha-menu-btn');
    var nav = document.getElementById('alpha-mobile-nav');
    if (!btn || !nav) return;

    var isOpen = false;

    function open() {
      isOpen = true;
      btn.innerHTML = CLOSE_ICON;
      nav.style.maxHeight = nav.scrollHeight + 'px';
      nav.style.opacity = '1';
    }

    function close() {
      isOpen = false;
      btn.innerHTML = MENU_ICON;
      nav.style.maxHeight = '0';
      nav.style.opacity = '0';
    }

    btn.addEventListener('click', function () {
      isOpen ? close() : open();
    });

    // Close menu when clicking a nav link
    nav.querySelectorAll('a').forEach(function (a) {
      a.addEventListener('click', close);
    });

    // Close on resize to desktop
    window.addEventListener('resize', function () {
      if (window.innerWidth >= 768 && isOpen) close();
    });
  }

  // ── 1. Mais Vendidos: show 4 (desktop) / 2 (mobile) initially ─────────────
  function initProducts() {
    var grid = document.querySelector('.grid.grid-cols-2');
    if (!grid) return;

    var products = Array.prototype.slice.call(grid.querySelectorAll('a.group.block'));
    if (products.length === 0) return;

    var btn = document.getElementById('8ae92af7-c25b-8b66-664f-8f8ab2b4df08');
    if (!btn) return;

    var expanded = false;

    function limit() {
      return window.innerWidth >= 768 ? 4 : 2;
    }

    function update() {
      var lim = limit();
      products.forEach(function (p, i) {
        p.style.display = (expanded || i < lim) ? '' : 'none';
      });
      btn.textContent = expanded ? 'Ver menos' : 'Ver todos os produtos';
    }

    btn.addEventListener('click', function () {
      expanded = !expanded;
      update();
      if (!expanded) {
        // Scroll back to section top when collapsing
        if (grid.closest && grid.closest('section')) {
          grid.closest('section').scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }
    });

    // Re-evaluate on resize (e.g., rotate phone)
    var resizeTimer;
    window.addEventListener('resize', function () {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(update, 100);
    });

    update(); // initial call
  }

  // ── 2. Footer mobile accordion ─────────────────────────────────────────────
  function initFooterAccordion() {
    // Works on any page that has the md:hidden mobile footer
    var mobileFooters = document.querySelectorAll('.md\\:hidden.space-y-0');
    mobileFooters.forEach(function (footer) {
      var sections = footer.querySelectorAll('.border-b');
      sections.forEach(function (section) {
        var btn = section.querySelector('button');
        var panel = section.querySelector('.overflow-hidden');
        var icon = btn && btn.querySelector('svg');
        if (!btn || !panel) return;

        // Ensure starts closed
        panel.style.maxHeight = '0px';
        panel.style.overflow = 'hidden';
        panel.style.transition = 'max-height 0.25s ease';

        btn.addEventListener('click', function () {
          var isOpen = panel.style.maxHeight !== '0px' && panel.style.maxHeight !== '';

          // Close all others in this footer
          sections.forEach(function (other) {
            var op = other.querySelector('.overflow-hidden');
            var oi = other.querySelector('button svg');
            if (op) { op.style.maxHeight = '0px'; }
            if (oi) { oi.style.transform = ''; }
          });

          if (!isOpen) {
            panel.style.maxHeight = panel.scrollHeight + 'px';
            if (icon) icon.style.transform = 'rotate(45deg)';
          }
        });
      });
    });
  }

  // ── Init ───────────────────────────────────────────────────────────────────
  function init() {
    initMobileMenu();
    initProducts();
    initFooterAccordion();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
