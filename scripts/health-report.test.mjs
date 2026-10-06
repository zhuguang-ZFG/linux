import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const script = fileURLToPath(new URL('./health-report.sh', import.meta.url));
const bash = process.env.BASH_BIN || (process.platform === 'win32' ? 'C:/Program Files/Git/bin/bash.exe' : 'bash');
const posix = value => process.platform === 'win32'
  ? value.replaceAll('\\', '/').replace(/^([A-Za-z]):/, (_, drive) => `/${drive.toLowerCase()}`) : value;

function runner(t) {
  const root = mkdtempSync(path.join(os.tmpdir(), 'linux-health-test-'));
  t.after(() => {
    assert.equal(path.dirname(root), path.resolve(os.tmpdir()));
    assert.match(path.basename(root), /^linux-health-test-/);
    rmSync(root, { recursive: true, force: true });
  });
  const bin = path.join(root, 'bin');
  mkdirSync(bin);
  const commands = {
    date: 'echo "UTC: example"', hostname: 'echo example', uname: 'echo Linux', uptime: 'echo "load average: 0"',
    free: 'exit "${TEST_FREE_EXIT:-0}"', ss: 'exit "${TEST_SS_EXIT:-0}"',
    df: 'if [[ ${TEST_DF_FAIL:-} == all || ( ${TEST_DF_FAIL:-} == usage && $1 == -P ) ]]; then exit 1; fi\nprintf "Filesystem Blocks Used Available Capacity Mounted\\n/dev/test 100 24 76 %s%% /\\n" "${TEST_USAGE:-24}"',
  };
  for (const [name, body] of Object.entries(commands)) {
    writeFileSync(path.join(bin, name), `#!/usr/bin/env bash\n${body}\n`, { mode: 0o755 });
  }
  return (args = [], env = {}) => {
    const result = spawnSync(bash, ['--noprofile', '--norc', '-c', 'export PATH="$1:$PATH"; shift; exec bash "$@"',
      'health-test', posix(bin), posix(script), ...args], { encoding: 'utf8', timeout: 10000, env: { ...process.env, ...env } });
    assert.ifError(result.error);
    return result;
  };
}

test('valid collection below threshold reports healthy with exit 0', t => {
  const result = runner(t)();
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /OK: root filesystem 24% < 85%/);
});

test('threshold equality is an alert, including a decimal threshold with leading zero', t => {
  const result = runner(t)(['085'], { TEST_USAGE: '85' });
  assert.equal(result.status, 1, result.stderr);
  assert.match(result.stdout, /WARN: root filesystem 85% >= 85%/);
});

test('collection failure is exit 2, never a disk warning or healthy result', t => {
  const run = runner(t);
  for (const TEST_DF_FAIL of ['all', 'usage']) {
    const result = run([], { TEST_DF_FAIL });
    assert.equal(result.status, 2, result.stderr);
    assert.doesNotMatch(result.stdout, /(?:OK|WARN): root filesystem/);
    assert.match(result.stderr, /ERROR:/);
  }
});

test('unparseable usage is a collection error', t => {
  const result = runner(t)([], { TEST_USAGE: 'unknown' });
  assert.equal(result.status, 2);
  assert.match(result.stderr, /cannot parse/);
});

test('installed optional collectors failing do not produce a misleading healthy report', t => {
  const run = runner(t);
  for (const env of [{ TEST_FREE_EXIT: '1' }, { TEST_SS_EXIT: '1' }]) {
    const result = run([], env);
    assert.equal(result.status, 2);
    assert.doesNotMatch(result.stdout, /OK: root filesystem/);
  }
});

test('invalid and surplus arguments are rejected', t => {
  const run = runner(t);
  for (const args of [[''], ['0'], ['101'], ['abc'], ['85', 'extra']]) {
    assert.equal(run(args).status, 2, JSON.stringify(args));
  }
});

test('help succeeds without invoking a failing collector', t => {
  const result = runner(t)(['--help'], { TEST_DF_FAIL: 'all' });
  assert.equal(result.status, 0);
  assert.doesNotMatch(result.stdout, /Linux health report/);
});
