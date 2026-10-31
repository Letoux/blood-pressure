import type { MetadataRoute } from "next";
import { getTranslations } from "next-intl/server";
import { webManifest } from "@/lib/web-manifest";

/** `/manifest.webmanifest`, dans la langue du visiteur. */
export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const t = await getTranslations("app");
  return webManifest({ name: t("name"), description: t("description") });
}
