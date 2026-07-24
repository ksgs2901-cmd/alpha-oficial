// Alpha Oficial — Exit-intent coupon popup (shows once per visitor)
(function () {
  'use strict';

  var SHOWN_KEY = 'alpha_exit_popup_shown';
  var COUPON_KEY = 'alpha_coupon';
  var COUPON_CODE = 'ALPHA5';
  var COUPON_PERCENT = 5;

  var shown = false;
  try { shown = localStorage.getItem(SHOWN_KEY) === '1'; } catch (e) {}

  var overlay, dialog;

  function markShown() {
    shown = true;
    try { localStorage.setItem(SHOWN_KEY, '1'); } catch (e) {}
  }

  function inject() {
    overlay = document.createElement('div');
    overlay.id = 'alpha-exit-overlay';
    overlay.style.cssText = 'display:none;position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:99998';
    overlay.onclick = close;
    document.body.appendChild(overlay);

    dialog = document.createElement('div');
    dialog.id = 'alpha-exit-dialog';
    dialog.setAttribute('role', 'dialog');
    dialog.style.cssText = 'display:none;position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);z-index:99999;width:calc(100% - 32px);max-width:384px;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 10px 40px rgba(0,0,0,.25)';
    dialog.innerHTML =
      '<div style="position:relative;background:#0f172a;color:#fff;padding:32px 24px 24px;text-align:center">' +
      '<button id="alpha-exit-close" aria-label="Fechar" style="position:absolute;top:12px;right:12px;width:32px;height:32px;border-radius:9999px;background:rgba(255,255,255,.1);border:none;color:#fff;cursor:pointer;display:flex;align-items:center;justify-content:center">' +
      '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>' +
      '</button>' +
      '<div style="display:flex;justify-content:center;margin-bottom:16px">' +
      '<img src="' + (document.querySelector('img[src*="logo"]') ? document.querySelector('img[src*="logo"]').src : '') + '" alt="Alpha Oficial" style="height:48px;width:auto;object-fit:contain;filter:invert(1) brightness(2)">' +
      '</div>' +
      '<h3 style="font-size:22px;font-weight:700;line-height:1.2;margin:0">Espere! Não vá embora</h3>' +
      '<p style="font-size:14px;opacity:.9;margin:8px 0 0;line-height:1.5">Liberamos um <strong>cupom de ' + COUPON_PERCENT + '% OFF</strong> exclusivo pra você fechar seu pedido agora.</p>' +
      '</div>' +
      '<div style="padding:24px;display:flex;flex-direction:column;gap:16px;background:#fff">' +
      '<div style="background:#f1f5f9;border-radius:12px;padding:16px;text-align:center">' +
      '<p style="font-size:11px;text-transform:uppercase;letter-spacing:.05em;color:#64748b;font-weight:600;margin:0">Seu cupom</p>' +
      '<p style="font-size:24px;font-weight:700;color:#0f172a;letter-spacing:.2em;margin:4px 0 0">' + COUPON_CODE + '</p>' +
      '<p style="font-size:11px;color:#64748b;margin:4px 0 0">' + COUPON_PERCENT + '% OFF em todo o carrinho</p>' +
      '</div>' +
      '<button id="alpha-exit-apply" style="width:100%;height:60px;font-size:16px;font-weight:700;border-radius:12px;background:#0f172a;color:#fff;border:none;cursor:pointer">APLICAR DESCONTO</button>' +
      '<button id="alpha-exit-dismiss" style="width:100%;text-align:center;font-size:11px;color:#64748b;text-decoration:underline;background:none;border:none;padding:4px;cursor:pointer">Não, prefiro pagar o preço cheio</button>' +
      '</div>';
    document.body.appendChild(dialog);

    document.getElementById('alpha-exit-close').onclick = close;
    document.getElementById('alpha-exit-dismiss').onclick = close;
    document.getElementById('alpha-exit-apply').onclick = applyCoupon;
  }

  function open() {
    if (shown) return;
    if (!overlay) inject();
    overlay.style.display = 'block';
    dialog.style.display = 'block';
    markShown();
  }

  function close() {
    if (overlay) overlay.style.display = 'none';
    if (dialog) dialog.style.display = 'none';
  }

  function applyCoupon() {
    try {
      localStorage.setItem(COUPON_KEY, JSON.stringify({
        code: COUPON_CODE,
        percent: COUPON_PERCENT,
        appliedAt: Date.now()
      }));
    } catch (e) {}
    close();
    showToast('Cupom ' + COUPON_CODE + ' aplicado com sucesso!');
  }

  function showToast(message) {
    var toast = document.createElement('div');
    toast.style.cssText = 'position:fixed;bottom:20px;right:20px;z-index:99999;background:#0f172a;color:#fff;padding:14px 18px;border-radius:10px;font-size:13px;font-weight:500;box-shadow:0 6px 20px rgba(0,0,0,.25);opacity:0;transform:translateY(10px);transition:opacity .25s,transform .25s;max-width:calc(100% - 40px)';
    toast.textContent = message;
    document.body.appendChild(toast);

    requestAnimationFrame(function () {
      toast.style.opacity = '1';
      toast.style.transform = 'translateY(0)';
    });

    setTimeout(function () {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      setTimeout(function () { toast.remove(); }, 250);
    }, 3500);
  }

  // ── Trigger 1: mouse leaving towards the top of the viewport (desktop) ─────
  function initMouseLeave() {
    document.addEventListener('mouseleave', function (e) {
      if (e.clientY <= 0) open();
    });
  }

  // ── Trigger 2: back button ──────────────────────────────────────────────
  function initBackButton() {
    history.pushState({ alphaExit: true }, '', location.href);
    window.addEventListener('popstate', function () {
      if (shown) return;
      history.pushState({ alphaExit: true }, '', location.href);
      open();
    });
  }

  function init() {
    if (shown) return;
    initMouseLeave();
    initBackButton();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
