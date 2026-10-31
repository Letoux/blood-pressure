import { describe, expect, it } from "vitest";
import { draftStore } from "./draft";

/** Un `Storage` en mémoire, comme `localStorage`. */
function memoryStorage(): Storage {
  const data = new Map<string, string>();
  return {
    get length() {
      return data.size;
    },
    key: (index) => [...data.keys()][index] ?? null,
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => void data.set(key, String(value)),
    removeItem: (key) => void data.delete(key),
    clear: () => data.clear(),
  };
}

/** Un `Storage` qui refuse tout, comme Safari en navigation privée ou un quota plein. */
function brokenStorage(): Storage {
  const fail = () => {
    throw new Error("SecurityError");
  };
  return { length: 0, key: fail, getItem: fail, setItem: fail, removeItem: fail, clear: fail };
}

describe("brouillon d'un formulaire", () => {
  it("retrouve ce qui a été tapé, pour le même utilisateur et le même formulaire", () => {
    const storage = memoryStorage();
    draftStore(storage, "user-1", "measurement").save({ systolic: "128" });

    expect(draftStore(storage, "user-1", "measurement").load()).toEqual({ systolic: "128" });
  });

  it("est propre à chaque utilisateur et à chaque formulaire", () => {
    const storage = memoryStorage();
    draftStore(storage, "user-1", "measurement").save({ systolic: "128" });

    expect(draftStore(storage, "user-2", "measurement").load()).toBeNull();
    expect(draftStore(storage, "user-1", "profile").load()).toBeNull();
  });

  it("disparaît une fois effacé, par exemple après l'enregistrement", () => {
    const storage = memoryStorage();
    const draft = draftStore(storage, "user-1", "measurement");
    draft.save({ systolic: "128" });
    draft.clear();

    expect(draft.load()).toBeNull();
  });

  it("ignore un contenu illisible", () => {
    const storage = memoryStorage();
    const draft = draftStore(storage, "user-1", "measurement");
    draft.save({ systolic: "128" });
    storage.setItem(storage.key(0)!, "{pas du json");

    expect(draft.load()).toBeNull();
  });

  it("ne casse pas le formulaire si le stockage est indisponible", () => {
    for (const storage of [brokenStorage(), null]) {
      const draft = draftStore(storage, "user-1", "measurement");
      expect(() => draft.save({ systolic: "128" })).not.toThrow();
      expect(draft.load()).toBeNull();
      expect(() => draft.clear()).not.toThrow();
    }
  });
});
