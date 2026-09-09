// ============================================================
// E-com.casa — Research HTTP client
// ------------------------------------------------------------
// Bounded, polite, honest: timeout, retry with exponential
// backoff, throttling, fixed user agent, response size limits,
// content-type validation and structured error records.
// Never disguises itself as a browser and never circumvents
// blocking — a blocked source is recorded and skipped.
// ============================================================

import { RESEARCH_CONFIG } from './config';

export type ErrorType =
  | 'timeout'
  | 'http-error'
  | 'blocked'
  | 'too-large'
  | 'invalid-content-type'
  | 'network'
  | 'parse-failed';

export interface RequestError {
  url: string;
  statusCode?: number;
  errorType: ErrorType;
  message: string;
  timestamp: string;
}

export interface FetchResult {
  ok: boolean;
  url: string;
  statusCode?: number;
  body?: string;
  contentType?: string;
  error?: RequestError;
  elapsedMs: number;
}

const { delayMs, maxConcurrency, timeoutMs, maxResponseBytes, maxRetries, backoffBaseMs, userAgent } =
  RESEARCH_CONFIG.request;

const errorLog: RequestError[] = [];

export function getErrorLog(): RequestError[] {
  return [...errorLog];
}

let lastRequestAt = 0;
let activeCount = 0;
const queue: Array<() => void> = [];

async function throttleSlot(): Promise<void> {
  if (activeCount >= maxConcurrency) {
    await new Promise<void>((resolve) => queue.push(resolve));
  }
  activeCount++;
  const wait = delayMs - (Date.now() - lastRequestAt);
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastRequestAt = Date.now();
}

function releaseSlot(): void {
  activeCount--;
  const next = queue.shift();
  if (next) next();
}

export function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchOnce(url: string): Promise<FetchResult> {
  const started = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      redirect: 'follow',
      headers: {
        'User-Agent': userAgent,
        Accept: 'text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-GB,en;q=0.8',
      },
    });
    const contentType = res.headers.get('content-type') ?? '';
    if (res.status === 403 || res.status === 429 || res.status === 503) {
      return {
        ok: false,
        url,
        statusCode: res.status,
        error: {
          url,
          statusCode: res.status,
          errorType: 'blocked',
          message: `Source blocked the research client (HTTP ${res.status}). Stopping requests to this resource — not circumventing.`,
          timestamp: new Date().toISOString(),
        },
        elapsedMs: Date.now() - started,
      };
    }
    if (!res.ok) {
      return {
        ok: false,
        url,
        statusCode: res.status,
        error: {
          url,
          statusCode: res.status,
          errorType: 'http-error',
          message: `HTTP ${res.status}`,
          timestamp: new Date().toISOString(),
        },
        elapsedMs: Date.now() - started,
      };
    }
    if (!/text\/html|application\/json|text\/plain|application\/ld\+json|application\/xml|text\/xml/i.test(contentType)) {
      return {
        ok: false,
        url,
        statusCode: res.status,
        contentType,
        error: {
          url,
          statusCode: res.status,
          errorType: 'invalid-content-type',
          message: `Unsupported content-type: ${contentType}`,
          timestamp: new Date().toISOString(),
        },
        elapsedMs: Date.now() - started,
      };
    }
    const buffer = await res.arrayBuffer();
    if (buffer.byteLength > maxResponseBytes) {
      return {
        ok: false,
        url,
        statusCode: res.status,
        error: {
          url,
          statusCode: res.status,
          errorType: 'too-large',
          message: `Response ${buffer.byteLength} bytes exceeds limit ${maxResponseBytes}`,
          timestamp: new Date().toISOString(),
        },
        elapsedMs: Date.now() - started,
      };
    }
    return {
      ok: true,
      url,
      statusCode: res.status,
      contentType,
      body: new TextDecoder('utf-8', { fatal: false }).decode(buffer),
      elapsedMs: Date.now() - started,
    };
  } catch (e) {
    const err = e as Error;
    const isTimeout = err.name === 'AbortError';
    return {
      ok: false,
      url,
      error: {
        url,
        errorType: isTimeout ? 'timeout' : 'network',
        message: err.message.slice(0, 200),
        timestamp: new Date().toISOString(),
      },
      elapsedMs: Date.now() - started,
    };
  } finally {
    clearTimeout(timer);
  }
}

/** Throttled fetch with retry + exponential backoff. */
export async function politeFetch(url: string): Promise<FetchResult> {
  await throttleSlot();
  try {
    let last: FetchResult | null = null;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      if (attempt > 0) await sleep(backoffBaseMs * 2 ** (attempt - 1));
      last = await fetchOnce(url);
      if (last.ok) return last;
      const type = last.error?.errorType;
      // Do not retry blocked / permanent conditions — record and move on
      if (type === 'blocked' || type === 'too-large' || type === 'invalid-content-type') break;
    }
    if (last?.error) errorLog.push(last.error);
    return last!;
  } finally {
    releaseSlot();
  }
}

export function recordError(error: RequestError): void {
  errorLog.push(error);
}
