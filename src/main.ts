import { runAgent } from "./agent.ts";
import { executeRead, readTool } from "./tools/read.ts";
import { executeWrite, writeTool } from "./tools/write.ts";
import { executeEdit, editTool } from "./tools/edit.ts";
import { executeBash, bashTool } from "./tools/bash.ts";
import type { Context, ToolCall, ToolResultMessage } from "./types.ts";

const API_KEY = process.env.DEEPSEEK_API_KEY;
const MODEL = "deepseek-v4-flash";
const TOOLS = [readTool, writeTool, editTool, bashTool];
const CWD = process.cwd();

async function executeTool(call: ToolCall): Promise<ToolResultMessage> {
  switch (call.name) {
    case "read":
      return executeRead(call, CWD);
    case "write":
      return executeWrite(call, CWD);
    case "edit":
      return executeEdit(call, CWD);
    case "bash":
      return executeBash(call, CWD);
    default:
      return {
        role: "toolResult",
        toolCallId: call.id,
        toolName: call.name,
        content: [{ type: "text", text: `Unknown tool: ${call.name}` }],
        isError: true,
        timestamp: Date.now(),
      };
  }
}

async function main() {
  const context: Context = {
    systemPrompt: "你是一个编程助手。用中文回复。",
    messages: [
      {
        role: "user",
        content: { type: "text", text: process.argv[2] || "你好" },
        timestamp: Date.now(),
      },
    ],
    tools: TOOLS,
  };

  if (!API_KEY) {
    console.error("未找到环境变量 DEEPSEEK_API_KEY");
    process.exit(1);
  }
  const result = await runAgent(API_KEY, MODEL, context, executeTool);

  const lastMsg = result.messages.filter((m) => m.role === "assistant").pop();
  if (lastMsg) {
    console.log(
      lastMsg.content.map((c) => (c.type === "text" ? c.text : "")).join(""),
    );
  }
}

main();
