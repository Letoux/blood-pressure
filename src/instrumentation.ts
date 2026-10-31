// Exécuté une fois au démarrage du serveur Next.js (après les migrations, lancées par
// `docker/entrypoint.sh`). Un échec arrête le démarrage : l'admin doit pouvoir se connecter.
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { bootstrapAdmin } = await import("@/server/auth");
  await bootstrapAdmin();
}
