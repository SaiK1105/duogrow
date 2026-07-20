// Polls the API health endpoint until it responds, then exits 0. Used by
// `npm run dev` to start the Vite dev server only AFTER the API is up.
//
// Why: on Windows, when `tsx watch` (API) and Vite (web) both cold-start their
// esbuild service at the exact same instant, they occasionally race and wedge
// the API worker before it can bind. Staggering the two boots avoids it. This
// is a dev-only concern — production runs a single process (`npm start`).
const port = process.env.API_PORT || "8787";
const url = `http://localhost:${port}/api/health`;
const timeoutMs = 40000;
const start = Date.now();

while (Date.now() - start < timeoutMs) {
  try {
    const res = await fetch(url);
    if (res.ok) {
      console.log(`[dev] API ready on :${port} — starting web…`);
      process.exit(0);
    }
  } catch {
    // API not up yet; keep polling.
  }
  await new Promise((resolve) => setTimeout(resolve, 500));
}

console.error(`[dev] API not ready on :${port} after ${timeoutMs}ms — starting web anyway.`);
process.exit(0);
