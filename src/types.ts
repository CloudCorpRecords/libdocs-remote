/**
 * libdocs-remote types.
 *
 * The two tools mirror the local Context7 surface: resolve a library
 * name to a Context7-compatible library ID, then fetch documentation
 * for that ID. Here both operations are forwarded to the hosted
 * remote MCP endpoint instead of a REST API. HTTP access is described
 * by a minimal response surface so tests can inject a fake fetch.
 */

export interface ResolveOptions {
  libraryName: string;
}

export interface DocsOptions {
  context7CompatibleLibraryID: string;
  tokens?: number;
  topic?: string;
}

export interface RemoteResult {
  /** The result text exactly as the upstream remote server returns it. */
  text: string;
}

export interface HttpResponse {
  ok: boolean;
  status: number;
  statusText?: string;
  headers: { get(name: string): string | null };
  text(): Promise<string>;
}

export type FetchFn = (
  url: string,
  init?: {
    method?: string;
    headers?: Record<string, string>;
    body?: string;
    redirect?: string;
  },
) => Promise<HttpResponse>;
