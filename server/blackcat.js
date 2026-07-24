const API_BASE = "https://api.blackcatoficial.com/api";

class BlackCatError extends Error {
  constructor(message, statusCode, code) {
    super(message);
    this.name = "BlackCatError";
    this.statusCode = statusCode || 502;
    this.code = code || "BLACKCAT_ERROR";
  }
}

async function requestBlackCat(path, options) {
  const apiKey = process.env.BLACKCAT_API_KEY;
  if (!apiKey) {
    throw new BlackCatError("A integração PIX ainda não foi configurada.", 503, "PIX_NOT_CONFIGURED");
  }

  let response;
  try {
    response = await fetch(API_BASE + path, {
      method: options && options.method ? options.method : "GET",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": apiKey
      },
      body: options && options.body ? JSON.stringify(options.body) : undefined,
      signal: AbortSignal.timeout(12000)
    });
  } catch (error) {
    throw new BlackCatError("O serviço PIX está temporariamente indisponível.", 502, "PIX_UNAVAILABLE");
  }

  let payload;
  try {
    payload = await response.json();
  } catch (error) {
    throw new BlackCatError("Resposta inválida do serviço PIX.", 502, "INVALID_PIX_RESPONSE");
  }

  if (!response.ok || !payload || payload.success === false) {
    const publicMessage = payload && typeof payload.message === "string"
      ? payload.message.slice(0, 180)
      : "Não foi possível processar o PIX.";
    throw new BlackCatError(publicMessage, response.status >= 500 ? 502 : 422, "PIX_REJECTED");
  }

  return payload.data;
}

function createSale(payload) {
  return requestBlackCat("/sales/create-sale", { method: "POST", body: payload });
}

function getSaleStatus(transactionId) {
  return requestBlackCat("/sales/" + encodeURIComponent(transactionId) + "/status");
}

module.exports = {
  BlackCatError,
  createSale,
  getSaleStatus
};
