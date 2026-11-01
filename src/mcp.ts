/**
 * libdocs-remote MCP server. Tools: resolve-library-id, get-library-docs.
 *
 * Low-level Server API with explicit inputSchema literals (the
 * McpServer+zod path injects $schema/additionalProperties and breaks
 * parity). Zod still validates call args. Tool names/schemas are the
 * exact audited context7 fixture surface.
 */
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { apiKeyFromEnv, getLibraryDocsRemote, resolveLibraryRemote, VERSION } from "./remote.js";
import type { FetchFn } from "./types.js";

const ResolveArgs = z.object({ libraryName: z.string() });
const DocsArgs = z.object({
  context7CompatibleLibraryID: z.string(),
  tokens: z.number().optional(),
  topic: z.string().optional(),
});

const TOOLS = [
  {
    name: "resolve-library-id",
    description:
      "Resolve a library name into a Context7-compatible library ID, returning the matching libraries.",
    inputSchema: {
      type: "object" as const,
      properties: {
        libraryName: {
          type: "string",
          description:
            "Name of the library to resolve into a Context7-compatible library ID.",
        },
      },
      required: ["libraryName"],
    },
  },
  {
    name: "get-library-docs",
    description:
      "Fetch current documentation and code examples for a library using its Context7-compatible library ID.",
    inputSchema: {
      type: "object" as const,
      properties: {
        context7CompatibleLibraryID: {
          type: "string",
          description:
            'Context7-compatible library ID to fetch documentation for, as returned by resolve-library-id, for example "/vercel/next.js".',
        },
        tokens: {
          type: "number",
          description:
            "Optional maximum number of documentation tokens to return; defaults to 10000 and values below 10000 are raised to 10000.",
        },
        topic: {
          type: "string",
          description:
            'Optional topic to focus the returned documentation on, for example "routing".',
        },
      },
      required: ["context7CompatibleLibraryID"],
    },
  },
];

function textResult(value: unknown) {
  return { content: [{ type: "text" as const, text: typeof value === "string" ? value : JSON.stringify(value, null, 2) }] };
}
function errorResult(err: unknown) {
  return { content: [{ type: "text" as const, text: err instanceof Error ? err.message : String(err) }], isError: true };
}

const server = new Server({ name: "libdocs-remote", version: VERSION }, { capabilities: { tools: {} } });
server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  const fetchFn = globalThis.fetch as unknown as FetchFn;
  const apiKey = apiKeyFromEnv();
  try {
    if (name === "resolve-library-id") {
      const parsed = ResolveArgs.parse(args ?? {});
      return textResult((await resolveLibraryRemote(fetchFn, parsed, apiKey)).text);
    }
    if (name === "get-library-docs") {
      const parsed = DocsArgs.parse(args ?? {});
      return textResult((await getLibraryDocsRemote(fetchFn, parsed, apiKey)).text);
    }
  } catch (err) {
    return errorResult(err);
  }
  throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
});

async function main(): Promise<void> {
  await server.connect(new StdioServerTransport());
}
void main();
