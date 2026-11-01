#!/usr/bin/env node
/**
 * libdocs-remote CLI.
 *   libdocs-remote resolve <library name>
 *   libdocs-remote docs <libraryId> [--tokens n] [--topic text]
 *   libdocs-remote mcp
 * CONTEXT7_API_KEY is optional. Exit codes: 0 success, 1 error, 2 usage.
 */
import { apiKeyFromEnv, getLibraryDocsRemote, resolveLibraryRemote, VERSION } from "./remote.js";
import type { FetchFn } from "./types.js";

function usage(): never {
  console.error(`Usage:
  libdocs-remote resolve <library name>
  libdocs-remote docs <libraryId> [--tokens n] [--topic text]
  libdocs-remote mcp
  libdocs-remote --version`);
  process.exit(2);
}
function flagValue(args: string[], name: string): string | undefined {
  const idx = args.indexOf(name);
  return idx < 0 || idx + 1 >= args.length ? undefined : args[idx + 1];
}
function withoutFlags(args: string[], valueFlags: string[]): string[] {
  const out: string[] = [];
  for (let i = 0; i < args.length; i++) {
    if (valueFlags.includes(args[i])) i++;
    else out.push(args[i]);
  }
  return out;
}

async function main(): Promise<void> {
  const [cmd, ...rest] = process.argv.slice(2);
  if (cmd === "--version" || cmd === "-v") { console.log(VERSION); return; }
  if (cmd === "mcp") { await import("./mcp.js"); return; }
  if (!cmd) usage();
  const fetchFn = globalThis.fetch as unknown as FetchFn;
  const apiKey = apiKeyFromEnv();
  try {
    if (cmd === "resolve") {
      const name = rest.join(" ").trim();
      if (!name) usage();
      console.log((await resolveLibraryRemote(fetchFn, { libraryName: name }, apiKey)).text);
    } else if (cmd === "docs") {
      const [libraryId] = withoutFlags(rest, ["--tokens", "--topic"]);
      if (!libraryId) usage();
      const tokensRaw = flagValue(rest, "--tokens");
      const tokensParsed = tokensRaw !== undefined ? Number(tokensRaw) : undefined;
      console.log((await getLibraryDocsRemote(fetchFn, {
        context7CompatibleLibraryID: libraryId,
        tokens: tokensParsed !== undefined && Number.isFinite(tokensParsed) ? tokensParsed : undefined,
        topic: flagValue(rest, "--topic"),
      }, apiKey)).text);
    } else {
      usage();
    }
  } catch (err) {
    console.error(`error: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }
}
void main();
