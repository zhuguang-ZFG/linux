#!/usr/bin/env node
// Offline-friendly metadata audit for resources/videos.json.
// Checks provider endpoints ONLY (Bilibili view API by bvid, YouTube oEmbed).
// It never downloads or embeds media and never claims playback success.
// Read-only: resources/videos.json is never mutated.

import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const USER_AGENT = 'road-to-linux-media-audit/1.0 (+https://github.com/zhuguang-ZFG/linux; metadata endpoint availability only)';
export const METADATA_ONLY_NOTE = 'Endpoint/metadata availability only; playback is NOT verified and no media is downloaded.';
const DEFAULT_TIMEOUT_MS = 10_000;
const CONCURRENCY = 4;

export class UsageError extends Error {}

const HELP = `Usage: node scripts/audit-media.mjs [options]

Read-only availability audit of provider endpoints for records in resources/videos.json.
Bilibili records are checked via the public view API (bvid); YouTube records via the
official oEmbed endpoint for the watch URL. No media is downloaded or embedded; a
"reachable" result means the metadata endpoint answered, not that playback works.

Options:
  --json <path>     Also write a machine-readable report to <path>.
  --timeout <ms>    Per-request timeout in milliseconds (default ${DEFAULT_TIMEOUT_MS}).
  --strict          Exit 1 when any record is not "reachable" (default: always exit 0).
  --help            Show this help.

Exit codes: 0 = audit ran (default mode), 1 = strict mode with non-reachable records,
2 = malformed options or unreadable input.`;

export function parseArgs(argv) {
  const opts = { jsonPath: null, timeoutMs: DEFAULT_TIMEOUT_MS, strict: false, help: false };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--help' || arg === '-h') { opts.help = true; continue; }
    if (arg === '--strict') { opts.strict = true; continue; }
    if (arg === '--json' || arg === '--timeout') {
      const value = argv[++i];
      if (value === undefined || value.startsWith('--')) throw new UsageError(`Option ${arg} requires a value`);
      if (arg === '--json') opts.jsonPath = value;
      else {
        const ms = Number(value);
        if (!Number.isInteger(ms) || ms < 1000 || ms > 120_000) throw new UsageError(`--timeout must be an integer between 1000 and 120000 ms, got: ${value}`);
        opts.timeoutMs = ms;
      }
      continue;
    }
    throw new UsageError(`Unknown option: ${arg}`);
  }
  return opts;
}

export function requestFor(video) {
  if (video.platform === 'bilibili') {
    return { providerUrl: `https://api.bilibili.com/x/web-interface/view?bvid=${video.providerId}`, kind: 'bilibili-view' };
  }
  if (video.platform === 'youtube') {
    const watch = `https://www.youtube.com/watch?v=${video.providerId}`;
    return { providerUrl: `https://www.youtube.com/oembed?url=${encodeURIComponent(watch)}&format=json`, kind: 'youtube-oembed' };
  }
  throw new UsageError(`Unknown platform for record ${video.id}: ${video.platform}`);
}

const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);

export function classifyBilibili(httpStatus, payload) {
  if (httpStatus !== 200) return { status: 'unavailable', note: `HTTP ${httpStatus}` };
  if (!isObject(payload) || typeof payload.code !== 'number') return { status: 'invalid_response', note: 'Unexpected JSON shape (missing numeric code)' };
  if (payload.code === 0 && isObject(payload.data) && typeof payload.data.title === 'string') {
    return { status: 'reachable', note: `View API returned metadata for "${payload.data.title}"` };
  }
  return { status: 'unavailable', note: `API code ${payload.code}: ${typeof payload.message === 'string' ? payload.message : 'no message'}` };
}

export function classifyOembed(httpStatus, payload) {
  if (httpStatus === 200) {
    if (isObject(payload) && typeof payload.title === 'string' && typeof payload.author_name === 'string') {
      return { status: 'reachable', note: `oEmbed returned metadata for "${payload.title}"` };
    }
    return { status: 'invalid_response', note: 'Unexpected oEmbed JSON shape' };
  }
  if ([400, 401, 403, 404].includes(httpStatus)) return { status: 'unavailable', note: `HTTP ${httpStatus}` };
  return { status: 'error', note: `HTTP ${httpStatus}` };
}

async function probe(descriptor, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let httpStatus = null;
  try {
    const response = await fetch(descriptor.providerUrl, {
      signal: controller.signal,
      redirect: 'follow',
      headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
    });
    httpStatus = response.status;
    let payload = null;
    let parseFailed = false;
    try { payload = await response.json(); } catch { parseFailed = true; }
    if (parseFailed && descriptor.kind === 'bilibili-view') return { httpStatus, status: 'invalid_response', note: 'Non-JSON body from view API' };
    if (parseFailed) return httpStatus === 200
      ? { httpStatus, status: 'invalid_response', note: 'Non-JSON body from oEmbed' }
      : { httpStatus, ...classifyOembed(httpStatus, null) };
    const verdict = descriptor.kind === 'bilibili-view'
      ? classifyBilibili(httpStatus, payload)
      : classifyOembed(httpStatus, payload);
    return { httpStatus, ...verdict };
  } catch (error) {
    if (error?.name === 'AbortError') return { httpStatus: null, status: 'timeout', note: `No response within ${timeoutMs} ms` };
    return { httpStatus, status: 'error', note: `${error?.name || 'Error'}: ${error?.cause?.code || error?.message || 'request failed'}` };
  } finally {
    clearTimeout(timer);
  }
}

export function summarize(results) {
  const counts = { reachable: 0, unavailable: 0, invalid_response: 0, timeout: 0, error: 0 };
  for (const result of results) counts[result.status] += 1;
  return { total: results.length, ...counts, ok: results.every(r => r.status === 'reachable') };
}

export function buildReport(results, auditedAt) {
  return {
    auditedAt,
    note: METADATA_ONLY_NOTE,
    checks: results.map(r => ({
      id: r.id,
      platform: r.platform,
      providerUrl: r.providerUrl,
      status: r.status,
      httpStatus: r.httpStatus,
      note: r.note,
    })),
    summary: summarize(results),
  };
}

async function runPool(items, limit, worker) {
  const outcomes = new Array(items.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const index = next++;
      outcomes[index] = await worker(items[index]);
    }
  }));
  return outcomes;
}

async function main(argv) {
  let opts;
  try {
    opts = parseArgs(argv);
  } catch (error) {
    if (error instanceof UsageError) {
      console.error(`ERROR: ${error.message}\n\n${HELP}`);
      return 2;
    }
    throw error;
  }
  if (opts.help) { console.log(HELP); return 0; }

  const root = fileURLToPath(new URL('../', import.meta.url));
  let videos;
  try {
    videos = JSON.parse(readFileSync(path.join(root, 'resources/videos.json'), 'utf8')).videos;
  } catch (error) {
    console.error(`ERROR: cannot read resources/videos.json: ${error.message}`);
    return 2;
  }

  // Deduplicate endpoint calls: several records (Bilibili parts) share one bvid.
  const descriptors = videos.map(video => ({ id: video.id, platform: video.platform, ...requestFor(video) }));
  const unique = new Map(descriptors.map(descriptor => [descriptor.providerUrl, descriptor]));
  const uniqueUrls = [...unique.keys()];
  const probes = await runPool(uniqueUrls.map(url => unique.get(url)), CONCURRENCY, d => probe(d, opts.timeoutMs));
  const byUrl = new Map(uniqueUrls.map((url, i) => [url, probes[i]]));

  const auditedAt = new Date().toISOString();
  const results = descriptors.map(d => ({ ...d, ...byUrl.get(d.providerUrl) }));
  const report = buildReport(results, auditedAt);

  console.log(`Media endpoint audit (${auditedAt})`);
  console.log(`NOTE: ${METADATA_ONLY_NOTE}`);
  for (const r of results) {
    const http = r.httpStatus === null ? '---' : String(r.httpStatus);
    console.log(`${r.status.padEnd(16)} http=${http.padEnd(3)} ${r.id} [${r.platform}] ${r.providerUrl} — ${r.note}`);
  }
  const s = report.summary;
  console.log(`Summary: ${s.reachable}/${s.total} reachable, ${s.unavailable} unavailable, ${s.invalid_response} invalid_response, ${s.timeout} timeout, ${s.error} error`);

  if (opts.jsonPath) {
    writeFileSync(path.resolve(opts.jsonPath), JSON.stringify(report, null, 2) + '\n');
    console.log(`JSON report written to ${opts.jsonPath}`);
  }
  if (opts.strict && !report.summary.ok) {
    console.error('STRICT: one or more records are not reachable');
    return 1;
  }
  return 0;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  process.exit(await main(process.argv.slice(2)));
}
