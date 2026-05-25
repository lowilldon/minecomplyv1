import { NextResponse } from "next/server";

const html = /* html */`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Fiat402 Test Harness</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; }
    body { font-family: monospace; background: #0f0f0f; color: #e0e0e0; padding: 2rem; max-width: 900px; margin: 0 auto; }
    h1 { color: #7dd3fc; }
    h2 { color: #a5f3fc; border-bottom: 1px solid #333; padding-bottom: 0.25rem; }
    .card { background: #1a1a1a; border: 1px solid #333; border-radius: 8px; padding: 1.5rem; margin-bottom: 1.5rem; }
    label { display: block; margin-bottom: 0.25rem; font-size: 0.85rem; color: #94a3b8; }
    input, textarea { width: 100%; padding: 0.5rem; background: #111; border: 1px solid #444; color: #e0e0e0; border-radius: 4px; margin-bottom: 0.75rem; font-family: monospace; }
    button { background: #0ea5e9; color: #fff; border: none; padding: 0.5rem 1.25rem; border-radius: 4px; cursor: pointer; font-family: monospace; }
    button:hover { background: #0284c7; }
    .result { background: #111; border: 1px solid #2d5; border-radius: 4px; padding: 0.75rem; margin-top: 0.75rem; white-space: pre-wrap; font-size: 0.8rem; color: #4ade80; }
    .error { border-color: #f87171; color: #f87171; }
    .note { font-size: 0.75rem; color: #64748b; margin-top: 0.25rem; }
    .badge { display: inline-block; background: #1e3a5f; color: #7dd3fc; border-radius: 3px; padding: 0.1rem 0.4rem; font-size: 0.75rem; margin-bottom: 0.5rem; }
  </style>
</head>
<body>
  <h1>Fiat402 — Test Harness</h1>
  <p class="note">Local testing only. Do not deploy to production.</p>

  <!-- Step 1: Register Consumer -->
  <div class="card">
    <h2>1. Register Consumer Org</h2>
    <span class="badge">POST /api/register/consumer</span>
    <label>Name</label>
    <input id="reg-name" value="Acme Corp" />
    <label>Email</label>
    <input id="reg-email" value="test@acme.com" />
    <button onclick="registerConsumer()">Register</button>
    <div id="reg-result" class="result" style="display:none"></div>
  </div>

  <!-- Step 2: Attach Payment Method -->
  <div class="card">
    <h2>2. Attach Payment Method</h2>
    <span class="badge">POST /api/register/consumer/payment-method</span>
    <label>Org ID (from step 1)</label>
    <input id="pm-org-id" placeholder="paste org_id" />
    <label>Stripe Payment Method ID</label>
    <input id="pm-id" placeholder="pm_card_visa (Stripe test PM)" value="pm_card_visa" />
    <p class="note">In Stripe test mode use pm_card_visa, pm_card_mastercard, etc.</p>
    <button onclick="attachPaymentMethod()">Attach</button>
    <div id="pm-result" class="result" style="display:none"></div>
  </div>

  <!-- Step 3: Register Provider -->
  <div class="card">
    <h2>3. Register Provider (402-gated API)</h2>
    <span class="badge">POST /api/register/provider</span>
    <label>Org API Key (from step 1)</label>
    <input id="prov-api-key" placeholder="paste api_key" />
    <label>Provider Name</label>
    <input id="prov-name" value="Weather API Pro" />
    <label>Endpoint URL</label>
    <input id="prov-url" value="https://api.example.com/weather" />
    <label>Price (USD)</label>
    <input id="prov-price" type="number" value="0.005" step="0.001" min="0.001" />
    <button onclick="registerProvider()">Register</button>
    <div id="prov-result" class="result" style="display:none"></div>
  </div>

  <!-- Step 4: Facilitate (agent pays) -->
  <div class="card">
    <h2>4. Simulate Agent Payment</h2>
    <span class="badge">POST /api/facilitate</span>
    <label>Org API Key</label>
    <input id="fac-api-key" placeholder="paste api_key" />
    <label>Provider ID (from step 3)</label>
    <input id="fac-provider-id" placeholder="paste provider_id" />
    <button onclick="facilitate()">Pay &amp; Get Proof JWT</button>
    <div id="fac-result" class="result" style="display:none"></div>
  </div>

  <!-- Step 5: Verify proof -->
  <div class="card">
    <h2>5. Verify Proof</h2>
    <span class="badge">POST /api/verify</span>
    <label>Provider API Key (from step 3)</label>
    <input id="ver-provider-key" placeholder="paste provider_api_key" />
    <label>Proof JWT (from step 4)</label>
    <textarea id="ver-proof" rows="4" placeholder="paste proof JWT"></textarea>
    <button onclick="verifyProof()">Verify</button>
    <div id="ver-result" class="result" style="display:none"></div>
  </div>

  <!-- Step 6: Transactions -->
  <div class="card">
    <h2>6. View Transactions</h2>
    <span class="badge">GET /api/dashboard/transactions</span>
    <label>Org API Key</label>
    <input id="txn-api-key" placeholder="paste api_key" />
    <button onclick="getTransactions()">Fetch</button>
    <div id="txn-result" class="result" style="display:none"></div>
  </div>

  <!-- Step 7: JWKS -->
  <div class="card">
    <h2>7. JWKS Public Key</h2>
    <span class="badge">GET /.well-known/fiat402-jwks</span>
    <button onclick="getJwks()">Fetch JWKS</button>
    <div id="jwks-result" class="result" style="display:none"></div>
  </div>

  <script>
    function show(id, data, isError) {
      const el = document.getElementById(id);
      el.style.display = 'block';
      el.className = 'result' + (isError ? ' error' : '');
      el.textContent = JSON.stringify(data, null, 2);
    }

    async function post(url, body, apiKey) {
      const headers = { 'Content-Type': 'application/json' };
      if (apiKey) headers['Authorization'] = 'Bearer ' + apiKey;
      const r = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) });
      return [await r.json(), !r.ok];
    }

    async function get(url, apiKey) {
      const headers = {};
      if (apiKey) headers['Authorization'] = 'Bearer ' + apiKey;
      const r = await fetch(url, { headers });
      return [await r.json(), !r.ok];
    }

    async function registerConsumer() {
      const [data, err] = await post('/api/register/consumer', {
        name: document.getElementById('reg-name').value,
        email: document.getElementById('reg-email').value,
      });
      show('reg-result', data, err);
      if (!err) {
        document.getElementById('pm-org-id').value = data.org_id || '';
        document.getElementById('fac-api-key').value = data.api_key || '';
        document.getElementById('prov-api-key').value = data.api_key || '';
        document.getElementById('txn-api-key').value = data.api_key || '';
      }
    }

    async function attachPaymentMethod() {
      const [data, err] = await post('/api/register/consumer/payment-method', {
        org_id: document.getElementById('pm-org-id').value,
        stripe_payment_method_id: document.getElementById('pm-id').value,
      });
      show('pm-result', data, err);
    }

    async function registerProvider() {
      const [data, err] = await post('/api/register/provider', {
        name: document.getElementById('prov-name').value,
        endpoint_url: document.getElementById('prov-url').value,
        price_usd: parseFloat(document.getElementById('prov-price').value),
      }, document.getElementById('prov-api-key').value);
      show('prov-result', data, err);
      if (!err) {
        document.getElementById('fac-provider-id').value = data.provider_id || '';
        document.getElementById('ver-provider-key').value = data.provider_api_key || '';
      }
    }

    async function facilitate() {
      const [data, err] = await post('/api/facilitate', {
        provider_id: document.getElementById('fac-provider-id').value,
      }, document.getElementById('fac-api-key').value);
      show('fac-result', data, err);
      if (!err && data.proof) {
        document.getElementById('ver-proof').value = data.proof;
      }
    }

    async function verifyProof() {
      const [data, err] = await post('/api/verify', {
        proof: document.getElementById('ver-proof').value,
      }, document.getElementById('ver-provider-key').value);
      show('ver-result', data, err);
    }

    async function getTransactions() {
      const [data, err] = await get('/api/dashboard/transactions', document.getElementById('txn-api-key').value);
      show('txn-result', data, err);
    }

    async function getJwks() {
      const [data, err] = await get('/.well-known/fiat402-jwks');
      show('jwks-result', data, err);
    }
  </script>
</body>
</html>`;

export async function GET() {
  return new NextResponse(html, {
    headers: { "Content-Type": "text/html" },
  });
}
