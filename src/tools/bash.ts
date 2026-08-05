import { spawn } from "child_process";
import type { Tool, ToolCall, ToolResultMessage } from "../types.ts";

const MAX_LINES = 2000;

export const bashTool: Tool = {
  name: "bash",
  description: `Execute a bash command in the current working directory. Returns stdout and stderr. Output is truncated to last ${MAX_LINES} lines. Optionally provide a timeout in seconds.`,
  parameters: {
    type: "object",
    properties: {
      command: { type: "string", description: "Bash command to execute" },
      timeout: {
        type: "number",
        description: "Timeout in seconds (optional, no default timeout)",
      },
    },
    required: ["command"],
  },
};

export async function executeBash(
  call: ToolCall,
  cwd: string,
): Promise<ToolResultMessage> {
  try {
    const result = await runCommand(
      call.arguments.command,
      cwd,
      call.arguments.timeout,
    );
    return {
      role: "toolResult",
      toolCallId: call.id,
      toolName: "bash",
      content: [{ type: "text", text: result }],
      isError: false,
      timestamp: Date.now(),
    };
  } catch (err) {
    return {
      role: "toolResult",
      toolCallId: call.id,
      toolName: "bash",
      content: [{ type: "text", text: String(err) }],
      isError: true,
      timestamp: Date.now(),
    };
  }
}

function runCommand(
  command: string,
  cwd: string,
  timeoutSeconds?: number,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const proc = spawn(command, { shell: true, cwd });
    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    if (timeoutSeconds && timeoutSeconds > 0) {
      timeoutId = setTimeout(() => {
        proc.kill(); // 超时杀进程
        reject(new Error(`Command timed out after ${timeoutSeconds}s`));
      }, timeoutSeconds * 1000);
    }

    let stdout = "";
    let stderr = "";

    proc.stdout?.on("data", (data: Buffer) => {
      stdout += data.toString();
    });
    proc.stderr?.on("data", (data: Buffer) => {
      stderr += data.toString();
    });

    proc.on("close", (code) => {
      if (timeoutId) clearTimeout(timeoutId);
      if (code === null) return; // 被 kill 的，timer 已 reject
      let combined = stdout + (stderr ? `\nstderr:\n${stderr}` : "");
      const lines = combined.split("\n");
      if (lines.length > MAX_LINES) {
        combined =
          `[Truncated: showing last ${MAX_LINES} of ${lines.length} lines]\n` +
          lines.slice(lines.length - MAX_LINES).join("\n");
      }
      if (code !== 0) reject(new Error(`Exit code ${code}\n${combined}`));
      else resolve(combined);
    });

    proc.on("error", reject);
  });
}
