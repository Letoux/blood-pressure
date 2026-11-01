import { describe, expect, it } from "vitest";
import { parsePushMessage } from "./push-message";

/** Le service worker ouvre `new URL(url, origine)` : un chemin qui en sortirait doit être refusé. */
describe("page ouverte par une notification", () => {
  it.each(["/\\evil.example", "/\\/evil.example/x", "/\t/evil.example", "\\\\evil.example"])(
    "refuse un chemin que le navigateur résout vers un autre site : %j",
    (url) => {
      expect(parsePushMessage(JSON.stringify({ title: "T", url }), "App").url).toBe("/");
    },
  );

  it("garde un chemin de l'app avec sa requête et son ancre", () => {
    expect(parsePushMessage(JSON.stringify({ title: "T", url: "/entry?slot=morning#form" }), "App").url).toBe(
      "/entry?slot=morning#form",
    );
  });
});
