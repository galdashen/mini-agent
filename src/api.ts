import type { AssistantMessage, Context, StopReason, Tool } from "./types.ts";

export async function complete(
  apiKey: string,
  model: string,
  context: Context,
): Promise<AssistantMessage> {
  const messages = convertMessages(context);
  const tools = context.tools ? convertTools(context.tools) : null;

  const body = {
    model,
    messages,
    tools,
    stream: false,
    reasoning_effort: "max",
    thinking: { type: "enabled" },
  };

  const response = await fetch("https://api.deepseek.com/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  const data = await response.json();
  return parseResponse(data);
}

function convertMessages(context: Context) {
  const msgs = [];

  if (context.systemPrompt) {
    msgs.push({ role: "system", content: context.systemPrompt });
  }

  for (const msg of context.messages) {
    if (msg.role === "user") {
      msgs.push({ role: "user", content: msg.content.text });
    } else if (msg.role === "assistant") {
      const m: Record<string, unknown> = {
        role: "assistant",
        content: null,
        reasoning_content: null,
      };

      m.reasoning_content =
        msg.content.find((c) => c.type === "thinking")?.thinking ?? null;

      m.content = msg.content.find((c) => c.type === "text")?.text ?? null;

      const toolCalls = msg.content.filter((c) => c.type === "toolCall");
      if (toolCalls.length > 0) {
        m.tool_calls = toolCalls.map((tc) => ({
          id: tc.id,
          type: "function",
          function: { name: tc.name, arguments: JSON.stringify(tc.arguments) },
        }));
      }

      msgs.push(m);
    } else if (msg.role === "toolResult") {
      msgs.push({
        role: "tool",
        tool_call_id: msg.toolCallId,
        content: msg.content.map((c) => c.text).join("\n"),
      });
    }
  }

  return msgs;
}

function convertTools(tools: Tool[]) {
  return tools.map((tool) => ({
    type: "function",
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters,
    },
  }));
}

function parseResponse(data: any): AssistantMessage {
  const msg = data.choices[0].message;

  const content: AssistantMessage["content"] = [];

  if (msg.reasoning_content) {
    content.push({ type: "thinking", thinking: msg.reasoning_content });
  }

  if (msg.content) {
    content.push({ type: "text", text: msg.content });
  }

  if (msg.tool_calls) {
    for (const tc of msg.tool_calls) {
      content.push({
        type: "toolCall",
        id: tc.id,
        name: tc.function.name,
        arguments: JSON.parse(tc.function.arguments),
      });
    }
  }

  const reason = mapStopReason(data.choices[0].finish_reason);

  return {
    role: "assistant",
    content,
    model: data.model,
    usage: {
      input: data.usage.prompt_tokens,
      output: data.usage.completion_tokens,
      totalTokens: data.usage.total_tokens,
    },
    stopReason: reason.stopReason,
    errorMessage: reason.errorMessage,
    timestamp: Date.now(),
  };
}

function mapStopReason(reason: string): {
  stopReason: StopReason;
  errorMessage?: string;
} {
  if (reason === null) return { stopReason: "stop" };
  switch (reason) {
    case "stop":
    case "end":
      return { stopReason: "stop" };
    case "length":
      return { stopReason: "length" };
    case "function_call":
    case "tool_calls":
      return { stopReason: "toolUse" };
    case "content_filter":
      return {
        stopReason: "error",
        errorMessage: "Provider finish_reason: content_filter",
      };
    case "network_error":
      return {
        stopReason: "error",
        errorMessage: "Provider finish_reason: network_error",
      };
    default:
      return {
        stopReason: "error",
        errorMessage: `Provider finish_reason: ${reason}`,
      };
  }
}
