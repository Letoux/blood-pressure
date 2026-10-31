import { describe, expect, it } from "vitest";
import { applicationServerKey } from "./push-client";

describe("clé VAPID pour `pushManager.subscribe`", () => {
  it("décode le base64url (sans remplissage) en octets", () => {
    // « hello?> » : en base64 `aGVsbG8/Pg==`, en base64url `aGVsbG8_Pg`.
    expect(Array.from(applicationServerKey("aGVsbG8_Pg"))).toEqual([104, 101, 108, 108, 111, 63, 62]);
  });

  it("une clé publique P-256 fait 65 octets, le premier vaut 4 (point non compressé)", () => {
    const key = applicationServerKey(`BA${"A".repeat(85)}`);
    expect(key).toHaveLength(65);
    expect(key[0]).toBe(4);
  });
});
