import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { storefrontThemeStyle } from "@/components/storefront/storefront-theme";
import type { StorefrontTheme } from "@/data/storefront";

const css = readFileSync(fileURLToPath(new URL("../storefront.css", import.meta.url)), "utf8");

/** Every `--shop-*` custom property the storefront stylesheet lets a shop override. */
const cssVariables = [...new Set(css.match(/--shop-[a-z-]+/g) ?? [])].sort();

/** The inline style as React will serialise it: custom properties as plain keys. */
function vars(theme: StorefrontTheme): Record<string, string | undefined> {
  return storefrontThemeStyle(theme) as Record<string, string | undefined>;
}

describe("storefront theme reaches the render", () => {
  it("emits exactly the custom properties the stylesheet declares", () => {
    expect(Object.keys(vars({})).sort()).toEqual(cssVariables);
    expect(cssVariables.length).toBeGreaterThan(0);
  });

  it("leaves an unset token undefined so the stylesheet fallback wins", () => {
    // React drops undefined style values; a "" or a colour here would shadow the
    // app-theme fallback that storefront.css declares on `.storefront`.
    expect(vars({})).toEqual({
      "--shop-accent": undefined,
      "--shop-background": undefined,
      "--shop-surface": undefined,
      "--shop-text": undefined,
      "--shop-muted": undefined,
    });
  });

  it("passes a seller's colour through untouched", () => {
    const style = vars({ accent: "#c2410c", background: "#fffdf8" });

    expect(style["--shop-accent"]).toBe("#c2410c");
    expect(style["--shop-background"]).toBe("#fffdf8");
    expect(style["--shop-text"]).toBeUndefined();
  });
});
