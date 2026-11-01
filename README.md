# libdocs-remote

libdocs-remote is the hosted variant of the library-docs lookup.
Instead of calling a REST API locally, it forwards each request as a
JSON-RPC `tools/call` to the hosted Context7 remote MCP endpoint at
`https://mcp.context7.com/mcp` and returns the answer it gets back.
It understands both plain JSON answers and `text/event-stream` (SSE)
answers, reading the JSON-RPC payloads out of the `data:` lines.

Use it when you want the hosted service to do the work and only need
a local stdio server (or a small CLI) in front of it.

`CONTEXT7_API_KEY` is optional. When it is set, it is sent as the
`CONTEXT7_API_KEY` header documented for the hosted endpoint; when
it is absent, no such header is sent and that is not an error.

## Install

```bash
npx @reneturcios/libdocs-remote resolve "next.js"
docker run -i ghcr.io/cloudcorprecords/libdocs-remote
```

## CLI

```bash
libdocs-remote resolve "next.js"
libdocs-remote docs /vercel/next.js
libdocs-remote docs /vercel/next.js --topic routing --tokens 20000
libdocs-remote --version
```

Exit codes: `0` success, `1` lookup error, `2` usage error.

## MCP server

```bash
npx -y @reneturcios/libdocs-remote mcp
```

```json
{
  "mcpServers": {
    "libdocs-remote": {
      "command": "npx",
      "args": ["-y", "@reneturcios/libdocs-remote", "mcp"],
      "env": { "CONTEXT7_API_KEY": "your-key-if-you-have-one" }
    }
  }
}
```

The `env` block is optional.

### Tools

| Tool | Input | What it returns |
| --- | --- | --- |
| `resolve-library-id` | `libraryName` (string, required) | The matching libraries as returned by the hosted endpoint. |
| `get-library-docs` | `context7CompatibleLibraryID` (string, required), `tokens` (number, optional), `topic` (string, optional) | Documentation text as returned by the hosted endpoint. |

Upstream failures — HTTP errors, JSON-RPC errors, unreachable hosts —
are reported as tool errors with the underlying message.

## Development

```bash
npm install
npm run build
npm test
npm run dev
```

Tests run entirely on fake-fetch fixtures, including plain-JSON and
SSE upstream bodies; no network is used.

## License

MIT — see `LICENSE`.
