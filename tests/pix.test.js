const test = require("node:test");
const assert = require("node:assert/strict");

const pixHandler = require("../api/pix");

function responseRecorder() {
  return {
    statusCode: 200,
    headers: {},
    payload: null,
    setHeader(name, value) { this.headers[name] = value; },
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.payload = payload; return this; }
  };
}

test("calculates PIX prices from the server catalog", () => {
  const items = pixHandler._test.buildItems([
    { id: "kit-3-oversized", qty: 2, size: "M", color: "Preto", price: 1 }
  ]);
  assert.equal(items[0].unitPrice, 5391);
  assert.equal(items[0].quantity, 2);
  assert.match(items[0].title, /M \/ Preto/);
});

test("validates CPF and rejects unknown products", () => {
  assert.equal(pixHandler._test.validDocument("52998224725"), true);
  assert.equal(pixHandler._test.validDocument("11111111111"), false);
  assert.throws(
    () => pixHandler._test.buildItems([{ id: "produto-inexistente", qty: 1 }]),
    /produto do carrinho/i
  );
});

test("creates a BlackCat sale without exposing the API key", async (t) => {
  process.env.BLACKCAT_API_KEY = "test-secret";
  process.env.PUBLIC_SITE_URL = "https://alpha.example";
  const originalFetch = global.fetch;
  let providerRequest;
  global.fetch = async (url, options) => {
    providerRequest = { url, options, body: JSON.parse(options.body) };
    return {
      ok: true,
      status: 201,
      async json() {
        return {
          success: true,
          data: {
            transactionId: "TXN-TEST-12345",
            status: "PENDING",
            paymentData: {
              copyPaste: "000201-pix-test",
              qrCodeBase64: "data:image/png;base64,AAAA",
              expiresAt: "2030-01-01T00:00:00.000Z"
            }
          }
        };
      }
    };
  };
  t.after(() => {
    global.fetch = originalFetch;
    delete process.env.BLACKCAT_API_KEY;
    delete process.env.PUBLIC_SITE_URL;
  });

  const req = {
    method: "POST",
    headers: { "content-length": "100", "x-forwarded-for": "203.0.113.10" },
    socket: {},
    body: {
      items: [{ id: "kit-3-oversized", qty: 1, size: "M", color: "Preto" }],
      customer: {
        name: "Maria da Silva",
        email: "maria@example.com",
        phone: "11999999999",
        document: "52998224725"
      },
      shipping: {
        name: "Maria da Silva",
        street: "Rua Exemplo",
        number: "10",
        neighborhood: "Centro",
        city: "São Paulo",
        state: "SP",
        zipCode: "01001000"
      }
    }
  };
  const res = responseRecorder();

  await pixHandler(req, res);

  assert.equal(res.statusCode, 201);
  assert.equal(res.payload.success, true);
  assert.equal(res.payload.data.amount, 5391);
  assert.equal(providerRequest.url, "https://api.blackcatoficial.com/api/sales/create-sale");
  assert.equal(providerRequest.options.headers["X-API-Key"], "test-secret");
  assert.equal(providerRequest.body.amount, 5391);
  assert.equal(providerRequest.body.postbackUrl, "https://alpha.example/api/blackcat-webhook");
  assert.equal(JSON.stringify(res.payload).includes("test-secret"), false);
});
