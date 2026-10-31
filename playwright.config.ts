import { defineConfig, devices } from "@playwright/test";

// Les tests E2E tournent contre l'app servie avec `DATABASE_URL` (une vraie base).
// En CI, l'app est déjà construite (`pnpm build`) : serveur standalone, comme dans l'image.
// En local : `pnpm dev`.
const port = Number(process.env.E2E_PORT ?? 3100);
const baseURL = `http://localhost:${port}`;
const isCi = Boolean(process.env.CI);
const serve = isCi ? `PORT=${port} pnpm start` : `pnpm dev --port ${port}`;

export default defineConfig({
  testDir: "./e2e",
  forbidOnly: isCi,
  retries: isCi ? 1 : 0,
  reporter: isCi ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL,
    trace: "retain-on-failure",
  },
  projects: [
    // Pensée mobile d'abord.
    { name: "mobile", use: { ...devices["Pixel 7"] } },
  ],
  webServer: {
    command: `pnpm db:migrate && ${serve}`,
    url: `${baseURL}/health`,
    reuseExistingServer: !isCi,
    timeout: 120_000,
  },
});
