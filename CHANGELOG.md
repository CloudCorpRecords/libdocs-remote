# Changelog

## 0.1.0 (2026-10-26)

- Initial release.
- CLI: `libdocs-remote resolve <library name>` and
  `libdocs-remote docs <libraryId>` with `--tokens` and `--topic`.
- MCP server (`libdocs-remote mcp`, stdio) with two tools:
  `resolve-library-id` and `get-library-docs`, matching the audited
  Context7 tool surface.
- Implementation forwards each call as JSON-RPC `tools/call` to the
  hosted endpoint `https://mcp.context7.com/mcp`, handling plain JSON
  and text/event-stream (SSE) responses.
- `CONTEXT7_API_KEY` is optional: sent as a header when set, requests
  proceed without one when it is absent.
- All HTTP goes through an injectable fetch function, so tests run on
  fixtures with no network access.
