export default function Home() {
  return (
    <main style={{ fontFamily: "monospace", padding: "2rem", maxWidth: 700 }}>
      <h1>Fiat402</h1>
      <p>x402 protocol middleware — pay 402-gated APIs with Stripe instead of crypto.</p>
      <h2>Endpoints</h2>
      <ul>
        <li><code>POST /api/register/consumer</code> — Register an org</li>
        <li><code>POST /api/register/consumer/payment-method</code> — Attach payment method</li>
        <li><code>POST /api/register/provider</code> — Register a 402-gated API</li>
        <li><code>POST /api/facilitate</code> — Pay for an API call, get a signed proof JWT</li>
        <li><code>POST /api/verify</code> — Validate a proof JWT</li>
        <li><code>GET /api/dashboard/transactions</code> — Transaction history</li>
        <li><code>GET /.well-known/fiat402-jwks</code> — Public key (JWKS)</li>
      </ul>
      <p><a href="/test">Test harness &rarr;</a></p>
    </main>
  );
}
