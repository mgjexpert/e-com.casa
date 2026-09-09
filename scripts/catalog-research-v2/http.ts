// ============================================================
// E-com.casa — V2 polite HTTP client
// ------------------------------------------------------------
// Bounded, throttled, honest: timeout, retry with exponential
// backoff, global delay, honest UA, response size limits,
// content-type validation. Never disguises itself and never
// circumvents blocking — a blocked source is recorded (BLOCKED)
// and skipped (prompt §3/§46/§90).
// ============================================================

import { V2_CONFIG } from './config';

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
  finalUrl?: string;
  statusCode?: number;
  body?: string;
  contentType?: string;
  error?: RequestError;
  elapsedMs: number;
}

const { delayMs, maxConcurrency, timeoutMs, maxResponseBytes, maxRetries, backoffBaseMs, userAgent } =
  V2_CONFIG.request;

export const requestErrors: RequestError[] = [];

let lastRequestAt = 0;
let activeCount = 0;
const queue: Array<() => void> = [];

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function throttleSlot(delay = delayMs): Promise<void> {
  if (activeCount >= maxConcurrency) {
    await new Promise<void>((resolve) => queue.push(resolve));
  }
  activeCount++;
  const wait = delay - (Date.now() - lastRequestAt);
  if (wait > 0) await sleep(wait);
  lastRequestAt = Date.now();
}

function releaseSlot(): void {
  activeCount--;
  const next = queue.shift();
  if (next) next();
}

async function fetchOnce(url: string, method: 'GET' | 'HEAD' = 'GET'): Promise<FetchResult> {
  const started = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method,
      signal: controller.signal,
      redirect: 'follow',
      headers: {
        'User-Agent': userAgent,
        Accept: 'text/html,application/xhtml+xml,application/xml,application/json;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-GB,en;q=0.8,de;q=0.6',
        'Accept-Encoding': 'gzip, br',
      },
    });
    const contentType = res.headers.get('content-type') ?? '';
    if (res.status === 401 || res.status === 403 || res.status === 429 || res.status === 503) {
      return {
        ok: false,
        url,
        statusCode: res.status,
        error: {
          url,
          statusCode: res.status,
          errorType: 'blocked',
          message: `Source blocked or rate-limited the research client (HTTP ${res.status}). Stopping — not circumventing.`,
          timestamp: new Date().toISOString(),
        },
        elapsedMs: Date.now() - started,
      };
    }
    if (!res.ok && method === 'HEAD') {
      // HEAD may be unsupported on some CDNs — record status, caller decides
      return { ok: false, url, finalUrl: res.url, statusCode: res.status, contentType, elapsedMs: Date.now() - started };
    }
    if (!res.ok) {
      return {
        ok: false,
        url,
        finalUrl: res.url,
        statusCode: res.status,
        error: { url, statusCode: res.status, errorType: 'http-error', message: `HTTP ${res.status}`, timestamp: new Date().toISOString() },
        elapsedMs: Date.now() - started,
      };
    }
    if (method === 'HEAD') {
      return { ok: true, url, finalUrl: res.url, statusCode: res.status, contentType, elapsedMs: Date.now() - started };
    }
    const allowed = /text\/html|application\/json|text\/plain|application\/ld\+json|application\/xml|text\/xml|application\/javascript/i;
    if (!allowed.test(contentType)) {
      return {
        ok: false,
        url,
        finalUrl: res.url,
        statusCode: res.status,
        contentType,
        error: { url, statusCode: res.status, errorType: 'invalid-content-type', message: `Unsupported content-type: ${contentType}`, timestamp: new Date().toISOString() },
        elapsedMs: Date.now() - started,
      };
    }
    const buffer = await res.arrayBuffer();
    if (buffer.byteLength > maxResponseBytes) {
      return {
        ok: false,
        url,
        statusCode: res.status,
        error: { url, statusCode: res.status, errorType: 'too-large', message: `Response ${buffer.byteLength}B exceeds ${maxResponseBytes}B limit`, timestamp: new Date().toISOString() },
        elapsedMs: Date.now() - started,
      };
    }
    return {
      ok: true,
      url,
      finalUrl: res.url,
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

/** Throttled fetch with retry + exponential backoff (HTML/JSON pages). */
export async function politeFetch(url: string): Promise<FetchResult> {
  await throttleSlot();
  try {
    let last: FetchResult | null = null;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      if (attempt > 0) await sleep(backoffBaseMs * 2 ** (attempt - 1));
      last = await fetchOnce(url);
      if (last.ok) return last;
      const type = last.error?.errorType;
      if (type === 'blocked' || type === 'too-large' || type === 'invalid-content-type') break;
    }
    if (last?.error) requestErrors.push(last.error);
    return last!;
  } finally {
    releaseSlot();
  }
}

/** Lightweight image validation: ranged GET for metadata (HEAD-less, CDN-safe).
 *  Verifies content-type and size — rejects icons, logos and tracking pixels. */
export async function checkImage(url: string): Promise<{
  ok: boolean;
  statusCode?: number;
  contentType?: string;
  contentLength?: number;
  error?: string;
}> {
  await throttleSlot(V2_CONFIG.images.imageDelayMs);
  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: { 'User-Agent': userAgent, Range: 'bytes=0-2047', Accept: 'image/*' },
      signal: AbortSignal.timeout(timeoutMs),
      redirect: 'follow',
    });
    const contentType = res.headers.get('content-type') ?? '';
    let contentLength: number | undefined;
    const contentRange = res.headers.get('content-range'); // "bytes 0-2047/84321"
    if (contentRange?.includes('/')) contentLength = parseInt(contentRange.split('/')[1] ?? '', 10) || undefined;
    if (contentLength === undefined) {
      contentLength = parseInt(res.headers.get('content-length') ?? '', 10) || undefined;
    }
    await res.body?.cancel().catch(() => {});
    if (res.status === 401 || res.status === 403 || res.status === 429 || res.status === 503) {
      return { ok: false, statusCode: res.status, contentType, error: `Blocked (HTTP ${res.status})` };
    }
    if (!res.ok) {
      return { ok: false, statusCode: res.status, contentType, error: `HTTP ${res.status}` };
    }
    if (contentType && !/^image\//i.test(contentType)) {
      return { ok: false, statusCode: res.status, contentType, error: `Not an image: ${contentType}` };
    }
    if (contentLength !== undefined && contentLength < V2_CONFIG.images.minImageBytes) {
      return { ok: false, statusCode: res.status, contentType, error: 'Too small (icon/pixel)' };
    }
    return { ok: true, statusCode: res.status, contentType, contentLength };
  } catch (e) {
    return { ok: false, error: (e as Error).message.slice(0, 120) };
  } finally {
    releaseSlot();
  }
}

/** Download an image into the research-only assets directory (never published). */
export async function downloadImage(url: string, destAbsPath: string): Promise<{ ok: boolean; bytes?: number; error?: string }> {
  await throttleSlot(V2_CONFIG.images.imageDelayMs);
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': userAgent, Accept: 'image/*' },
      signal: AbortSignal.timeout(timeoutMs * 2),
      redirect: 'follow',
    });
    if (!res.ok) return { ok: false, error: `HTTP ${res.status}` };
    const type = res.headers.get('content-type') ?? '';
    if (type && !/^image\//i.test(type)) return { ok: false, error: `Not an image: ${type}` };
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.byteLength > V2_CONFIG.images.maxImageBytes) return { ok: false, error: 'Image too large' };
    if (buf.byteLength < V2_CONFIG.images.minImageBytes) return { ok: false, error: 'Too small (icon/pixel)' };
    const { writeFileSync, mkdirSync } = await import('node:fs');
    const { dirname } = await import('node:path');
    mkdirSync(dirname(destAbsPath), { recursive: true });
    writeFileSync(destAbsPath, buf);
    return { ok: true, bytes: buf.byteLength };
  } catch (e) {
    return { ok: false, error: (e as Error).message.slice(0, 140) };
  } finally {
    releaseSlot();
  }
}

export function sleepFor(ms: number): Promise<void> {
  return sleep(ms);
}
