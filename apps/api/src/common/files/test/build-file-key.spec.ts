import { describe, expect, it } from "vitest";
import { buildFileKey } from "../build-file-key";
import { FileLocation } from "../types/file-location.type";

const ORG = "3f1c9a20-6d5e-4a1b-9c33-8f2b7e5d0a11";
/** The unique segment plus the dash that follows it. */
const UNIQUE = "[0-9a-f]{12}-";

describe("buildFileKey", () => {
  it("lays out the key as organization, location, unique name", () => {
    expect(buildFileKey(ORG, FileLocation.PRODUCT_IMAGES, "jollof.jpg")).toMatch(
      new RegExp(`^${ORG}/product-images/${UNIQUE}jollof\\.jpg$`),
    );
  });

  it("keeps a normal file name readable after the unique segment", () => {
    expect(buildFileKey(ORG, FileLocation.AVATARS, "ada-lovelace_2026.jpeg")).toMatch(
      new RegExp(`^${ORG}/avatars/${UNIQUE}ada-lovelace_2026\\.jpeg$`),
    );
  });

  it("never reuses a key, even for the same name twice", () => {
    // The whole reason a unique segment exists: two uploads called `photo.jpg`
    // must not destroy each other.
    const first = buildFileKey(ORG, FileLocation.PRODUCT_IMAGES, "photo.jpg");
    const second = buildFileKey(ORG, FileLocation.PRODUCT_IMAGES, "photo.jpg");
    expect(first).not.toBe(second);
  });

  it.each([
    ["a traversal attempt", "../../../etc/passwd"],
    ["a backslash separator", "..\\..\\windows\\system32"],
    ["a mixed separator", "a/b\\c.jpg"],
    ["a newline", "photo\n.jpg"],
    ["a carriage return", "photo\r.jpg"],
    ["a null byte", "photo\0.jpg"],
    ["only dots", "..."],
    ["a leading dot", ".hidden.jpg"],
  ])("neutralises %s", (_label, fileName) => {
    const key = buildFileKey(ORG, FileLocation.PRODUCT_IMAGES, fileName);
    const [, , leaf] = key.split("/");
    expect(leaf).not.toBe("");
    expect(leaf).not.toBe("..");
    expect(leaf).not.toContain("/");
    expect(leaf).not.toContain("\\");
    expect(leaf).not.toMatch(/[\n\r\0]/);
    expect(key.startsWith(`${ORG}/product-images/`)).toBe(true);
  });

  it("replaces characters outside the safe set rather than failing", () => {
    expect(buildFileKey(ORG, FileLocation.PRODUCT_IMAGES, "Creme brûlée.jpg")).toMatch(
      new RegExp(`^${ORG}/product-images/${UNIQUE}Creme-br-l-e\\.jpg$`),
    );
  });

  it("caps a very long name so the key stays readable", () => {
    const leaf = buildFileKey(ORG, FileLocation.PRODUCT_IMAGES, `${"a".repeat(500)}.jpg`).split(
      "/",
    )[2]!;
    expect(leaf.length).toBeLessThanOrEqual(120 + 13);
  });

  it("still produces a usable key for a name made only of unsafe characters", () => {
    expect(buildFileKey(ORG, FileLocation.PRODUCT_IMAGES, "///")).toMatch(
      new RegExp(`^${ORG}/product-images/${UNIQUE}---$`),
    );
  });

  it("separates organizations so one cannot overwrite another's file", () => {
    const mine = buildFileKey(ORG, FileLocation.PRODUCT_IMAGES, "photo.jpg");
    const theirs = buildFileKey(
      "00000000-0000-4000-8000-000000000000",
      FileLocation.PRODUCT_IMAGES,
      "photo.jpg",
    );
    expect(mine.split("/")[0]).not.toBe(theirs.split("/")[0]);
  });
});
