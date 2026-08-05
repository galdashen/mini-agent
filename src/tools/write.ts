import { mkdir, writeFile } from "fs/promises";
import { dirname, resolve } from "path";
import type { Tool, ToolCall, ToolResultMessage } from "../types.ts";

export const writeTool: Tool = {
  name: "write",
  description:
    "Write content to a file. Creates the file if it doesn't exist, overwrites if it does. Automatically creates parent directories.",
  parameters: {
    type: "object",
    properties: {
      path: {
        type: "string",
        description: "Path to the file to write (relative or absolute)",
      },
      content: { type: "string", description: "Content to write to the file" },
    },
    required: ["path", "content"],
  },
};

export async function executeWrite(
  call: ToolCall,
  cwd: string,
): Promise<ToolResultMessage> {
  try {
    const absolutePath = resolve(cwd, call.arguments.path);
    await mkdir(dirname(absolutePath), { recursive: true }); // 目录不存在就创建
    await writeFile(absolutePath, call.arguments.content, "utf-8");
    return {
      role: "toolResult",
      toolCallId: call.id,
      toolName: "write",
      content: [{ type: "text", text: `File written: ${absolutePath}` }],
      isError: false,
      timestamp: Date.now(),
    };
  } catch (err) {
    return {
      role: "toolResult",
      toolCallId: call.id,
      toolName: "write",
      content: [{ type: "text", text: String(err) }],
      isError: true,
      timestamp: Date.now(),
    };
  }
}
