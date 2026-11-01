/**
 * libdocs-remote core: forward Context7 tool calls to the hosted
 * remote MCP endpoint at https://mcp.context7.com/mcp.
 *
 * Each local call becomes one JSON-RPC 2.0 `tools/call` POST. The
 * hosted endpoint (streamable HTTP) may answer with a plain JSON
 * document or with a text/event-stream (SSE) body whose `data:` lines
 * carry JSON-RPC response objects; both shapes are parsed here.
 *
 * CONTEXT7_API_KEY is optional: when present it is sent as the
 * CONTEXT7_API_KEY request header documented for the hosted endpoint,
 * and when absent no such header is sent and no error is raised.
 *
 * All HTTP goes through an injected FetchFn so the wire handling is
 * fully testable offline with fixtures.
 */
import type { DocsOptions, FetchFn, RemoteResult, ResolveOptions } from "./types.js";

export const VERSION = "0.1.0";

export const REMOTE_ENDPOINT = "https://mcp.context7.com/mcp";

export function apiKeyFromEnv(
  env: Record<string, string | undefined> = process.env,
): string | undefined {
  const raw = env.CONTEXT7_API_KEY;
  const key = typeof raw === "string" ? raw.trim() : "";
  return key ? key : undefined;
}

export function extractJsonPayloads(body: string): unknown[] {
  const trimmed = body.trim();
  if (!trimmed) return [];
  const dataLines = trimmed
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("data:"))
    .map((line) => line.slice("data:".length).trim())
    .filter((line) => line.length > 0 && line !== "[DONE]");
  const candidates = dataLines.length > 0 ? dataLines : [trimmed];
  const payloads: unknown[] = [];
  for (const candidate of candidates) {
    try {
      payloads.push(JSON.parse(candidate));
    } catch {
      // Non-JSON stream noise (comments, keep-alives) is ignored.
    }
  }
  return payloads;
}

export function resultTextFromPayload(payload: unknown): string {
  if (payload === null || typeof payload !== "object") {
    throw new Error("Context7 remote returned an unexpected response shape");
  }
  const obj = payload as Record<string, unknown>;
  if (obj.error !== undefined && obj.error !== null) {
    const err = obj.error as Record<string, unknown>;
    const message =
      typeof err.message === "string" ? err.message : JSON.stringify(obj.error);
    throw new Error(`Context7 remote error: ${message}`);
  }
  const result = obj.result;
  if (typeof result === "string") return result;
  if (result !== null && typeof result === "object") {
    const r = result as Record<string, unknown>;
    if (typeof r.result === "string") return r.result;
    if (Array.isArray(r.content)) {
      const texts = r.content
        .filter(
          (part): part is Record<string, unknown> =>
            part !== null && typeof part === "object",
        )
        .filter((part) => part.type === "text" && typeof part.text === "string")
        .map((part) => part.text as string);
      if (texts.length > 0) return texts.join("\n");
      // Preserve isError content too: surface its text, let caller see it.
      if (texts.length === 0 && r.content.length === 0) {
        throw new Error("Context7 remote returned an empty content list");
      }
    }
    if (r.isError === true) {
      throw new Error("Context7 remote returned an error result with no text");
    }
  }
  throw new Error("Context7 remote returned a response with no readable result text");
}

export function parseToolResponse(body: string): string {
  const payloads = extractJsonPayloads(body);
  if (payloads.length === 0) {
    throw new Error("Context7 remote returned an empty or non-JSON response");
  }
  for (let i = payloads.length - 1; i >= 0; i--) {
    const payload = payloads[i] as Record<string, unknown>;
    if (payload && (payload.result !== undefined || payload.error !== undefined)) {
      return resultTextFromPayload(payload);
    }
  }
  return resultTextFromPayload(payloads[payloads.length - 1]);
}

let nextRequestId = 1;

export async function callRemoteTool(
  fetchFn: FetchFn,
  toolName: string,
  args: Record<string, unknown>,
  apiKey?: string,
): Promise<string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json, text/event-stream",
  };
  const key = typeof apiKey === "string" ? apiKey.trim() : "";
  if (key) headers.CONTEXT7_API_KEY = key;
  const requestBody = JSON.stringify({
    jsonrpc: "2.0",
    id: nextRequestId++,
    method: "tools/call",
    params: { name: toolName, arguments: args },
  });
  let response;
  try {
    response = await fetchFn(REMOTE_ENDPOINT, {
      method: "POST",
      headers,
      body: requestBody,
    });
  } catch (err) {
    throw new Error(
      `Failed to reach Context7 remote at ${REMOTE_ENDPOINT}: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
  const body = await response.text();
  if (!response.ok) {
    const detail = body.trim().slice(0, 200);
    throw new Error(
      `Context7 remote request failed: HTTP ${response.status}${response.statusText ? ` ${response.statusText}` : ""}${detail ? `: ${detail}` : ""}`,
    );
  }
  return parseToolResponse(body);
}

export async function resolveLibraryRemote(
  fetchFn: FetchFn,
  options: ResolveOptions,
  apiKey?: string,
): Promise<RemoteResult> {
  const name = typeof options.libraryName === "string" ? options.libraryName.trim() : "";
  if (!name) throw new Error("libraryName must be a non-empty string");
  const text = await callRemoteTool(fetchFn, "resolve-library-id", { libraryName: name }, apiKey);
  return { text };
}

export async function getLibraryDocsRemote(
  fetchFn: FetchFn,
  options: DocsOptions,
  apiKey?: string,
): Promise<RemoteResult> {
  const id =
    typeof options.context7CompatibleLibraryID === "string"
      ? options.context7CompatibleLibraryID.trim()
      : "";
  if (!id) throw new Error("context7CompatibleLibraryID must be a non-empty string");
  const args: Record<string, unknown> = { context7CompatibleLibraryID: id };
  if (options.tokens !== undefined && Number.isFinite(options.tokens)) args.tokens = options.tokens;
  if (typeof options.topic === "string" && options.topic.trim()) args.topic = options.topic.trim();
  const text = await callRemoteTool(fetchFn, "get-library-docs", args, apiKey);
  return { text };
}
