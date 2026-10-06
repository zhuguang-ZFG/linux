import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, utimesSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const script = fileURLToPath(new URL('./backup.sh', import.meta.url));
const bash = process.env.BASH_BIN || (process.platform === 'win32' ? 'C:/Program Files/Git/bin/bash.exe' : 'bash');
const posix = value => process.platform === 'win32'
  ? value.replaceAll('\\', '/').replace(/^([A-Za-z]):/, (_, drive) => `/${drive.toLowerCase()}`)
  : value;

function fixture(t) {
  const root = mkdtempSync(path.join(os.tmpdir(), 'linux-backup-test-'));
  t.after(() => {
    // Only remove the uniquely created test directory directly inside the temp root.
    assert.equal(path.dirname(root), path.resolve(os.tmpdir()));
    assert.match(path.basename(root), /^linux-backup-test-/);
    rmSync(root, { recursive: true, force: true });
  });
  const src = path.join(root, 'source files');
  const dst = path.join(root, 'backup files');
  mkdirSync(src);
  writeFileSync(path.join(src, 'hello world.txt'), 'hello from backup\n');
  return { root, src, dst };
}

function run(f, { dry = false, failTar = false, failFind = false } = {}) {
  let args = [posix(script), ...(dry ? ['--dry-run'] : []), posix(f.src), posix(f.dst)];
  if (failTar || failFind) {
    const bin = path.join(f.root, 'bin');
    mkdirSync(bin);
    writeFileSync(path.join(bin, failFind ? 'find' : 'tar'), '#!/usr/bin/env bash\nexit 42\n', { mode: 0o755 });
    args = ['-c', 'PATH="$1:$PATH"; shift; exec bash "$@"', 'test', posix(bin), ...args];
  }
  const result = spawnSync(bash, args, { cwd: f.root, encoding: 'utf8', timeout: 20000 });
  assert.ifError(result.error);
  return result;
}

function archives(dst) {
  return readdirSync(dst).filter(name => /^backup_.*\.tar\.gz$/.test(name)).sort();
}

function seed(dst, count) {
  mkdirSync(dst);
  for (let i = 1; i <= count; i++) {
    const filename = path.join(dst, `backup_old '${i}.tar.gz`);
    writeFileSync(filename, `old backup ${i}`);
    utimesSync(filename, 1700000000 + i, 1700000000 + i);
  }
}

function snapshot(dir) {
  return readdirSync(dir).sort().map(name => {
    const filename = path.join(dir, name);
    return [name, statSync(filename).isDirectory() ? snapshot(filename) : readFileSync(filename).toString('hex')];
  });
}

test('creates missing destination and restores a file with spaces in its name', t => {
  const f = fixture(t);
  const result = run(f);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(archives(f.dst).length, 1);
  const restore = path.join(f.root, 'restore');
  mkdirSync(restore);
  const extracted = spawnSync(bash, ['-c', 'tar -xzf "$1" -C "$2"', 'test', posix(path.join(f.dst, archives(f.dst)[0])), posix(restore)], { encoding: 'utf8' });
  assert.ifError(extracted.error);
  assert.equal(extracted.status, 0, extracted.stderr);
  assert.equal(readFileSync(path.join(restore, 'source files', 'hello world.txt'), 'utf8'), 'hello from backup\n');
  assert.deepEqual(readdirSync(f.dst), archives(f.dst));
});

test('retains exactly five archives without splitting paths or touching unrelated files', t => {
  const f = fixture(t);
  seed(f.dst, 7);
  writeFileSync(path.join(f.root, 'files'), 'do not delete');
  writeFileSync(path.join(f.dst, 'notes.txt'), 'keep notes');
  mkdirSync(path.join(f.dst, 'nested'));
  writeFileSync(path.join(f.dst, 'nested', 'backup_nested.tar.gz'), 'keep nested');
  const result = run(f);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(archives(f.dst).length, 5);
  for (let i = 1; i <= 3; i++) assert.equal(existsSync(path.join(f.dst, `backup_old '${i}.tar.gz`)), false);
  for (let i = 4; i <= 7; i++) assert.equal(existsSync(path.join(f.dst, `backup_old '${i}.tar.gz`)), true);
  assert.equal(readFileSync(path.join(f.root, 'files'), 'utf8'), 'do not delete');
  assert.equal(readFileSync(path.join(f.dst, 'notes.txt'), 'utf8'), 'keep notes');
  assert.equal(readFileSync(path.join(f.dst, 'nested', 'backup_nested.tar.gz'), 'utf8'), 'keep nested');
});

test('dry-run of a new destination writes nothing', t => {
  const f = fixture(t);
  const before = snapshot(f.root);
  const result = run(f, { dry: true });
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(snapshot(f.root), before);
});

test('dry-run reports a failed directory scan instead of a successful empty plan', t => {
  const f = fixture(t);
  seed(f.dst, 5);
  const before = snapshot(f.dst);
  const result = run(f, { dry: true, failFind: true });
  assert.notEqual(result.status, 0);
  assert.deepEqual(snapshot(f.dst), before);
});

test('dry-run reserves one slot for the sixth archive and actual run retains five', t => {
  const f = fixture(t);
  seed(f.dst, 5);
  const before = snapshot(f.root);
  const preview = run(f, { dry: true });
  assert.equal(preview.status, 0, preview.stderr);
  assert.match(preview.stdout, /backup_old '1\.tar\.gz/);
  assert.doesNotMatch(preview.stdout, /backup_old '2\.tar\.gz/);
  assert.deepEqual(snapshot(f.root), before);
  const result = run(f);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(archives(f.dst).length, 5);
  assert.equal(existsSync(path.join(f.dst, "backup_old '1.tar.gz")), false);
});

test('failed archiving leaves all old backups intact and removes temporary files', t => {
  const f = fixture(t);
  seed(f.dst, 5);
  const before = snapshot(f.dst);
  const result = run(f, { failTar: true });
  assert.notEqual(result.status, 0);
  assert.deepEqual(snapshot(f.dst), before);
});

test('rejects a destination inside the source before creating it', t => {
  const f = fixture(t);
  f.dst = path.join(f.src, 'nested backups');
  const result = run(f);
  assert.notEqual(result.status, 0);
  assert.equal(existsSync(f.dst), false);
});

test('an existing lock prevents writes and is not removed by another run', t => {
  const f = fixture(t);
  seed(f.dst, 5);
  mkdirSync(path.join(f.dst, '.backup.lock'));
  const before = snapshot(f.dst);
  const result = run(f);
  assert.notEqual(result.status, 0);
  assert.deepEqual(snapshot(f.dst), before);
});
