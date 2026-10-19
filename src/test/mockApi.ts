import { vi } from 'vitest';
import { API_BASE_URL } from '../lib/api';

export interface MockRequest {
  method: string;
  path: string;
  url: string;
  body: unknown;
}

export type MockReply = { status?: number; body?: unknown } | unknown;
export type MockHandler = MockReply | ((request: MockRequest) => MockReply);

/**
 * Replaces fetch with a route table keyed by "METHOD /path" (query string and API base URL ignored).
 * A route value is the JSON response body, or a function returning `{ status, body }`.
 */
export function mockApi(routes: Record<string, MockHandler>) {
  const calls: MockRequest[] = [];

  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input).replace(API_BASE_URL, '');
    const method = init?.method ?? 'GET';
    const path = url.split('?')[0] ?? url;
    const body = typeof init?.body === 'string' ? (JSON.parse(init.body) as unknown) : undefined;
    const request: MockRequest = { method, path, url, body };
    calls.push(request);

    const handler = routes[`${method} ${path}`];
    if (handler === undefined) {
      return new Response(
        JSON.stringify({ error: { code: 'not_found', message: `sem rota ${method} ${path}` } }),
        {
          status: 404,
        },
      );
    }
    const reply =
      typeof handler === 'function' ? (handler as (r: MockRequest) => MockReply)(request) : handler;
    const { status, body: replyBody } = isEnvelope(reply) ? reply : { status: 200, body: reply };
    if (status === 204) return new Response(null, { status });
    return new Response(JSON.stringify(replyBody), { status: status ?? 200 });
  });

  vi.stubGlobal('fetch', fetchMock);
  return {
    calls,
    called: (method: string, path: string) => calls.filter((c) => c.method === method && c.path === path),
  };
}

function isEnvelope(reply: unknown): reply is { status?: number; body?: unknown } {
  return (
    typeof reply === 'object' &&
    reply !== null &&
    !Array.isArray(reply) &&
    ('status' in reply || 'body' in reply)
  );
}

export function apiError(status: number, code: string, message: string) {
  return { status, body: { error: { code, message } } };
}
