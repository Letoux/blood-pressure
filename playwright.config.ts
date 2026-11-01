import { defineConfig, devices } from "@playwright/test";
import { e2eServerEnv } from "./e2e/env";

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
  // Pas de nouvel essai : un test instable doit échouer, pas passer en silence.
  retries: 0,
  // En local (`pnpm dev`), chaque route se compile à sa première visite : avec trop de workers,
  // ces compilations dépassent les délais des `expect`. En CI, le serveur est déjà construit.
  workers: isCi ? undefined : 2,
  reporter: isCi ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL,
    trace: "retain-on-failure",
  },
  projects: [
    // Pensée mobile d'abord. Navigateur en français, sauf test qui choisit une autre langue.
    { name: "mobile", use: { ...devices["Pixel 7"], locale: "fr-FR" } },
  ],
  webServer: {
    command: `pnpm db:migrate && ${serve}`,
    url: `${baseURL}/health`,
    env: e2eServerEnv(baseURL),
    reuseExistingServer: !isCi,
    timeout: 120_000,
  },
});
