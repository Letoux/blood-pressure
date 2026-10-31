// Message d'une notification push : construit par le serveur (`src/server/push/`), lu par le
// service worker (`src/app/sw.ts`). Module sans dépendance, importable des deux côtés.

export type PushMessage = {
  title: string;
  body: string;
  /** Page de l'app ouverte au clic (chemin relatif, par exemple `/entry`). */
  url: string;
  /** Une notification du même `tag` remplace la précédente au lieu de s'empiler. */
  tag?: string;
};

/**
 * Le message reçu par le service worker, à partir du texte de l'événement `push`. Un message
 * illisible donne une notification générique ; une `url` qui n'est pas un chemin de l'app
 * (autre site, `//hôte`) est remplacée par l'accueil.
 */
export function parsePushMessage(text: string | null | undefined, fallbackTitle: string): PushMessage {
  let data: Record<string, unknown> = {};
  try {
    const parsed: unknown = JSON.parse(text ?? "");
    if (parsed && typeof parsed === "object") data = parsed as Record<string, unknown>;
  } catch {
    // Message illisible : notification générique.
  }
  const string = (value: unknown) => (typeof value === "string" && value.trim() !== "" ? value : undefined);
  const url = string(data.url);
  const tag = string(data.tag);
  return {
    title: string(data.title) ?? fallbackTitle,
    body: string(data.body) ?? "",
    url: url && url.startsWith("/") && !url.startsWith("//") ? url : "/",
    ...(tag ? { tag } : {}),
  };
}
