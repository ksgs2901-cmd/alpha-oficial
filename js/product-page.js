// Alpha Oficial — Dynamic Product Page
// Depends on: products-data.js (defines window.ALPHA_PRODUCTS)
(function () {
  'use strict';

  var params = new URLSearchParams(window.location.search);
  var productId = params.get('id');

  if (!productId) {
    window.location.href = '../';
    return;
  }

  var selectedSize = null;
  var selectedColor = null;
  var currentImageIndex = 0;
  var product = null;

  function fmt(n) {
    return 'R$ ' + n.toFixed(2).replace('.', ',');
  }

  function fmtNum(n) {
    return n.toFixed(2).replace('.', ',');
  }

  function pickRandom(arr, n) {
    var pool = arr.slice();
    var result = [];
    while (pool.length && result.length < n) {
      var idx = Math.floor(Math.random() * pool.length);
      result.push(pool.splice(idx, 1)[0]);
    }
    return result;
  }

  function findProduct() {
    if (!window.ALPHA_PRODUCTS) return null;
    var list = window.ALPHA_PRODUCTS.products;
    for (var i = 0; i < list.length; i++) {
      if (list[i].id === productId || list[i].slug === productId) {
        return list[i];
      }
    }
    return null;
  }

  function init() {
    product = findProduct();

    var loader = document.getElementById('prod-loading');
    var content = document.getElementById('prod-content');

    if (!product) {
      if (loader) loader.innerHTML = '<p style="text-align:center;padding:60px 20px;color:#888">Produto não encontrado. <a href="../" style="color:#0f172a">← Voltar</a></p>';
      return;
    }

    renderProduct();

    if (loader) loader.style.display = 'none';
    if (content) content.style.display = '';
  }

  function renderProduct() {
    document.title = product.name + ' — Alpha Oficial';

    setText('prod-title', product.name);
    setText('prod-price', fmt(product.price));
    setText('prod-price-original', fmt(product.priceOriginal));
    setText('prod-discount', '-' + product.discount + '%');

    var pix = product.price * 0.9;
    setText('prod-pix-price', fmt(pix) + ' no PIX');
    setText('prod-installments', 'ou ' + product.installments + 'x de ' + fmt(product.installmentValue) + ' sem juros');
    setText('prod-rating-value', product.rating.toFixed(1));
    setText('prod-reviews', '(' + product.reviews + ' avaliações)');

    renderGallery();
    renderSizes();
    renderColors();
    renderDetailImages();
    renderRelated();
    renderBox();

    var buyBtn = document.getElementById('prod-buy-btn');

    if (product.available === false) {
      if (buyBtn) {
        buyBtn.textContent = 'Produto Indisponível';
        buyBtn.disabled = true;
        buyBtn.style.opacity = '0.5';
        buyBtn.style.cursor = 'not-allowed';
        buyBtn.style.pointerEvents = 'none';
      }
      return;
    }

    if (buyBtn) {
      buyBtn.onclick = function () {
        if (!selectedSize) {
          alert('Por favor, selecione um tamanho.');
          return;
        }
        var color = selectedColor || (product.colors && product.colors[0] ? product.colors[0].name : '');
        if (window.AlphaCart) {
          AlphaCart.add(
            product.id,
            product.name,
            product.price,
            product.image,
            selectedSize,
            color,
            product.checkoutUrl
          );
        }
      };
    }
  }

  function setText(id, text) {
    var el = document.getElementById(id);
    if (el) el.textContent = text;
  }

  function renderGallery() {
    var images = (product.images && product.images.length) ? product.images : [product.image];
    currentImageIndex = 0;

    var mainImg = document.getElementById('prod-main-img');
    if (mainImg) {
      mainImg.src = images[0];
      mainImg.alt = product.name;
    }

    var counter = document.getElementById('prod-img-counter');
    if (counter) counter.textContent = '1 / ' + images.length;

    var thumbContainer = document.getElementById('prod-thumbnails');
    if (thumbContainer) {
      thumbContainer.innerHTML = images.map(function (img, idx) {
        var border = idx === 0 ? '#0f172a' : '#e2e8f0';
        return '<button onclick="AlphaProd.setImage(' + idx + ')" id="prod-thumb-' + idx + '" style="flex-shrink:0;width:56px;height:56px;border-radius:6px;overflow:hidden;border:2px solid ' + border + ';cursor:pointer;padding:0;background:none">' +
          '<img src="' + img + '" alt="' + product.name + ' ' + (idx + 1) + '" style="width:100%;height:100%;object-fit:cover">' +
          '</button>';
      }).join('');
    }

    var prevBtn = document.getElementById('prod-img-prev');
    var nextBtn = document.getElementById('prod-img-next');
    if (prevBtn) prevBtn.onclick = function () { AlphaProd.setImage(currentImageIndex - 1); };
    if (nextBtn) nextBtn.onclick = function () { AlphaProd.setImage(currentImageIndex + 1); };
  }

  function renderSizes() {
    var container = document.getElementById('prod-sizes');
    if (!container || !product.sizes) return;
    container.innerHTML = product.sizes.map(function (size) {
      var sid = 'prod-sz-' + size.replace(/[^a-zA-Z0-9]/g, '_');
      return '<button id="' + sid + '" onclick="AlphaProd.selectSize(\'' + size + '\')" style="min-width:44px;height:40px;padding:0 16px;border-radius:4px;border:1px solid #e2e8f0;font-size:14px;font-weight:500;cursor:pointer;background:#fff;color:#0f172a;transition:all .15s">' + size + '</button>';
    }).join('');
  }

  function renderColors() {
    var container = document.getElementById('prod-colors');
    if (!container) return;
    if (!product.colors || product.colors.length === 0) {
      container.innerHTML = '';
      return;
    }

    var label = document.getElementById('prod-color-label');
    if (label) label.textContent = product.colors[0].name;
    selectedColor = product.colors[0].name;

    container.innerHTML = product.colors.map(function (c, idx) {
      var border = idx === 0 ? '#0f172a' : 'transparent';
      return '<button id="prod-col-' + idx + '" onclick="AlphaProd.selectColor(' + idx + ')" title="' + c.name + '" style="width:56px;height:56px;border-radius:6px;overflow:hidden;border:2px solid ' + border + ';cursor:pointer;padding:0;background:none">' +
        '<img src="' + c.image + '" alt="' + c.name + '" style="width:100%;height:100%;object-fit:cover">' +
        '</button>';
    }).join('');
  }

  function renderDetailImages() {
    var section = document.getElementById('prod-detail-section');
    var container = document.getElementById('prod-detail-images');
    if (!section || !container) return;

    var images = (product.images || []).slice(1);
    if (!images.length) {
      section.style.display = 'none';
      container.innerHTML = '';
      return;
    }

    section.style.display = '';
    container.innerHTML = images.map(function (img, idx) {
      return '<div class="aspect-square overflow-hidden rounded-xl bg-secondary"><img src="' + img + '" alt="' + product.name + ' - detalhe ' + (idx + 1) + '" class="w-full h-full object-cover" loading="lazy"></div>';
    }).join('');
  }

  function renderBox() {
    var section = document.getElementById('prod-box-section');
    var titleEl = document.getElementById('prod-box-title');
    var msgEl = document.getElementById('prod-box-message');
    if (!section || !titleEl || !msgEl) return;

    if (!product.box || !product.box.title) {
      section.style.display = 'none';
      return;
    }

    section.style.display = '';
    titleEl.textContent = product.box.title;
    msgEl.innerHTML = product.box.message || '';
  }

  function renderRelated() {
    var container = document.getElementById('prod-related');
    if (!container || !window.ALPHA_PRODUCTS) return;

    var others = window.ALPHA_PRODUCTS.products.filter(function (p) { return p.id !== product.id; });
    var picks = pickRandom(others, 4);

    container.innerHTML = picks.map(function (p) {
      var img = (p.images && p.images[0]) || p.image;
      return '<a class="group block" href="?id=' + p.id + '">' +
        '<div class="relative aspect-square overflow-hidden bg-secondary mb-3 rounded-lg cursor-pointer">' +
        '<img src="' + img + '" alt="' + p.name + '" class="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" loading="lazy" decoding="async" width="600" height="600">' +
        '<span class="absolute top-3 left-3 bg-destructive text-destructive-foreground text-[11px] font-bold px-2.5 py-1 rounded-full">' + p.discount + '% off</span>' +
        '</div>' +
        '<h3 class="text-sm font-semibold text-foreground mb-1.5 leading-tight line-clamp-2">' + p.name + '</h3>' +
        '<div class="flex items-center gap-2 flex-wrap">' +
        '<span class="text-xs text-muted-foreground line-through">R$&nbsp;' + fmtNum(p.priceOriginal) + '</span>' +
        '<span class="text-sm font-bold text-foreground">R$&nbsp;' + fmtNum(p.price) + '</span>' +
        '</div>' +
        '<p class="text-xs text-muted-foreground mt-1">ou ' + p.installments + 'x de R$&nbsp;' + fmtNum(p.installmentValue) + '</p>' +
        '</a>';
    }).join('');
  }

  // ── Public API ─────────────────────────────────────────────────────────────
  window.AlphaProd = {
    setImage: function (idx) {
      var images = (product && product.images && product.images.length) ? product.images : (product ? [product.image] : []);
      if (idx < 0) idx = images.length - 1;
      if (idx >= images.length) idx = 0;
      currentImageIndex = idx;

      var mainImg = document.getElementById('prod-main-img');
      if (mainImg) mainImg.src = images[idx];

      var counter = document.getElementById('prod-img-counter');
      if (counter) counter.textContent = (idx + 1) + ' / ' + images.length;

      images.forEach(function (_, i) {
        var t = document.getElementById('prod-thumb-' + i);
        if (t) t.style.borderColor = i === idx ? '#0f172a' : '#e2e8f0';
      });
    },

    selectSize: function (size) {
      if (!product || !product.sizes) return;
      product.sizes.forEach(function (s) {
        var btn = document.getElementById('prod-sz-' + s.replace(/[^a-zA-Z0-9]/g, '_'));
        if (btn) { btn.style.background = '#fff'; btn.style.borderColor = '#e2e8f0'; btn.style.color = '#0f172a'; }
      });
      var btn = document.getElementById('prod-sz-' + size.replace(/[^a-zA-Z0-9]/g, '_'));
      if (btn) { btn.style.background = '#0f172a'; btn.style.borderColor = '#0f172a'; btn.style.color = '#fff'; }
      selectedSize = size;
    },

    selectColor: function (idx) {
      if (!product || !product.colors) return;
      product.colors.forEach(function (_, i) {
        var btn = document.getElementById('prod-col-' + i);
        if (btn) btn.style.borderColor = 'transparent';
      });
      var btn = document.getElementById('prod-col-' + idx);
      if (btn) btn.style.borderColor = '#0f172a';
      selectedColor = product.colors[idx].name;
      var label = document.getElementById('prod-color-label');
      if (label) label.textContent = selectedColor;
      this.setImage(idx);
    }
  };

  // Run on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
