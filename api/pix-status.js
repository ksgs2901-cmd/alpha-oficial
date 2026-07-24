const { BlackCatError, getSaleStatus } = require("../server/blackcat");

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ success: false, message: "Método não permitido." });
  }

  const transactionId = String(req.query && req.query.id || "");
  if (!/^[A-Za-z0-9_-]{8,100}$/.test(transactionId)) {
    return res.status(400).json({ success: false, message: "Transação inválida." });
  }

  try {
    const transaction = await getSaleStatus(transactionId);
    if (!transaction || transaction.transactionId !== transactionId) {
      throw new BlackCatError("Resposta inválida do serviço PIX.", 502, "INVALID_PIX_RESPONSE");
    }
    return res.status(200).json({
      success: true,
      data: {
        transactionId,
        status: String(transaction.status || "PENDING").toUpperCase(),
        amount: transaction.amount,
        paidAt: transaction.paidAt || null
      }
    });
  } catch (error) {
    const known = error instanceof BlackCatError;
    return res.status(known ? error.statusCode : 500).json({
      success: false,
      message: known ? error.message : "Não foi possível consultar o pagamento."
    });
  }
};
