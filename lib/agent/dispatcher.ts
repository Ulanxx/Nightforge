import { spawn } from "node:child_process";

export function dispatchBackgroundRun(url: string, body: Record<string, unknown>) {
  const child = spawn("curl", ["-s", "-X", "POST", url, "-H", "Content-Type: application/json", "-d", JSON.stringify(body)], {
    detached: true,
    stdio: "ignore"
  });

  child.unref();
}
