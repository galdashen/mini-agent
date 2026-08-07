import { complete } from "./api.ts";
import { Context, Message, ToolCall, ToolResultMessage } from "./types.ts";

export async function runAgent(
  apiKey: string,
  model: string,
  context: Context,
  executeTool: (call: ToolCall) => Promise<ToolResultMessage>,
): Promise<Message[]> {
  const newMessages: Message[] = [];
  while (true) {
    const response = await complete(apiKey, model, context);

    newMessages.push(response);
    context.messages.push(response);

    if (response.stopReason != "toolUse") {
      break;
    }

    const toolCalls = response.content.filter((c) => c.type === "toolCall");
    if (toolCalls.length > 0) {
      for (const call of toolCalls) {
        let result: ToolResultMessage;
        try {
          result = await executeTool(call);
        } catch (err) {
          result = {
            role: "toolResult",
            toolCallId: call.id,
            toolName: call.name,
            content: [
              { type: "text", text: `Tool execution failed: ${String(err)}` },
            ],
            isError: true,
            timestamp: Date.now(),
          };
        }
        newMessages.push(result);
        context.messages.push(result);
      }
    } else {
      break;
    }
  }

  return newMessages;
}
