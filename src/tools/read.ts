import { readFile, access } from "fs/promises";
import { constants } from "fs";
import { resolve } from "path";
import type { Tool, ToolResultMessage, ToolCall } from "../types.ts";

const MAX_LINES = 2000;

export const readTool: Tool = {
  name: "read",
  description: `Read the contents of a file. Supports only text files (cpp, txt, md, etc...). Output is truncated to ${MAX_LINES} lines. Use offset/limit for large files. When you need the full file, continue with offset until complete.`,
  parameters: {
    type: "object",
    properties: {
      path: {
        type: "string",
        description: "Path to the file to read (relative or absolute)",
      },
      offset: {
        type: "number",
        description: "Line number to start reading from (1-indexed)",
      },
      limit: { type: "number", description: "Maximum number of lines to read" },
    },
    required: ["path"],
  },
};

export async function executeRead(
  call: ToolCall,
  cwd: string,
): Promise<ToolResultMessage> {
  try {
    const absolutePath = resolve(cwd, call.arguments.path);
    await access(absolutePath, constants.R_OK);
    const buffer = await readFile(absolutePath);
    const content = buffer.toString("utf-8");
    const lines = content.split("\n");
    const startLine = call.arguments.offset
      ? Math.max(0, call.arguments.offset - 1)
      : 0;
    const endLine = call.arguments.limit
      ? Math.min(startLine + call.arguments.limit, lines.length)
      : lines.length;
    const selectedLines = lines.slice(startLine, endLine);

    let truncated = false;
    let resultLines = selectedLines;
    if (selectedLines.length > MAX_LINES) {
      resultLines = selectedLines.slice(0, MAX_LINES);
      truncated = true;
    }
    let output = resultLines.join("\n");
    if (truncated) {
      output += `\n\n[Truncated to ${MAX_LINES} lines. Use offset to continue.]`;
    }

    return {
      role: "toolResult",
      toolCallId: call.id,
      toolName: "read",
      content: [{ type: "text", text: output }],
      isError: false,
      timestamp: Date.now(),
    };
  } catch (err) {
    return {
      role: "toolResult",
      toolCallId: call.id,
      toolName: "read",
      content: [{ type: "text", text: String(err) }],
      isError: true,
      timestamp: Date.now(),
    };
  }
}
