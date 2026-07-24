// Alpha Oficial — Cart System
(function () {
  'use strict';

  var STORAGE_KEY = 'alpha_cart_v1';
  var TRACKING_KEYS = [
    'src',
    'sck',
    'xcod',
    'utm_source',
    'utm_campaign',
    'utm_medium',
    'utm_content',
    'utm_term',
    'utm_id',
    'fbclid',
    'gclid',
    'gbraid',
    'wbraid',
    'ttclid',
    'click_id',
    'CampaignID',
    'adSETID',
    'CreativeID',
    'pixel_id',
    'keyword'
  ];
  var TRACKING_TTL_MS = 7 * 24 * 60 * 60 * 1000;
  var items = [];

  // Image paths in products-data.js are stored relative to a page one folder
  // deep (e.g. "../images/p1/1.jpg"). The cart drawer is shared across pages
  // at different depths (root vs. subfolders), so resolve them against this
  // script's own URL instead of the current page's location.
  var SITE_ROOT = (function () {
    var scripts = document.getElementsByTagName('script');
    for (var i = 0; i < scripts.length; i++) {
      var m = scripts[i].src.match(/^(.*\/)js\/cart\.js(?:\?.*)?$/);
      if (m) return m[1];
    }
    return './';
  })();

  function imageUrl(path) {
    return SITE_ROOT + String(path || '').replace(/^(\.\.?\/)+/, '');
  }

  function load() {
    try { items = JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; }
    catch (e) { items = []; }
  }

  function save() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }

  function count() { return items.reduce(function (s, i) { return s + i.qty; }, 0); }
  function total() { return items.reduce(function (s, i) { return s + i.price * i.qty; }, 0); }

  function fmt(n) { return 'R$ ' + n.toFixed(2).replace('.', ','); }

  function storageGet(key) {
    try {
      var expiresAt = localStorage.getItem(key + '_exp');
      if (expiresAt && new Date(expiresAt).getTime() < Date.now()) {
        localStorage.removeItem(key);
        localStorage.removeItem(key + '_exp');
        return null;
      }
      return localStorage.getItem(key);
    } catch (e) {
      return null;
    }
  }

  function storageSet(key, value) {
    try {
      var expiresAt = new Date(Date.now() + TRACKING_TTL_MS).toISOString();
      localStorage.setItem(key, value);
      localStorage.setItem(key + '_exp', expiresAt);
    } catch (e) { /* localStorage unavailable */ }
  }

  function persistTrackingFromUrl() {
    var params = new URLSearchParams(window.location.search);
    TRACKING_KEYS.forEach(function (key) {
      var value = params.get(key);
      if (value) storageSet(key, value);
    });
  }

  function getTrackingValue(key) {
    var params = new URLSearchParams(window.location.search);
    var value = params.get(key);
    if (!value && window.utmParams && typeof window.utmParams.get === 'function') {
      value = window.utmParams.get(key);
    }
    if (!value) value = storageGet(key);
    return value || '';
  }

  function trackingParamsObject() {
    var result = {};
    TRACKING_KEYS.forEach(function (key) {
      var value = getTrackingValue(key);
      if (value) result[key] = value;
    });
    return result;
  }

  function trackingQueryString() {
    var params = new URLSearchParams();
    var values = trackingParamsObject();
    TRACKING_KEYS.forEach(function (key) {
      if (values[key]) params.set(key, values[key]);
    });
    return params.toString();
  }

  function withTracking(url) {
    var qs = trackingQueryString();
    if (!qs) return url;
    return url + (url.indexOf('?') === -1 ? '?' : '&') + qs;
  }

  function esc(s) {
    return String(s)
      .replace(/\\/g, '\\\\')
      .replace(/'/g, "\\'")
      .replace(/"/g, '&quot;');
  }

  // ── Public API ─────────────────────────────────────────────────────────────
  window.AlphaCart = {

    open: function () {
      var d = document.getElementById('alpha-cart-drawer');
      var o = document.getElementById('alpha-cart-overlay');
      if (d) {
        d.style.display = 'flex';
        // Force reflow so transition fires from off-screen
        d.getBoundingClientRect();
        d.style.transform = 'translateX(0)';
      }
      if (o) {
        o.style.display = 'block';
        o.getBoundingClientRect();
        o.style.opacity = '1';
      }
      document.body.style.overflow = 'hidden';
    },

    close: function () {
      var d = document.getElementById('alpha-cart-drawer');
      var o = document.getElementById('alpha-cart-overlay');
      if (d) {
        d.style.transform = 'translateX(100%)';
        // Hide after animation ends (350ms matches transition)
        setTimeout(function () { if (d.style.transform === 'translateX(100%)') d.style.display = 'none'; }, 350);
      }
      if (o) {
        o.style.opacity = '0';
        setTimeout(function () { if (o.style.opacity === '0') o.style.display = 'none'; }, 350);
      }
      document.body.style.overflow = '';
    },

    add: function (productId, name, price, image, size, color, checkoutUrl) {
      var key = productId + '|' + size + '|' + color;
      var found = false;
      for (var i = 0; i < items.length; i++) {
        if (items[i].key === key) { items[i].qty++; found = true; break; }
      }
      if (!found) {
        items.push({ key: key, id: productId, name: name, price: Number(price), image: image, size: size, color: color, qty: 1, checkoutUrl: checkoutUrl });
      }
      save();
      this._render();
      this.open();
    },

    remove: function (key) {
      items = items.filter(function (i) { return i.key !== key; });
      save();
      this._render();
    },

    getItems: function () {
      return items.slice();
    },

    imageUrl: imageUrl,

    clear: function () {
      items = [];
      save();
      this._render();
    },

    updateQty: function (key, delta) {
      for (var i = 0; i < items.length; i++) {
        if (items[i].key === key) {
          items[i].qty = Math.max(1, items[i].qty + delta);
          break;
        }
      }
      save();
      this._render();
    },

    checkout: function () {
      if (items.length === 0) return;
      var parts = window.location.pathname.split('/').filter(Boolean);
      var atRoot = parts.length === 0 || (parts.length === 1 && /\.html?$/i.test(parts[0]));
      window.location.href = withTracking(atRoot ? './checkout/' : '../checkout/');
    },

    // ── Render ──────────────────────────────────────────────────────────────
    _render: function () {
      var n = count();
      var tot = total();
      var pix = tot * 0.9;

      // Badges
      document.querySelectorAll('.alpha-cart-badge').forEach(function (el) {
        el.textContent = n;
        el.style.display = n > 0 ? 'flex' : 'none';
      });

      var titleEl = document.getElementById('alpha-cart-title');
      if (titleEl) titleEl.textContent = 'SACOLA (' + n + ')';

      var body = document.getElementById('alpha-cart-body');
      var footer = document.getElementById('alpha-cart-footer');
      if (!body) return;

      if (items.length === 0) {
        body.innerHTML =
          '<div style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;gap:16px;padding:40px 20px">' +
          '<p style="color:#64748b;font-size:14px">Seu carrinho está vazio</p>' +
          '<button onclick="AlphaCart.close()" style="height:40px;padding:0 24px;border:1px solid #e2e8f0;background:#fff;border-radius:9999px;font-size:14px;font-weight:500;cursor:pointer">Continuar Comprando</button>' +
          '</div>';
        footer.innerHTML = '';
        return;
      }

      body.innerHTML = items.map(function (item) {
        var k = esc(item.key);
        return '' +
          '<div style="display:flex;gap:16px;padding:16px 20px;border-bottom:1px solid #e2e8f0">' +
          '<img src="' + imageUrl(item.image) + '" alt="" style="width:72px;height:88px;object-fit:cover;background:#f1f5f9;border-radius:8px;flex-shrink:0">' +
          '<div style="flex:1;min-width:0">' +
          '<p style="font-size:14px;font-weight:500;color:#0f172a;line-height:1.35;margin:0 0 3px;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical">' + item.name + '</p>' +
          (item.size ? '<p style="font-size:12px;color:#64748b;margin:2px 0 0">Tamanho: ' + item.size + '</p>' : '') +
          (item.color ? '<p style="font-size:12px;color:#64748b;margin:2px 0 0">Cor: ' + item.color + '</p>' : '') +
          '<p style="font-size:14px;font-weight:700;color:#059669;margin:6px 0 0">' + fmt(item.price) + '</p>' +
          '<div style="display:flex;align-items:center;justify-content:space-between;margin-top:8px">' +
          '<div style="display:flex;align-items:center;border:1px solid #e2e8f0;border-radius:6px;overflow:hidden">' +
          '<button onclick="AlphaCart.updateQty(\'' + k + '\',-1)" style="width:32px;height:32px;display:flex;align-items:center;justify-content:center;background:none;border:none;cursor:pointer;font-size:18px;color:#0f172a">−</button>' +
          '<span style="width:32px;height:32px;display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:500;border-left:1px solid #e2e8f0;border-right:1px solid #e2e8f0;color:#0f172a">' + item.qty + '</span>' +
          '<button onclick="AlphaCart.updateQty(\'' + k + '\',1)" style="width:32px;height:32px;display:flex;align-items:center;justify-content:center;background:none;border:none;cursor:pointer;font-size:18px;color:#0f172a">+</button>' +
          '</div>' +
          '<button onclick="AlphaCart.remove(\'' + k + '\')" style="font-size:12px;color:#64748b;text-decoration:underline;cursor:pointer;background:none;border:none">remover</button>' +
          '</div></div></div>';
      }).join('');

      footer.innerHTML =
        '<div style="border-top:1px solid #e2e8f0">' +
        '<div style="padding:16px 20px 8px;display:flex;flex-direction:column;gap:12px">' +
        '<div style="display:flex;justify-content:space-between"><span style="font-size:14px;color:#64748b">subtotal</span><span style="font-size:14px;color:#64748b">' + fmt(tot) + '</span></div>' +
        '<div style="display:flex;justify-content:space-between"><span style="font-size:14px;font-weight:700;color:#0f172a">TOTAL</span><span style="font-size:18px;font-weight:700;color:#059669">' + fmt(tot) + '</span></div>' +
        '<div style="display:flex;justify-content:space-between;background:#f0fdf4;padding:8px 12px;border-radius:6px">' +
        '<span style="font-size:14px;font-weight:500;color:#047857">10% OFF no PIX</span>' +
        '<span style="font-size:14px;font-weight:700;color:#047857">' + fmt(pix) + '</span></div></div>' +
        '<div style="padding:12px 20px 20px;display:flex;flex-direction:column;gap:8px">' +
        '<button onclick="AlphaCart.checkout()" style="width:100%;height:48px;background:#059669;color:#fff;border:none;border-radius:9999px;font-size:14px;font-weight:700;letter-spacing:.05em;cursor:pointer">FINALIZAR COMPRA</button>' +
        '<button onclick="AlphaCart.close()" style="width:100%;height:48px;background:#fff;color:#0f172a;border:1px solid #0f172a;border-radius:9999px;font-size:14px;font-weight:700;letter-spacing:.05em;cursor:pointer">CONTINUAR COMPRANDO</button>' +
        '</div></div>';
    },

    // ── Inject drawer ────────────────────────────────────────────────────────
    _inject: function () {
      if (document.getElementById('alpha-cart-drawer')) return;

      var overlay = document.createElement('div');
      overlay.id = 'alpha-cart-overlay';
      overlay.onclick = function () { AlphaCart.close(); };
      overlay.style.cssText = 'display:none;position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:49;opacity:0;transition:opacity 0.35s ease';
      document.body.appendChild(overlay);

      var drawer = document.createElement('div');
      drawer.id = 'alpha-cart-drawer';
      drawer.setAttribute('role', 'dialog');
      drawer.style.cssText = 'display:none;position:fixed;right:0;top:0;height:100%;width:100%;max-width:448px;background:#fff;border-left:1px solid #e2e8f0;z-index:50;flex-direction:column;overflow:hidden;font-family:inherit;transform:translateX(100%);transition:transform 0.35s cubic-bezier(0.4,0,0.2,1)';
      drawer.innerHTML =
        '<div style="display:flex;align-items:center;justify-content:space-between;padding:16px 20px;border-bottom:1px solid #e2e8f0;flex-shrink:0">' +
        '<span id="alpha-cart-title" style="font-size:14px;font-weight:700;color:#0f172a;letter-spacing:.05em">SACOLA (0)</span>' +
        '<button onclick="AlphaCart.close()" style="background:none;border:none;cursor:pointer;padding:4px;color:#0f172a;display:flex;align-items:center">' +
        '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>' +
        '</button></div>' +
        '<div id="alpha-cart-body" style="flex:1;overflow-y:auto"></div>' +
        '<div id="alpha-cart-footer"></div>';
      document.body.appendChild(drawer);
    },

    // ── Wire cart button clicks via event delegation ─────────────────────────
    _wire: function () {
      // Use event delegation on document — works even if DOM changes
      document.addEventListener('click', function (e) {
        var btn = e.target.closest('button');
        if (!btn) return;
        // Check if this button contains a shopping-bag icon
        if (btn.querySelector && btn.querySelector('.lucide-shopping-bag')) {
          e.preventDefault();
          AlphaCart.open();
        }
      });

      // Add badges to all shopping-bag buttons found now
      document.querySelectorAll('button').forEach(function (btn) {
        if (btn.querySelector && btn.querySelector('.lucide-shopping-bag') && !btn.dataset.cartBadge) {
          btn.dataset.cartBadge = '1';
          btn.style.position = 'relative';
          var badge = document.createElement('span');
          badge.className = 'alpha-cart-badge';
          badge.style.cssText = 'display:none;position:absolute;top:-5px;right:-5px;min-width:18px;height:18px;padding:0 4px;background:#ef4444;color:#fff;border-radius:9999px;font-size:11px;font-weight:700;align-items:center;justify-content:center;line-height:1;pointer-events:none';
          btn.appendChild(badge);
        }
      });
    },

    init: function () {
      load();
      var self = this;
      function setup() {
        self._inject();
        self._wire();
        self._render();
      }
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', setup);
      } else {
        setup();
      }
    }
  };

  persistTrackingFromUrl();

  window.AlphaTracking = {
    persist: persistTrackingFromUrl,
    paramsObject: trackingParamsObject,
    queryString: trackingQueryString,
    withTracking: withTracking
  };

  window.AlphaCart.init();

})();
