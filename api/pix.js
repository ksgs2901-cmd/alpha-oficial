const crypto = require("crypto");
const { PRODUCTS } = require("../server/catalog");
const { BlackCatError, createSale } = require("../server/blackcat");

const attempts = new Map();
const TRACKING_FIELDS = [
  "utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"
];

function digits(value) {
  return String(value || "").replace(/\D/g, "");
}

function text(value, maxLength) {
  return String(value || "").trim().slice(0, maxLength);
}

function validEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i.test(value);
}

function validDocument(number) {
  if (!/^(\d{11}|\d{14})$/.test(number) || /^(\d)\1+$/.test(number)) return false;
  const calculate = (base, factors) => {
    const total = factors.reduce((sum, factor, index) => sum + Number(base[index]) * factor, 0);
    const remainder = total % 11;
    return remainder < 2 ? 0 : 11 - remainder;
  };

  if (number.length === 11) {
    const first = calculate(number, [10, 9, 8, 7, 6, 5, 4, 3, 2]);
    const second = calculate(number, [11, 10, 9, 8, 7, 6, 5, 4, 3, 2]);
    return first === Number(number[9]) && second === Number(number[10]);
  }

  const first = calculate(number, [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  const second = calculate(number, [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  return first === Number(number[12]) && second === Number(number[13]);
}

function enforceRateLimit(req) {
  const forwarded = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim();
  const key = forwarded || req.socket && req.socket.remoteAddress || "unknown";
  const now = Date.now();
  const recent = (attempts.get(key) || []).filter((timestamp) => now - timestamp < 10 * 60 * 1000);
  if (recent.length >= 5) return false;
  recent.push(now);
  attempts.set(key, recent);
  if (attempts.size > 1000) attempts.clear();
  return true;
}

function buildItems(rawItems) {
  if (!Array.isArray(rawItems) || rawItems.length === 0 || rawItems.length > 30) {
    throw new BlackCatError("Seu carrinho está vazio ou inválido.", 400, "INVALID_CART");
  }

  return rawItems.map((raw) => {
    const product = PRODUCTS[text(raw && raw.id, 80)];
    const quantity = Number(raw && raw.qty);
    if (!product || !Number.isInteger(quantity) || quantity < 1 || quantity > 10) {
      throw new BlackCatError("Um produto do carrinho é inválido.", 400, "INVALID_CART");
    }

    const variants = [text(raw.size, 20), text(raw.color, 40)].filter(Boolean);
    return {
      id: text(raw.id, 80),
      title: product.name + (variants.length ? " — " + variants.join(" / ") : ""),
      unitPrice: Math.round(product.price * 0.9),
      quantity,
      tangible: true
    };
  });
}

function buildCustomer(raw) {
  const name = text(raw && raw.name, 120);
  const email = text(raw && raw.email, 160).toLowerCase();
  const phone = digits(raw && raw.phone);
  const document = digits(raw && raw.document);
  if (name.length < 3 || !validEmail(email) || !/^\d{10,11}$/.test(phone) || !validDocument(document)) {
    throw new BlackCatError("Revise nome, e-mail, telefone e CPF/CNPJ.", 400, "INVALID_CUSTOMER");
  }
  return {
    name,
    email,
    phone,
    document: {
      number: document,
      type: document.length === 11 ? "cpf" : "cnpj"
    }
  };
}

function buildShipping(raw, customerName) {
  const shipping = {
    name: text(raw && raw.name, 120) || customerName,
    street: text(raw && raw.street, 160),
    number: text(raw && raw.number, 20),
    complement: text(raw && raw.complement, 80),
    neighborhood: text(raw && raw.neighborhood, 100),
    city: text(raw && raw.city, 100),
    state: text(raw && raw.state, 2).toUpperCase(),
    zipCode: digits(raw && raw.zipCode)
  };
  if (
    shipping.name.length < 3 || !shipping.street || !shipping.number ||
    !shipping.neighborhood || !shipping.city || !/^[A-Z]{2}$/.test(shipping.state) ||
    !/^\d{8}$/.test(shipping.zipCode)
  ) {
    throw new BlackCatError("Preencha corretamente o endereço de entrega.", 400, "INVALID_SHIPPING");
  }
  return shipping;
}

function publicSiteUrl() {
  const configured = String(process.env.PUBLIC_SITE_URL || "").replace(/\/+$/, "");
  if (/^https:\/\/[a-z0-9.-]+(?::\d+)?$/i.test(configured)) return configured;
  const vercelUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  return vercelUrl ? "https://" + vercelUrl : "";
}

function sendError(res, error) {
  const known = error instanceof BlackCatError;
  res.status(known ? error.statusCode : 500).json({
    success: false,
    code: known ? error.code : "INTERNAL_ERROR",
    message: known ? error.message : "Não foi possível gerar o PIX. Tente novamente."
  });
}

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ success: false, message: "Método não permitido." });
  }
  if (Number(req.headers["content-length"] || 0) > 32768) {
    return res.status(413).json({ success: false, message: "Requisição muito grande." });
  }
  if (!enforceRateLimit(req)) {
    return res.status(429).json({ success: false, message: "Aguarde alguns minutos antes de tentar novamente." });
  }

  try {
    const body = req.body && typeof req.body === "object" ? req.body : {};
    const items = buildItems(body.items);
    const customer = buildCustomer(body.customer);
    const shipping = buildShipping(body.shipping, customer.name);
    const amount = items.reduce((total, item) => total + item.unitPrice * item.quantity, 0);
    const externalRef = "ALPHA-" + crypto.randomUUID();
    const tracking = {};
    TRACKING_FIELDS.forEach((field) => {
      const value = text(body.tracking && body.tracking[field], 120);
      if (value) tracking[field] = value;
    });

    const sale = {
      amount,
      currency: "BRL",
      paymentMethod: "pix",
      items: items.map(({ title, unitPrice, quantity, tangible }) => ({
        title, unitPrice, quantity, tangible
      })),
      customer,
      shipping,
      pix: { expiresInDays: 1 },
      externalRef,
      metadata: JSON.stringify({
        source: "alpha-oficial",
        products: items.map(({ id, quantity }) => ({ id, quantity }))
      }),
      ...tracking
    };
    const siteUrl = publicSiteUrl();
    if (siteUrl) sale.postbackUrl = siteUrl + "/api/blackcat-webhook";

    const transaction = await createSale(sale);
    if (
      !transaction || typeof transaction.transactionId !== "string" ||
      !transaction.paymentData || typeof transaction.paymentData.copyPaste !== "string"
    ) {
      throw new BlackCatError("O provedor não retornou um PIX válido.", 502, "INVALID_PIX_RESPONSE");
    }

    return res.status(201).json({
      success: true,
      data: {
        transactionId: transaction.transactionId,
        status: transaction.status || "PENDING",
        amount,
        qrCodeBase64: transaction.paymentData.qrCodeBase64 || "",
        copyPaste: transaction.paymentData.copyPaste,
        expiresAt: transaction.paymentData.expiresAt || ""
      }
    });
  } catch (error) {
    return sendError(res, error);
  }
};

module.exports._test = {
  buildItems,
  buildCustomer,
  buildShipping,
  validDocument
};
