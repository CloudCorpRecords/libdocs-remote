# BUILD-REPORT — libdocs-remote (original: context7-remote)

Built 2026-10-26 for the MCP Rebuild 100 program. Local only; nothing
pushed or published.

## Identity

- npm: `@reneturcios/libdocs-remote`, bin `libdocs-remote`, version 0.1.0
- Registry name: `io.github.CloudCorpRecords/libdocs-remote`
  (matches package.json `mcpName`, server.json `name`, and the
  Dockerfile `io.modelcontextprotocol.server.name` label)
- server.json description: 81 chars (≤100, counted)
- server.json OCI package entry: no `version` field (version only in
  the tagged identifier `ghcr.io/cloudcorprecords/libdocs-remote:0.1.0`)

## Tools (2/2)

Same surface as the audited context7 fixture
(`context7-tools-original.json`), reused exactly:

| Tool | Required | Optional |
| --- | --- | --- |
| `resolve-library-id` | `libraryName` | — |
| `get-library-docs` | `context7CompatibleLibraryID` | `tokens`, `topic` |

Registered via the low-level MCP `Server` API with explicit
inputSchema literals; zod validates call arguments.

## Implementation

- Each call is forwarded as one JSON-RPC 2.0 `tools/call` POST to the
  hosted remote MCP endpoint `https://mcp.context7.com/mcp`, behind an
  injectable `FetchFn`.
- Responses are handled in both documented shapes: plain JSON, and
  `text/event-stream` (SSE) bodies whose `data:` lines carry JSON-RPC
  payloads (last result/error payload wins; comments/keep-alives and
  `[DONE]` are ignored). JSON-RPC `error` payloads and upstream
  content are surfaced honestly.
- Env vars: `CONTEXT7_API_KEY` — optional. When set it is sent as the
  `CONTEXT7_API_KEY` header documented for the hosted endpoint; when
  absent no such header is sent and no error is raised (tested both
  ways).

## Verification (all foreground, verified from disk/output)

- tsc: `npx tsc` exit 0; `dist/cli.js` present; `node dist/cli.js --version` → `0.1.0`
- Tests: 13/13 pass (`npm test`, fake fetch only — plain JSON, SSE,
  JSON-RPC error, HTTP 429, connection failure, key header on/off,
  request-body shape, argument forwarding/validation)
- Parity: fixture
  `harness/fixtures/context7-remote-tools-original.json`
  (`_source`: "remote variant; tool list same as audited context7,
  transport is hosted JSON-RPC/SSE forwarding") vs live stdio rebuild
  via `harness/parity.py` → `parity_pct == 100.0`, identical 2/2,
  output in `parity-out/parity.json` (verdict PASS)

## Honest gaps

- No live call to `https://mcp.context7.com/mcp` was made or claimed
  (VM egress blocked); wire behaviour is proven against fake-fetch
  fixtures only, so upstream response-shape drift is unverified until
  the publish-wave live smoke.
- Forwarding means documentation quality, ranking, and availability
  are entirely the hosted service's — this rebuild reproduces the
  tool surface and wire behaviour, not the hosted index/models.
- Lockfile flag: `package-lock.json` is a copy of the libdocs
  lockfile with identity fields edited (name, bin). **Clean lockfile
  regeneration (no node_modules present) is required before
  publish** — fleet lesson 2026-10-25 / Blocker 3.
- mcpaudit / mcpvet / shipcheck pre-publish gate not run (belongs to
  the publish wave, per SCOREBOARD).
