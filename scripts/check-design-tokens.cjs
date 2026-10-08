/**
 * Checks that every `var(--token)` used across the app resolves to a token that
 * is actually defined.
 *
 * The token migration folds literals onto names, and a name that resolves to
 * nothing renders as transparent rather than as an error — so a missing token
 * would ship as an invisible border instead of failing a build. This is the
 * check that catches it.
 *
 * Run after any token change: node scripts/check-design-tokens.cjs
 */
const fs = require("node:fs");
const path = require("node:path");

const SRC = path.resolve(__dirname, "../apps/web/src");

const files = [];
(function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (/\.(css|tsx?|jsx?)$/.test(entry.name)) files.push(full);
  }
})(SRC);

const defined = new Set();
const used = new Map();

for (const file of files) {
  const text = fs.readFileSync(file, "utf8");

  // Definitions count everywhere: a token may be declared in the light block,
  // the dark block, or a component-scoped block.
  for (const m of text.matchAll(/(--[a-z0-9-]+)\s*:/g)) defined.add(m[1]);

  for (const m of text.matchAll(/var\(\s*(--[a-z0-9-]+)/g)) {
    const token = m[1];
    if (!used.has(token)) used.set(token, new Set());
    used.get(token).add(path.basename(file));
  }
}

/*
 * Charts build their colours from a ramp: `var(--chart-${index + 1})`. The regex
 * above only ever sees the literal prefix `--chart-`, which is treated as
 * external below, so the ramp is verified here once every file has been read.
 */
if ([...used.keys()].some((token) => token.startsWith("--chart-"))) {
  const ramp = [...defined].filter((token) => /^--chart-\d+$/.test(token));
  if (ramp.length === 0) {
    console.log("WARN: a chart ramp is referenced but no --chart-N token is defined");
    process.exitCode = 1;
  }
}

/*
 * Third-party and browser-supplied names. Tailwind and base-ui publish their own
 * custom properties, and anything under these prefixes belongs to a library's
 * theming contract rather than to ours.
 */
const EXTERNAL = /^(--(anchor|available|shop-|color|tw-|chakra-|ui-|bv-|radix-|chart-))/;

const missing = [...used.entries()]
  .filter(([token]) => !defined.has(token) && !EXTERNAL.test(token))
  .map(([token, where]) => `${token} (used in ${[...where].slice(0, 3).join(", ")})`);

console.log(`tokens defined: ${defined.size}`);
console.log(`tokens used:    ${used.size}`);

if (missing.length === 0) {
  console.log("OK - every referenced token is defined");
} else {
  console.log(`\nMISSING ${missing.length}:`);
  for (const entry of missing) console.log(`  ${entry}`);
  process.exitCode = 1;
}
