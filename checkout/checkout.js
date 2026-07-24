(function () {
  "use strict";

  var CART_KEY = "alpha_cart_v1";
  var PAYMENT_KEY = "alpha_pix_payment_v1";
  var cart = loadJson(localStorage, CART_KEY, []);
  var payment = loadJson(sessionStorage, PAYMENT_KEY, null);
  var pollTimer = null;

  function byId(id) {
    return document.getElementById(id);
  }

  function loadJson(storage, key, fallback) {
    try {
      var parsed = JSON.parse(storage.getItem(key));
      return parsed == null ? fallback : parsed;
    } catch (error) {
      return fallback;
    }
  }

  function formatMoney(cents) {
    return (cents / 100).toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL"
    });
  }

  function unitCents(item) {
    return Math.round(Number(item.price || 0) * 100);
  }

  function pixUnitCents(item) {
    return Math.round(unitCents(item) * 0.9);
  }

  function safeImage(path) {
    path = String(path || "");
    if (!/^(\.\.\/|\/)?images\/[A-Za-z0-9_./-]+$/.test(path)) {
      return "../images/favicon.png";
    }
    return path;
  }

  function renderSummary() {
    var container = byId("summary-items");
    container.innerHTML = "";
    var subtotal = 0;
    var total = 0;

    cart.forEach(function (item) {
      var quantity = Math.max(1, Number(item.qty) || 1);
      subtotal += unitCents(item) * quantity;
      total += pixUnitCents(item) * quantity;

      var row = document.createElement("div");
      row.className = "summary-item";

      var image = document.createElement("img");
      image.className = "summary-item-image";
      image.src = safeImage(item.image);
      image.alt = "";

      var details = document.createElement("div");
      var name = document.createElement("p");
      name.className = "summary-item-name";
      name.textContent = item.name || "Produto";
      var meta = document.createElement("p");
      meta.className = "summary-item-meta";
      meta.textContent = [
        "Qtd. " + quantity,
        item.size ? "Tam. " + item.size : "",
        item.color || ""
      ].filter(Boolean).join(" • ");
      details.appendChild(name);
      details.appendChild(meta);

      var price = document.createElement("span");
      price.className = "summary-item-price";
      price.textContent = formatMoney(pixUnitCents(item) * quantity);

      row.appendChild(image);
      row.appendChild(details);
      row.appendChild(price);
      container.appendChild(row);
    });

    byId("summary-subtotal").textContent = formatMoney(subtotal);
    byId("summary-discount").textContent = "- " + formatMoney(subtotal - total);
    byId("summary-total").textContent = formatMoney(total);
  }

  function digits(value) {
    return String(value || "").replace(/\D/g, "");
  }

  function trackingData() {
    var result = {};
    ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"].forEach(function (key) {
      try {
        var expiresAt = localStorage.getItem(key + "_exp");
        if (expiresAt && new Date(expiresAt).getTime() < Date.now()) return;
        var value = localStorage.getItem(key);
        if (value) result[key] = value;
      } catch (error) {
        // Tracking is optional.
      }
    });
    return result;
  }

  function formPayload(form) {
    var data = new FormData(form);
    var customerName = String(data.get("name") || "").trim();
    return {
      customer: {
        name: customerName,
        email: String(data.get("email") || "").trim(),
        phone: digits(data.get("phone")),
        document: digits(data.get("document"))
      },
      shipping: {
        name: customerName,
        zipCode: digits(data.get("zipCode")),
        state: String(data.get("state") || ""),
        street: String(data.get("street") || "").trim(),
        number: String(data.get("number") || "").trim(),
        complement: String(data.get("complement") || "").trim(),
        neighborhood: String(data.get("neighborhood") || "").trim(),
        city: String(data.get("city") || "").trim()
      },
      items: cart.map(function (item) {
        return {
          id: item.id,
          qty: Math.max(1, Number(item.qty) || 1),
          size: item.size || "",
          color: item.color || ""
        };
      }),
      tracking: trackingData()
    };
  }

  function setError(message) {
    var error = byId("form-error");
    error.textContent = message || "";
    error.style.display = message ? "block" : "none";
  }

  async function createPayment(event) {
    event.preventDefault();
    var form = event.currentTarget;
    setError("");

    Array.prototype.forEach.call(form.elements, function (field) {
      if (field.setAttribute) field.setAttribute("aria-invalid", field.checkValidity ? String(!field.checkValidity()) : "false");
    });
    if (!form.checkValidity()) {
      form.reportValidity();
      setError("Confira os campos destacados antes de continuar.");
      return;
    }

    var button = byId("submit-payment");
    button.disabled = true;
    button.textContent = "GERANDO PIX...";

    try {
      var response = await fetch("/api/pix", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formPayload(form))
      });
      var result = await response.json().catch(function () { return {}; });
      if (!response.ok || !result.success) {
        throw new Error(result.message || "Não foi possível gerar o PIX.");
      }
      payment = result.data;
      sessionStorage.setItem(PAYMENT_KEY, JSON.stringify(payment));
      showPayment();
    } catch (error) {
      setError(error.message || "Não foi possível gerar o PIX. Tente novamente.");
      button.disabled = false;
      button.textContent = "GERAR PIX E FINALIZAR";
    }
  }

  function showPayment() {
    byId("checkout-form").style.display = "none";
    document.querySelector(".form-column > .checkout-title").style.display = "none";
    document.querySelector(".form-column > .checkout-subtitle").style.display = "none";
    byId("pix-result").classList.add("is-visible");
    byId("pix-code").textContent = payment.copyPaste;

    var qr = byId("pix-qr");
    if (/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(payment.qrCodeBase64 || "")) {
      qr.src = payment.qrCodeBase64;
      qr.style.display = "block";
    } else {
      qr.removeAttribute("src");
      qr.style.display = "none";
    }

    updateCountdown();
    if (pollTimer) clearInterval(pollTimer);
    pollTimer = setInterval(checkStatus, 5000);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function updateCountdown() {
    if (!payment || !payment.expiresAt) {
      byId("pix-countdown").textContent = "";
      return;
    }
    var remaining = new Date(payment.expiresAt).getTime() - Date.now();
    if (remaining <= 0) {
      byId("pix-countdown").textContent = "— código expirado";
      return;
    }
    var hours = Math.floor(remaining / 3600000);
    var minutes = Math.floor((remaining % 3600000) / 60000);
    byId("pix-countdown").textContent = "— expira em " + hours + "h " + minutes + "min";
  }

  async function checkStatus() {
    if (!payment || !payment.transactionId) return;
    var button = byId("check-payment");
    button.disabled = true;
    try {
      var response = await fetch("/api/pix-status?id=" + encodeURIComponent(payment.transactionId), {
        headers: { "Accept": "application/json" }
      });
      var result = await response.json().catch(function () { return {}; });
      if (!response.ok || !result.success) throw new Error(result.message || "Consulta indisponível.");
      var status = String(result.data.status || "").toUpperCase();
      if (status === "PAID") {
        confirmPaid();
      } else if (status === "CANCELLED" || status === "REFUNDED") {
        clearInterval(pollTimer);
        byId("payment-status").innerHTML = "<span>Este PIX foi cancelado ou expirou.</span>";
      } else {
        byId("payment-status").querySelector("span:last-child").firstChild.nodeValue = "Aguardando pagamento ";
      }
    } catch (error) {
      // Keep polling: temporary status failures must not invalidate the PIX.
    } finally {
      button.disabled = false;
      updateCountdown();
    }
  }

  function confirmPaid() {
    if (pollTimer) clearInterval(pollTimer);
    localStorage.removeItem(CART_KEY);
    sessionStorage.removeItem(PAYMENT_KEY);
    byId("pix-result").classList.remove("is-visible");
    byId("paid-state").classList.add("is-visible");
  }

  async function copyPix() {
    var button = byId("copy-pix");
    try {
      await navigator.clipboard.writeText(payment.copyPaste);
    } catch (error) {
      var selection = window.getSelection();
      var range = document.createRange();
      range.selectNodeContents(byId("pix-code"));
      selection.removeAllRanges();
      selection.addRange(range);
      document.execCommand("copy");
      selection.removeAllRanges();
    }
    button.textContent = "CÓDIGO COPIADO ✓";
    setTimeout(function () { button.textContent = "COPIAR CÓDIGO PIX"; }, 2500);
  }

  function installMasks() {
    byId("customer-phone").addEventListener("input", function (event) {
      var value = digits(event.target.value).slice(0, 11);
      event.target.value = value.length > 10
        ? value.replace(/(\d{2})(\d{5})(\d{0,4})/, "($1) $2-$3")
        : value.replace(/(\d{2})(\d{4})(\d{0,4})/, "($1) $2-$3");
    });
    byId("customer-document").addEventListener("input", function (event) {
      event.target.value = digits(event.target.value).slice(0, 14);
    });
    byId("shipping-zip").addEventListener("input", function (event) {
      var value = digits(event.target.value).slice(0, 8);
      event.target.value = value.replace(/(\d{5})(\d{0,3})/, "$1-$2").replace(/-$/, "");
    });
  }

  function init() {
    if (!Array.isArray(cart) || cart.length === 0) {
      window.location.replace("../");
      return;
    }
    renderSummary();
    installMasks();
    byId("checkout-form").addEventListener("submit", createPayment);
    byId("copy-pix").addEventListener("click", copyPix);
    byId("check-payment").addEventListener("click", checkStatus);

    if (payment && payment.transactionId && payment.copyPaste) {
      showPayment();
      checkStatus();
    }
    setInterval(updateCountdown, 60000);
  }

  init();
})();
