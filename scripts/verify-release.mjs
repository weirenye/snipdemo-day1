import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const manifest = JSON.parse(readFileSync(resolve(root, 'bundle/release.json'), 'utf8'));
for (const name of ['backend', 'frontend', 'cli']) {
  const result = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: resolve(root, name), encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(manifest.sources[name], result.stdout.trim(), `${name} pin differs from release`);
}
for (const [folder, file] of [['backend', 'server.js'], ['cli', 'cli.js']]) {
  assert.deepEqual(readFileSync(resolve(root, folder, file)), readFileSync(resolve(root, 'bundle', file)));
}
if (process.argv.includes('--public')) {
  const built = resolve(root, 'frontend/dist/snip-frontend/browser');
  const released = resolve(root, 'bundle/public');
  const files = folder => readdirSync(folder, { recursive: true, withFileTypes: true })
    .filter(entry => entry.isFile())
    .map(entry => resolve(entry.parentPath || entry.path, entry.name).slice(folder.length + 1))
    .sort();
  assert.deepEqual(files(built), files(released), 'Release UI file list differs from build');
  for (const file of files(built)) {
    assert.deepEqual(readFileSync(resolve(built, file)), readFileSync(resolve(released, file)), `${file} differs`);
  }
}
console.log('PASS: release matches pinned sources' + (process.argv.includes('--public') ? ' and rebuilt UI' : ''));
