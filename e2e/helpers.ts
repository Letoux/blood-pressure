import { test as base, type APIRequestContext, type Page } from "@playwright/test";
import { e2eAdmin } from "./env";

/**
 * `test` de Playwright où chaque test a sa propre adresse IP cliente (`x-forwarded-for`) :
 * la limite de connexions par IP (`SIGN_IN_RATE_LIMIT`) ne se partage pas entre les tests.
 */
export const test = base.extend({
  extraHTTPHeaders: async ({ extraHTTPHeaders }, provide) => {
    const octet = () => Math.floor(Math.random() * 256);
    await provide({ ...extraHTTPHeaders, "x-forwarded-for": `10.${octet()}.${octet()}.${octet()}` });
  },
});

export type E2eUser = { email: string; name: string; password: string };

/** Un utilisateur neuf : la base E2E persiste d'un lancement à l'autre. */
export function uniqueUser(name: string): E2eUser {
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  return { email: `${name.toLowerCase()}-${id}@e2e.test`, name, password: `${name.toLowerCase()}-password` };
}

/**
 * Crée l'utilisateur par l'API better-auth, avec une session admin séparée de celle de la page.
 * Sauf `{ onboarded: false }`, le premier lancement est marqué comme vu : la connexion mène
 * directement à l'accueil.
 */
export async function createUserAsAdmin(
  request: APIRequestContext,
  user: E2eUser,
  { onboarded = true }: { onboarded?: boolean } = {},
) {
  const signIn = await request.post("/api/auth/sign-in/email", {
    data: { email: e2eAdmin.email, password: e2eAdmin.password },
  });
  if (!signIn.ok()) throw new Error(`connexion admin refusée (${signIn.status()})`);
  // Avec un cookie de session, better-auth exige l'en-tête Origin (protection CSRF).
  const created = await request.post("/api/auth/admin/create-user", {
    data: { ...user, role: "user" },
    headers: { origin: new URL(signIn.url()).origin },
  });
  if (!created.ok()) throw new Error(`création refusée (${created.status()}) : ${await created.text()}`);
  if (onboarded) await skipOnboarding(request, user, new URL(signIn.url()).origin);
}

/** Marque le premier lancement comme vu, avec une session de l'utilisateur (protocole RPC d'oRPC). */
async function skipOnboarding(request: APIRequestContext, user: E2eUser, origin: string) {
  const signIn = await request.post("/api/auth/sign-in/email", {
    data: { email: user.email, password: user.password },
    headers: { origin },
  });
  if (!signIn.ok()) throw new Error(`connexion refusée (${signIn.status()})`);
  const updated = await request.post("/rpc/settings/update", { data: { json: { onboarded: true } } });
  if (!updated.ok()) throw new Error(`réglage refusé (${updated.status()}) : ${await updated.text()}`);
}

/** Connexion par le formulaire, quelle que soit la langue de la page. */
export async function signIn(page: Page, user: { email: string; password: string }) {
  await page.goto("/login");
  await page.locator('input[name="email"]').fill(user.email);
  await page.locator('input[name="password"]').fill(user.password);
  await page.locator('button[type="submit"]').click();
}
