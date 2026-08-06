import { readFile, writeFile } from "fs/promises";
import { resolve } from "path";
import type { Tool, ToolCall, ToolResultMessage } from "../types.ts";

export const editTool: Tool = {
  name: "edit",
  description:
    "Edit a single file using exact text replacement. Every edits[].oldText must match a unique, non-overlapping region of the original file. If two changes affect the same block or nearby lines, merge them into one edit instead of emitting overlapping edits. Do not include large unchanged regions just to connect distant changes.",
  parameters: {
    type: "object",
    properties: {
      path: {
        type: "string",
        description: "Path to the file to edit (relative or absolute)",
      },
      edits: {
        type: "array",
        items: {
          type: "object",
          properties: {
            oldText: {
              type: "string",
              description:
                "Exact text for one targeted replacement. It must be unique in the original file and must not overlap with any other edits[].oldText in the same call.",
            },
            newText: {
              type: "string",
              description: "Replacement text for this targeted edit.",
            },
          },
          required: ["oldText", "newText"],
        },
        description:
          "One or more targeted replacements. Each edit is matched against the original file, not incrementally. Do not include overlapping or nested edits. If two changes touch the same block or nearby lines, merge them into one edit instead.",
      },
    },
    required: ["path", "edits"],
  },
};

export async function executeEdit(
  call: ToolCall,
  cwd: string,
): Promise<ToolResultMessage> {
  try {
    const absolutePath = resolve(cwd, call.arguments.path);
    const content = await readFile(absolutePath, "utf-8");

    for (const edit of call.arguments.edits) {
      if (!content.includes(edit.oldText)) {
        throw new Error(`Not found: ${edit.oldText}`);
      }
      if (content.indexOf(edit.oldText) !== content.lastIndexOf(edit.oldText)) {
        throw new Error(`Appear multiple times: ${edit.oldText}`);
      }
    }

    let newContent = content;
    for (const edit of call.arguments.edits) {
      newContent = newContent.replace(edit.oldText, edit.newText);
    }

    await writeFile(absolutePath, newContent, "utf-8");

    return {
      role: "toolResult",
      toolCallId: call.id,
      toolName: "edit",
      content: [{ type: "text", text: "Edit success" }],
      isError: false,
      timestamp: Date.now(),
    };
  } catch (err) {
    return {
      role: "toolResult",
      toolCallId: call.id,
      toolName: "edit",
      content: [{ type: "text", text: String(err) }],
      isError: true,
      timestamp: Date.now(),
    };
  }
}
