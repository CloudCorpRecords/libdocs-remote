import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  apiKeyFromEnv,
  callRemoteTool,
  extractJsonPayloads,
  getLibraryDocsRemote,
  parseToolResponse,
  resolveLibraryRemote,
} from "../src/remote.js";
import type { FetchFn, HttpResponse } from "../src/types.js";

interface Captured { url?: string; init?: { method?: string; headers?: Record<string, string>; body?: string } }

function resp(body: string, opts: Partial<HttpResponse> = {}): HttpResponse {
  return { ok: true, status: 200, statusText: "OK", headers: { get: () => null }, text: async () => body, ...opts };
}
const jsonResult = (text: string) =>
  JSON.stringify({ jsonrpc: "2.0", id: 1, result: { content: [{ type: "text", text }] } });
const sseResult = (text: string) =>
  `event: message\ndata: ${jsonResult(text)}\n\n`;

function fake(captured: Captured, body: string): FetchFn {
  return async (url, init) => { captured.url = url; captured.init = init; return resp(body); };
}

describe("apiKeyFromEnv", () => {
  it("returns trimmed key or undefined", () => {
    assert.equal(apiKeyFromEnv({ CONTEXT7_API_KEY: " k " }), "k");
    assert.equal(apiKeyFromEnv({}), undefined);
    assert.equal(apiKeyFromEnv({ CONTEXT7_API_KEY: "  " }), undefined);
  });
});

describe("extractJsonPayloads / parseToolResponse", () => {
  it("parses plain JSON result content", () => {
    assert.equal(parseToolResponse(jsonResult("hello docs")), "hello docs");
  });
  it("parses SSE data lines, ignoring comments", () => {
    assert.equal(parseToolResponse(`: keep-alive\n${sseResult("sse text")}`), "sse text");
  });
  it("extracts multiple payloads and uses the last result", () => {
    const body = `data: {"jsonrpc":"2.0","method":"notifications/progress"}\n\ndata: ${jsonResult("final")}\n\n`;
    assert.equal(extractJsonPayloads(body).length, 2);
    assert.equal(parseToolResponse(body), "final");
  });
  it("throws on JSON-RPC error payloads", () => {
    assert.throws(() => parseToolResponse(JSON.stringify({ jsonrpc: "2.0", id: 1, error: { code: -1, message: "bad lib" } })), /Context7 remote error: bad lib/);
  });
  it("throws on empty / non-JSON bodies", () => {
    assert.throws(() => parseToolResponse(""), /empty or non-JSON/);
    assert.throws(() => parseToolResponse("<html>no</html>"), /empty or non-JSON/);
  });
});

describe("callRemoteTool", () => {
  it("POSTs a tools/call JSON-RPC body to the hosted endpoint without a key header by default", async () => {
    const c: Captured = {};
    const text = await callRemoteTool(fake(c, jsonResult("ok")), "resolve-library-id", { libraryName: "react" });
    assert.equal(text, "ok");
    assert.equal(c.url, "https://mcp.context7.com/mcp");
    assert.equal(c.init?.method, "POST");
    assert.equal(c.init?.headers?.CONTEXT7_API_KEY, undefined);
    const sent = JSON.parse(c.init?.body ?? "{}");
    assert.equal(sent.method, "tools/call");
    assert.equal(sent.params.name, "resolve-library-id");
    assert.deepEqual(sent.params.arguments, { libraryName: "react" });
    assert.ok(String(c.init?.headers?.Accept).includes("text/event-stream"));
  });
  it("sends CONTEXT7_API_KEY header when a key is present", async () => {
    const c: Captured = {};
    await callRemoteTool(fake(c, jsonResult("ok")), "resolve-library-id", { libraryName: "react" }, "ctx7-key");
    assert.equal(c.init?.headers?.CONTEXT7_API_KEY, "ctx7-key");
  });
  it("handles an SSE upstream response", async () => {
    const c: Captured = {};
    assert.equal(await callRemoteTool(fake(c, sseResult("from sse")), "get-library-docs", { context7CompatibleLibraryID: "/a/b" }), "from sse");
  });
  it("surfaces HTTP failures with status and body detail", async () => {
    const failing: FetchFn = async () => resp("slow down", { ok: false, status: 429, statusText: "Too Many Requests" });
    await assert.rejects(() => callRemoteTool(failing, "resolve-library-id", { libraryName: "react" }), /HTTP 429.*slow down/);
  });
  it("surfaces connection failures naming the endpoint", async () => {
    const failing: FetchFn = async () => { throw new Error("fetch failed"); };
    await assert.rejects(() => callRemoteTool(failing, "resolve-library-id", { libraryName: "react" }), /Failed to reach Context7 remote at https:\/\/mcp\.context7\.com\/mcp: fetch failed/);
  });
});

describe("tool wrappers", () => {
  it("resolve validates the name and forwards it", async () => {
    const c: Captured = {};
    await resolveLibraryRemote(fake(c, jsonResult("matches")), { libraryName: " next.js " });
    assert.deepEqual(JSON.parse(c.init?.body ?? "{}").params.arguments, { libraryName: "next.js" });
    await assert.rejects(() => resolveLibraryRemote(fake({}, jsonResult("x")), { libraryName: " " }), /non-empty/);
  });
  it("docs forwards only set optional arguments", async () => {
    const c: Captured = {};
    await getLibraryDocsRemote(fake(c, jsonResult("docs")), { context7CompatibleLibraryID: "/vercel/next.js" });
    assert.deepEqual(JSON.parse(c.init?.body ?? "{}").params.arguments, { context7CompatibleLibraryID: "/vercel/next.js" });
    const c2: Captured = {};
    await getLibraryDocsRemote(fake(c2, jsonResult("docs")), { context7CompatibleLibraryID: "/a/b", tokens: 5000, topic: " routing " });
    assert.deepEqual(JSON.parse(c2.init?.body ?? "{}").params.arguments, { context7CompatibleLibraryID: "/a/b", tokens: 5000, topic: "routing" });
    await assert.rejects(() => getLibraryDocsRemote(fake({}, jsonResult("x")), { context7CompatibleLibraryID: "" }), /non-empty/);
  });
});
