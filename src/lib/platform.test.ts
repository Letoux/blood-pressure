import { describe, expect, it } from "vitest";
import { detectPlatform } from "./platform";

const ua = {
  iphone:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1",
  // Depuis iPadOS 13, Safari se présente comme un Mac : seul l'écran tactile le trahit.
  ipad: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Safari/605.1.15",
  mac: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Safari/605.1.15",
  android:
    "Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36",
  windows:
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
  linux: "Mozilla/5.0 (X11; Linux x86_64; rv:132.0) Gecko/20100101 Firefox/132.0",
};

describe("système de l'appareil, pour les instructions d'installation", () => {
  it("reconnaît l'iPhone et l'iPad", () => {
    expect(detectPlatform(ua.iphone, 5)).toBe("ios");
    expect(detectPlatform(ua.ipad, 5)).toBe("ios");
  });

  it("reconnaît Android", () => {
    expect(detectPlatform(ua.android, 5)).toBe("android");
  });

  it("considère le reste comme un ordinateur", () => {
    expect(detectPlatform(ua.mac, 0)).toBe("desktop");
    expect(detectPlatform(ua.windows, 0)).toBe("desktop");
    expect(detectPlatform(ua.linux, 0)).toBe("desktop");
  });
});
