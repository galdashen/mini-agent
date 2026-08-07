import { createInterface } from "readline";
import { runAgent } from "./agent.ts";
import { executeRead, readTool } from "./tools/read.ts";
import { executeWrite, writeTool } from "./tools/write.ts";
import { executeEdit, editTool } from "./tools/edit.ts";
import { executeBash, bashTool } from "./tools/bash.ts";
import type { Context, Message, ToolCall, ToolResultMessage } from "./types.ts";
import {
  getLatestSession,
  loadSession,
  createSessionID,
  appendMessage,
} from "./session.ts";

const API_KEY = process.env.DEEPSEEK_API_KEY;
const MODEL = "deepseek-v4-flash";
const TOOLS = [readTool, writeTool, editTool, bashTool];
const CWD = process.cwd();
const SYSTEM_PROMPT = `你是一个 AI 助手，你可以使用read、write、edit、bash这四个工具来读取文件、写入文件、编辑文件和执行命令。请根据用户的输入，合理使用这些工具，来帮助用户完成任务。`;

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

const rl = createInterface({ input: process.stdin, output: process.stdout });

function ask(question: string): Promise<string> {
  return new Promise((resolve) => rl.question(question, resolve));
}

async function main() {
  let messages: Message[] = [];
  let sessionFile: string;

  if (process.argv.includes("--continue")) {
    const latest = await getLatestSession();
    if (!latest) {
      console.error("没有历史会话");
      return;
    }
    sessionFile = latest;
    try {
      messages = await loadSession(latest);
    } catch {
      console.error("加载历史会话失败");
      return;
    }
  } else {
    sessionFile = createSessionID() + ".jsonl";
  }

  const context: Context = {
    systemPrompt: SYSTEM_PROMPT,
    messages,
    tools: TOOLS,
  };

  console.log("输入 exit 退出对话");
  while (true) {
    const input = await ask("你: ");
    if (input === "exit" || input === "quit") break;
    if (!input.trim()) continue;
    await runTurn(context, sessionFile, input);
  }
  rl.close();
}

async function runTurn(context: Context, sessionFile: string, input: string) {
  const userMsg: Message = {
    role: "user",
    content: { type: "text", text: input },
    timestamp: Date.now(),
  };
  context.messages.push(userMsg);
  try {
    await appendMessage(sessionFile, userMsg);
  } catch (e) {
    console.warn("保存失败", e);
  }

  if (!API_KEY) {
    console.error("请设置环境变量 DEEPSEEK_API_KEY");
    return;
  }

  const newMessages = await runAgent(API_KEY, MODEL, context, executeTool);
  for (const m of newMessages) {
    try {
      await appendMessage(sessionFile, m);
    } catch (e) {
      console.warn("保存失败", e);
    }
  }

  const lastMsg = [...newMessages]
    .reverse()
    .find((m) => m.role === "assistant");
  if (lastMsg) {
    console.log(
      "Agent: " +
        lastMsg.content.map((c) => (c.type === "text" ? c.text : "")).join(""),
    );
  }
}

main();
