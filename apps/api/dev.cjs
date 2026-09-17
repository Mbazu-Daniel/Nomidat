const { spawn } = require("node:child_process");
const path = require("node:path");

const cwd = __dirname;
const compiler = path.join(path.dirname(require.resolve("typescript/package.json")), "bin/tsc");
const children = new Set();
let stopping = false;

function stop(code) {
  if (stopping) return;
  stopping = true;
  process.exitCode = code;
  for (const child of children) child.kill("SIGTERM");
  const timeout = setTimeout(() => {
    for (const child of children) child.kill("SIGKILL");
  }, 5000);
  timeout.unref();
}

function run(args, onSuccess) {
  const child = spawn(process.execPath, args, { cwd, stdio: "inherit" });
  children.add(child);
  child.on("error", (error) => {
    console.error(error.message);
    children.delete(child);
    stop(1);
  });
  child.on("exit", (code) => {
    children.delete(child);
    if (stopping) return;
    if (code === 0 && onSuccess) onSuccess();
    else stop(code ?? 1);
  });
}

process.on("SIGINT", () => stop(130));
process.on("SIGTERM", () => stop(143));

run([compiler, "-p", "tsconfig.json"], () => {
  run([compiler, "-p", "tsconfig.json", "--watch", "--preserveWatchOutput"]);
  run([
    "--watch",
    "--watch-preserve-output",
    "--env-file-if-exists=../../.env",
    "--env-file-if-exists=.env",
    "dist/main.js",
  ]);
});
