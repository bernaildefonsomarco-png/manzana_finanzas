import { spawn } from "node:child_process";
import { createInterface } from "node:readline";

const child = spawn("npx", ["-y", "@_davideast/stitch-mcp", "proxy"], {
  stdio: ["pipe", "pipe", "inherit"],
  shell: true,
});

const rl = createInterface({ input: child.stdout });

rl.on("line", (raw) => {
  try {
    const msg = JSON.parse(raw);
    if (msg?.result?.tools && Array.isArray(msg.result.tools)) {
      msg.result.tools = msg.result.tools.map(({ outputSchema, ...rest }) => rest);
    }
    process.stdout.write(JSON.stringify(msg) + "\n");
  } catch {
    process.stdout.write(raw + "\n");
  }
});

process.stdin.on("data", (chunk) => child.stdin.write(chunk));
child.on("exit", (code) => process.exit(code ?? 0));
process.on("SIGTERM", () => child.kill());
process.on("SIGINT", () => child.kill());
