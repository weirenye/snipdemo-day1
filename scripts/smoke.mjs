import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { once } from 'node:events';
import { createServer } from 'node:net';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const bundled = process.argv.includes('--bundle');
const folder = resolve(root, bundled ? 'bundle' : 'backend');
const cli = resolve(root, bundled ? 'bundle/cli.js' : 'cli/cli.js');
let child;
let logs = '';
let base = process.env.SNIP_TEST_URL;

try {
  if (!base) {
    const socket = createServer();
    socket.listen(0, '127.0.0.1');
    await once(socket, 'listening');
    const port = socket.address().port;
    await new Promise((done, reject) => socket.close(error => error ? reject(error) : done()));
    base = `http://127.0.0.1:${port}`;
    child = spawn('bun', ['server.js'], {
      cwd: folder,
      env: {
        ...process.env, PORT: String(port), BASE_URL: base,
        PUBLIC_DIR: bundled ? resolve(folder, 'public') : '',
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    child.stdout.on('data', data => { logs += data; });
    child.stderr.on('data', data => { logs += data; });
    await once(child, 'spawn');
  }
  let ready = false;
  for (let attempt = 0; attempt < 60; attempt++) {
    try {
      const response = await fetch(`${base}/api/links`, { signal: AbortSignal.timeout(1000) });
      if (response.status === 200) { ready = true; break; }
    } catch (error) {
      if (child && child.exitCode !== null) throw new Error(`Server exited: ${logs}`, { cause: error });
    }
    await new Promise(done => setTimeout(done, 250));
  }
  assert.ok(ready, `Server did not become ready: ${logs}`);
  const request = (path, options) => fetch(`${base}${path}`, options);
  const runCli = (...args) => spawnSync(process.execPath, [cli, ...args], {
    env: { ...process.env, SNIP_API: base }, encoding: 'utf8', timeout: 15000,
  });
  const help = runCli('help');
  assert.equal(help.status, 0, help.stderr);
  assert.match(help.stdout, /Usage:/);
  for (const body of ['{', '{"url":"file:///private"}', '{}']) {
    const response = await request('/api/links', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body,
    });
    assert.equal(response.status, 400);
    assert.equal(typeof (await response.json()).error, 'string');
  }
  const preflight = await request('/api/links', { method: 'OPTIONS' });
  assert.equal(preflight.status, 204);
  assert.equal(preflight.headers.get('access-control-allow-origin'), '*');
  const response = await request('/api/links', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ url: 'https://example.com/snip-smoke' }),
  });
  assert.equal(response.status, 201);
  const link = await response.json();
  assert.deepEqual(Object.keys(link).sort(), ['code', 'createdAt', 'hits', 'shortUrl', 'url']);
  assert.match(link.code, /^[A-Za-z0-9]{6}$/);
  assert.equal(link.hits, 0);
  assert.equal(link.url, 'https://example.com/snip-smoke');
  assert.equal(new URL(link.shortUrl).pathname, `/${link.code}`);
  assert.equal(new Date(link.createdAt).toISOString(), link.createdAt);
  const redirect = await request(`/${link.code}`, { redirect: 'manual' });
  assert.equal(redirect.status, 302);
  assert.equal(redirect.headers.get('location'), link.url);
  const list = await request('/api/links');
  assert.equal(list.status, 200);
  assert.equal((await list.json()).find(item => item.code === link.code).hits, 1);
  assert.equal((await request('/unknown-code')).status, 404);
  const cliList = runCli('ls');
  assert.equal(cliList.status, 0, cliList.stderr);
  assert.ok(cliList.stdout.includes(link.code));
  const cliAdd = runCli('add', 'https://example.com/cli-smoke');
  assert.equal(cliAdd.status, 0, cliAdd.stderr);
  assert.match(cliAdd.stdout.trim(), /^https?:\/\/.+\/[A-Za-z0-9]{6}$/);
  const badCli = runCli('add', 'file:///private');
  assert.equal(badCli.status, 1);
  assert.match(badCli.stderr, /Error:/);
  if (bundled) {
    const ui = await request('/');
    assert.equal(ui.status, 200);
    assert.match(await ui.text(), /<app-root/);
  }
  console.log(`PASS: ${bundled ? 'bundle UI + ' : ''}API contract, redirects/hits, CORS and CLI integration`);
} finally {
  if (child && child.exitCode === null) {
    const stopped = once(child, 'exit');
    child.kill();
    await stopped;
  }
}
