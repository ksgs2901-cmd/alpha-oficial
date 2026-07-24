// Alpha Oficial — FAQ Accordion
(function () {
  'use strict';

  function initFAQ() {
    // Find all accordion item wrappers
    var items = document.querySelectorAll('[data-orientation="vertical"].border-b');
    items.forEach(function (item) {
      var btn = item.querySelector('button[aria-controls]');
      var panelId = btn && btn.getAttribute('aria-controls');
      var panel = panelId ? document.getElementById(panelId) : null;
      if (!btn || !panel) return;

      btn.addEventListener('click', function () {
        var isOpen = item.getAttribute('data-state') === 'open';

        // Close all others
        items.forEach(function (other) {
          var ob = other.querySelector('button[aria-controls]');
          var oid = ob && ob.getAttribute('aria-controls');
          var op = oid ? document.getElementById(oid) : null;
          if (!ob || !op) return;
          other.setAttribute('data-state', 'closed');
          ob.setAttribute('data-state', 'closed');
          ob.setAttribute('aria-expanded', 'false');
          op.setAttribute('data-state', 'closed');
          op.setAttribute('hidden', '');
          op.style.maxHeight = '0';
          op.style.overflow = 'hidden';
        });

        if (!isOpen) {
          item.setAttribute('data-state', 'open');
          btn.setAttribute('data-state', 'open');
          btn.setAttribute('aria-expanded', 'true');
          panel.setAttribute('data-state', 'open');
          panel.removeAttribute('hidden');
          panel.style.overflow = 'hidden';
          panel.style.maxHeight = panel.scrollHeight + 'px';
          // Allow natural height after animation
          setTimeout(function () { panel.style.maxHeight = 'none'; }, 300);
        }
      });

      // Initial closed state
      panel.style.maxHeight = '0';
      panel.style.overflow = 'hidden';
      panel.style.transition = 'max-height 0.25s ease';
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initFAQ);
  } else {
    initFAQ();
  }
})();
