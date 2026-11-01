import { describe, expect, it } from "vitest";
import en from "./messages/en.json";
import fr from "./messages/fr.json";

type Catalog = { [key: string]: string | Catalog };

/** Feuilles d'un catalogue, par chemin (`nav.home`, `settings.theme.dark`…). */
function leaves(catalog: Catalog, prefix = ""): [string, string][] {
  return Object.entries(catalog).flatMap(([key, value]): [string, string][] => {
    const path = prefix ? `${prefix}.${key}` : key;
    return typeof value === "string" ? [[path, value]] : leaves(value, path);
  });
}

const keysOf = (catalog: Catalog) => leaves(catalog).map(([path]) => path).sort();

describe("catalogues de traduction", () => {
  it("le français et l'anglais ont exactement les mêmes clés", () => {
    expect(keysOf(en)).toEqual(keysOf(fr));
  });

  it("aucun texte n'est vide", () => {
    for (const catalog of [fr, en]) {
      expect(leaves(catalog).filter(([, text]) => text.trim() === "")).toEqual([]);
    }
  });
});
