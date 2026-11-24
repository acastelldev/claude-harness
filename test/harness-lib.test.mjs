import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tempProject, nodeCmd } from './helpers.mjs';
import {
  loadConfig, protectedBy, runVerify, msg, DEFAULT_PROTECT,
} from '../plugins/harness/scripts/lib/harness.mjs';

const P = 'C:\\demo\\app';
const isWin = process.platform === 'win32';

test('protectedBy: .env with Windows backslashes', () => {
  assert.equal(protectedBy('C:\\demo\\app\\.env', P, DEFAULT_PROTECT), '.env');
});

test('protectedBy: .env.local with forward slashes and lower-case drive', () => {
  assert.equal(protectedBy('c:/demo/app/config/.env.local', P, DEFAULT_PROTECT), '.env.*');
});

test('protectedBy: .env.example and .env.sample stay editable', () => {
  assert.equal(protectedBy('C:\\demo\\app\\.env.example', P, DEFAULT_PROTECT), null);
  assert.equal(protectedBy('.env.sample', P, DEFAULT_PROTECT), null);
});

test('protectedBy: relative path with .. to a .pem', () => {
  assert.equal(protectedBy('..\\app\\server.pem', P, DEFAULT_PROTECT), '*.pem');
});

test('protectedBy: .git inside a folder with a space', () => {
  const p = 'C:\\demo\\con espacio';
  assert.equal(protectedBy('C:\\demo\\con espacio\\.git\\config', p, DEFAULT_PROTECT), '.git/**');
});

test('protectedBy: ordinary source file is not protected', () => {
  assert.equal(protectedBy('src/env.js', P, DEFAULT_PROTECT), null);
  assert.equal(protectedBy('C:\\demo\\app\\src\\app.js', P, DEFAULT_PROTECT), null);
});

test('protectedBy: key outside the project is still blocked by name', () => {
  assert.equal(protectedBy('/home/ana/.ssh/id_rsa', '/srv/app', DEFAULT_PROTECT), 'id_rsa*');
});

test('protectedBy: path pattern relative to the project', () => {
  const pats = [...DEFAULT_PROTECT, 'config/prod/**'];
  assert.equal(protectedBy('C:\\demo\\app\\config\\prod\\db.json', P, pats), 'config/prod/**');
  assert.equal(protectedBy('C:\\demo\\app\\config\\dev\\db.json', P, pats), null);
});

test('protectedBy: case-insensitive where the file system is (Windows and macOS)', () => {
  const r = protectedBy('/srv/app/.ENV', '/srv/app', DEFAULT_PROTECT);
  assert.equal(r, isWin || process.platform === 'darwin' ? '.env' : null);
});

test('loadConfig: no file -> null config, no error', () => {
  const dir = tempProject({});
  assert.deepEqual(loadConfig(dir), { config: null, error: null });
});

test('loadConfig: broken JSON -> error naming harness.json', () => {
  const dir = tempProject({ '.claude/harness.json': '{ "verify": ' });
  const { config, error } = loadConfig(dir);
  assert.equal(config, null);
  assert.match(error, /^harness\.json: /);
});

test('loadConfig: valid file adds its patterns to the defaults', () => {
  const dir = tempProject({ '.claude/harness.json': { verify: 'npm test', protect: ['config/prod/**'] } });
  const { config, error } = loadConfig(dir);
  assert.equal(error, null);
  assert.equal(config.verify, 'npm test');
  assert.equal(config.lang, 'es');
  assert.equal(config.verifyTimeout, 300);
  assert.equal(config.format, null);
  assert.ok(config.protect.includes('.env'));
  assert.ok(config.protect.includes('config/prod/**'));
});

test('runVerify: passing command', async () => {
  const r = await runVerify(nodeCmd('process.exit(0)'), process.cwd(), 30);
  assert.equal(r.ok, true);
  assert.equal(r.code, 0);
  assert.equal(r.timedOut, false);
});

test('runVerify: failing command keeps the last 4000 characters', async () => {
  const r = await runVerify(nodeCmd("console.log('x'.repeat(10000));process.exit(1)"), process.cwd(), 30);
  assert.equal(r.ok, false);
  assert.equal(r.code, 1);
  assert.equal(r.tail.length, 4000);
});

test('runVerify: hanging command times out quickly', async () => {
  const t0 = Date.now();
  const r = await runVerify(nodeCmd('setTimeout(()=>{},60000)'), process.cwd(), 1);
  assert.equal(r.timedOut, true);
  assert.equal(r.ok, false);
  assert.ok(Date.now() - t0 < 5000, 'took too long');
});

test('runVerify: a background grandchild holding the pipes does not cause a false timeout', async () => {
  const code = "require('child_process').spawn(process.execPath,['-e','setTimeout(()=>{},8000)'],{stdio:'inherit',detached:true}).unref();console.log('tests ok')";
  const t0 = Date.now();
  const r = await runVerify(nodeCmd(code), process.cwd(), 6);
  assert.equal(r.timedOut, false);
  assert.equal(r.ok, true);
  assert.match(r.tail, /tests ok/);
  assert.ok(Date.now() - t0 < 4000, `took ${Date.now() - t0} ms`);
});

test('runVerify: non-UTF-8 output does not throw', async () => {
  const r = await runVerify(nodeCmd('process.stdout.write(Buffer.from([0xe9,0x6e,0xff]));process.exit(2)'), process.cwd(), 30);
  assert.equal(r.ok, false);
  assert.equal(typeof r.tail, 'string');
});

test('msg: Spanish and English', () => {
  assert.match(msg('es', 'blocked', { file: '.env', pattern: '.env' }), /\.env/);
  assert.notEqual(msg('es', 'noConfig'), msg('en', 'noConfig'));
  assert.match(msg('es', 'noConfig'), /\/harness:init/);
});
