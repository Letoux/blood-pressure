// Environnement de l'app pendant les tests E2E. Valeurs de test uniquement, jamais en production.
export const e2eAdmin = {
  email: process.env.ADMIN_EMAIL ?? "admin@e2e.test",
  password: process.env.ADMIN_PASSWORD ?? "e2e-admin-password",
};

export function e2eServerEnv(baseURL: string): Record<string, string> {
  return {
    APP_URL: baseURL,
    BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET ?? "e2e-only-signing-key-e2e-only-signing-key",
    ADMIN_EMAIL: e2eAdmin.email,
    ADMIN_PASSWORD: e2eAdmin.password,
  };
}
