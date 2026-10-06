import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  METADATA_ONLY_NOTE,
  UsageError,
  buildReport,
  classifyBilibili,
  classifyOembed,
  parseArgs,
  requestFor,
  summarize,
} from './audit-media.mjs';

test('parseArgs defaults and valid options', () => {
  assert.deepEqual(parseArgs([]), { jsonPath: null, timeoutMs: 10_000, strict: false, help: false });
  assert.deepEqual(parseArgs(['--strict', '--json', 'out/report.json', '--timeout', '5000']),
    { jsonPath: 'out/report.json', timeoutMs: 5000, strict: true, help: false });
  assert.equal(parseArgs(['--help']).help, true);
});

test('parseArgs rejects malformed options clearly', () => {
  assert.throws(() => parseArgs(['--bogus']), (e) => e instanceof UsageError && /--bogus/.test(e.message));
  assert.throws(() => parseArgs(['--json']), UsageError);
  assert.throws(() => parseArgs(['--timeout', 'abc']), UsageError);
  assert.throws(() => parseArgs(['--timeout', '10']), UsageError);
  assert.throws(() => parseArgs(['--json', '--strict']), UsageError);
});

test('requestFor builds bilibili view API and youtube oEmbed URLs', () => {
  const bili = requestFor({ id: 'b-ssh', platform: 'bilibili', providerId: 'BV1Sv411r7vd' });
  assert.equal(bili.providerUrl, 'https://api.bilibili.com/x/web-interface/view?bvid=BV1Sv411r7vd');
  const yt = requestFor({ id: 'y-ssh', platform: 'youtube', providerId: 'abcdefghijk' });
  const url = new URL(yt.providerUrl);
  assert.equal(url.hostname, 'www.youtube.com');
  assert.equal(url.searchParams.get('url'), 'https://www.youtube.com/watch?v=abcdefghijk');
  assert.equal(url.searchParams.get('format'), 'json');
  assert.throws(() => requestFor({ id: 'x', platform: 'vimeo', providerId: '1' }), UsageError);
});

test('classifyBilibili distinguishes reachable, unavailable and invalid_response', () => {
  assert.equal(classifyBilibili(200, { code: 0, data: { title: 'SSH 远程登录' } }).status, 'reachable');
  assert.equal(classifyBilibili(200, { code: -404, message: '啥都木有' }).status, 'unavailable');
  assert.equal(classifyBilibili(404, null).status, 'unavailable');
  assert.equal(classifyBilibili(200, { data: {} }).status, 'invalid_response');
  assert.equal(classifyBilibili(200, null).status, 'invalid_response');
});

test('classifyOembed distinguishes reachable, unavailable, invalid_response and error', () => {
  assert.equal(classifyOembed(200, { title: 't', author_name: 'a' }).status, 'reachable');
  assert.equal(classifyOembed(200, { title: 't' }).status, 'invalid_response');
  assert.equal(classifyOembed(404, null).status, 'unavailable');
  assert.equal(classifyOembed(401, null).status, 'unavailable');
  assert.equal(classifyOembed(500, null).status, 'error');
});

test('summarize counts every status and ok only when all reachable', () => {
  const rows = [
    { status: 'reachable' }, { status: 'reachable' }, { status: 'unavailable' },
    { status: 'timeout' }, { status: 'error' }, { status: 'invalid_response' },
  ];
  assert.deepEqual(summarize(rows), { total: 6, reachable: 2, unavailable: 1, invalid_response: 1, timeout: 1, error: 1, ok: false });
  assert.equal(summarize([{ status: 'reachable' }]).ok, true);
});

test('buildReport embeds the metadata-only disclaimer and per-record fields', () => {
  const report = buildReport([{ id: 'b-ssh', platform: 'bilibili', providerUrl: 'https://api.bilibili.com/x', status: 'reachable', httpStatus: 200, note: 'ok' }], '2026-10-07T00:00:00.000Z');
  assert.equal(report.auditedAt, '2026-10-07T00:00:00.000Z');
  assert.equal(report.note, METADATA_ONLY_NOTE);
  assert.match(report.note, /NOT verified/);
  assert.deepEqual(Object.keys(report.checks[0]).sort(), ['httpStatus', 'id', 'note', 'platform', 'providerUrl', 'status']);
  assert.equal(report.summary.total, 1);
});
