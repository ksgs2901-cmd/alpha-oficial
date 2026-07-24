const { getSaleStatus } = require("../server/blackcat");

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ received: false });
  }

  const body = req.body && typeof req.body === "object" ? req.body : {};
  const transactionId = String(body.transactionId || "");
  if (!/^[A-Za-z0-9_-]{8,100}$/.test(transactionId)) {
    return res.status(400).json({ received: false });
  }

  try {
    // BlackCat does not document a webhook signature. Confirm every event
    // through its authenticated status endpoint before trusting it.
    const verified = await getSaleStatus(transactionId);
    if (!verified || verified.transactionId !== transactionId) {
      return res.status(400).json({ received: false });
    }
    if (body.amount != null && Number(body.amount) !== Number(verified.amount)) {
      return res.status(400).json({ received: false });
    }
    return res.status(200).json({
      received: true,
      transactionId,
      status: String(verified.status || "").toUpperCase()
    });
  } catch (error) {
    // A non-200 response asks BlackCat to retry when verification is unavailable.
    return res.status(503).json({ received: false });
  }
};
