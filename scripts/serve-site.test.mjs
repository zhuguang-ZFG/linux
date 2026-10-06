import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import net from 'node:net';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const script = fileURLToPath(new URL('./serve-site.mjs', import.meta.url));

function runServer(env) {
  const result = spawnSync(process.execPath, [script], {
    encoding: 'utf8',
    timeout: 15000,
    env: { ...process.env, ...env },
  });
  assert.ifError(result.error);
  return result;
}

function freePort() {
  return new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.once('error', reject);
    probe.listen(0, '127.0.0.1', () => {
      const { port } = probe.address();
      probe.close(() => resolve(port));
    });
  });
}

function waitForLine(child, regex) {
  return new Promise((resolve, reject) => {
    let output = '';
    child.stdout.setEncoding('utf8');
    child.stdout.on('data', chunk => {
      output += chunk;
      const line = output.split('\n').find(entry => regex.test(entry));
      if (line) resolve(line);
    });
    child.once('error', reject);
    child.once('exit', code => reject(new Error(`server exited with code ${code} before matching ${regex}: ${output}`)));
  });
}

test('address-in-use fails with an explicit diagnostic and nonzero exit', async t => {
  const occupier = net.createServer();
  await new Promise((resolve, reject) => {
    occupier.once('error', reject);
    occupier.listen(0, '127.0.0.1', resolve);
  });
  t.after(() => new Promise(resolve => occupier.close(resolve)));
  const port = occupier.address().port;
  const result = runServer({ COURSE_PORT: String(port) });
  assert.equal(result.status, 1);
  assert.match(result.stderr, new RegExp(`Port ${port} is already in use`));
  assert.match(result.stderr, /COURSE_PORT=\d+/);
});

test('invalid COURSE_PORT values fail with an explicit diagnostic and nonzero exit', () => {
  for (const COURSE_PORT of ['abc', '0', '65536', '4173.5']) {
    const result = runServer({ COURSE_PORT });
    assert.equal(result.status, 1, `COURSE_PORT=${COURSE_PORT}`);
    assert.match(result.stderr, /Invalid COURSE_PORT/);
    assert.ok(result.stderr.includes(COURSE_PORT), `diagnostic echoes the rejected value ${COURSE_PORT}`);
    assert.match(result.stderr, /1 and 65535/);
  }
});

test('a free COURSE_PORT starts the preview bound to that port', async t => {
  const port = await freePort();
  const child = spawn(process.execPath, [script], { env: { ...process.env, COURSE_PORT: String(port) } });
  t.after(() => child.kill());
  const line = await waitForLine(child, /^Course preview: /);
  assert.match(line, new RegExp(`^Course preview: http://127\\.0\\.0\\.1:${port}/linux/`));
  const response = await fetch(`http://127.0.0.1:${port}/`, { redirect: 'manual' });
  assert.equal(response.status, 302);
  assert.equal(response.headers.get('location'), '/linux/');
  await response.text();
  child.kill();
});
