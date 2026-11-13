import { API_BASE_URL } from "@/lib/api";

/** One Server-Sent Event from an AI agent route: step / item / reset / result / cost / error / done. */
export type AgentEvent = { event: string; data: any };

export class AgentStreamError extends Error {
  constructor(message: string, public status: number, public code?: string) {
    super(message);
  }
}

function errorFrom(body: unknown, status: number): AgentStreamError {
  const detail = (body as { detail?: unknown })?.detail;
  if (typeof detail === "string") return new AgentStreamError(detail, status);
  const d = detail as { message?: string; error?: { code?: string; details?: string } } | undefined;
  return new AgentStreamError(d?.message || d?.error?.details || `Request failed (${status})`, status, d?.error?.code);
}

function parseBlock(block: string): AgentEvent | null {
  let event = "message";
  const data: string[] = [];
  for (const line of block.split("\n")) {
    if (line.startsWith(":")) continue;                  // comments: padding and keep-alives
    if (line.startsWith("event:")) event = line.slice(6).trim();
    else if (line.startsWith("data:")) data.push(line.slice(5).trimStart());
  }
  if (!data.length) return null;
  try {
    return { event, data: JSON.parse(data.join("\n")) };
  } catch {
    return null;
  }
}

/** POST to an AI agent route and hand each event to `onEvent` as it arrives (fetch + ReadableStream, because
 *  EventSource cannot send the Authorization header). Resolves when the stream ends; rejects with AgentStreamError
 *  when the route refuses up front (permission, budget ...), or with an AbortError when cancelled. */
export async function streamAgent(path: string, body: unknown, onEvent: (e: AgentEvent) => void,
  signal?: AbortSignal): Promise<void> {
  const token = typeof window !== "undefined" ? localStorage.getItem("access_token") : null;
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: "POST", signal, body: JSON.stringify(body),
    headers: { "Content-Type": "application/json", Accept: "text/event-stream",
      ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  });
  if (!response.ok) {
    let parsed: unknown = null;
    try { parsed = await response.json(); } catch { /* not JSON */ }
    throw errorFrom(parsed, response.status);
  }
  if (!response.body) {                                   // no streaming support: everything at once
    (await response.text()).split(/\r?\n\r?\n/).map(parseBlock).forEach((e) => e && onEvent(e));
    return;
  }
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true }).replace(/\r\n/g, "\n");
    let cut = buffer.indexOf("\n\n");
    while (cut !== -1) {
      const parsed = parseBlock(buffer.slice(0, cut));
      buffer = buffer.slice(cut + 2);
      if (parsed) onEvent(parsed);
      cut = buffer.indexOf("\n\n");
    }
  }
  const last = parseBlock(buffer);
  if (last) onEvent(last);
}
