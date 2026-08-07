import { readFile, mkdir, appendFile, readdir } from "fs/promises";
import { join } from "path";
import { existsSync } from "fs";
import { homedir } from "os";
import type { Message } from "./types.ts";

function getSessionDir(): string {
  return join(homedir(), ".mini-agent", "sessions");
}

export function createSessionID(): string {
  return Date.now().toString();
}

export async function appendMessage(
  fileName: string,
  message: Message,
): Promise<void> {
  const dir = getSessionDir();
  if (!existsSync(dir)) await mkdir(dir, { recursive: true });
  await appendFile(
    join(dir, fileName),
    JSON.stringify(message) + "\n",
    "utf-8",
  );
}

export async function loadSession(fileName: string): Promise<Message[]> {
  const content = await readFile(join(getSessionDir(), fileName), "utf-8");
  return content
    .trim()
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

async function listSessions(): Promise<string[]> {
  const dir = getSessionDir();
  if (!existsSync(dir)) return [];
  return (await readdir(dir)).filter((f) => f.endsWith(".jsonl"));
}

export async function getLatestSession(): Promise<string | undefined> {
  const fileNames = await listSessions();
  return fileNames.sort().pop();
}
