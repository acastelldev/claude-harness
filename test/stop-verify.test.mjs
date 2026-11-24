import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { runHook, script, tempProject, nodeCmd } from './helpers.mjs';

const HOOK = script('stop-verify.mjs');
const stop = (active = false) => ({ hook_event_name: 'Stop', stop_hook_active: active });
const env = (dir) => ({ CLAUDE_PROJECT_DIR: dir });
const WITNESS = nodeCmd("require('fs').writeFileSync('witness.txt','x')");
const FAIL = nodeCmd("console.log('1 test falla: precio con IVA');process.exit(1)");
const PASS = nodeCmd('process.exit(0)');

function project(cfg, { git = true, dirty = true } = {}) {
  const dir = tempProject({ '.claude/harness.json': cfg, 'src/a.js': 'a' }, { git });
  if (dirty) writeFileSync(join(dir, 'src', 'a.js'), 'cambiado');
  return dir;
}

test('stop_hook_active true: allows stopping without running anything', async () => {
  const dir = project({ verify: WITNESS });
  const r = await runHook(HOOK, stop(true), { env: env(dir) });
  assert.equal(r.code, 0);
  assert.equal(r.json, null);
  assert.equal(existsSync(join(dir, 'witness.txt')), false);
});

test('no harness.json: allows stopping', async () => {
  const dir = tempProject({ 'src/a.js': 'a' });
  const r = await runHook(HOOK, stop(), { env: env(dir) });
  assert.equal(r.code, 0);
  assert.equal(r.json, null);
});

test('clean git tree: allows stopping without running the check', async () => {
  const dir = project({ verify: WITNESS }, { dirty: false });
  const r = await runHook(HOOK, stop(), { env: env(dir) });
  assert.equal(r.json, null);
  assert.equal(existsSync(join(dir, 'witness.txt')), false);
});

test('uncommitted change + failing check: blocks with the output tail', async () => {
  const dir = project({ verify: FAIL });
  const r = await runHook(HOOK, stop(), { env: env(dir) });
  assert.equal(r.code, 0);
  assert.equal(r.json.decision, 'block');
  assert.match(r.json.reason, /la verificación del proyecto falla/);
  assert.match(r.json.reason, /precio con IVA/);
});

test('uncommitted change + passing check: allows stopping', async () => {
  const dir = project({ verify: PASS });
  const r = await runHook(HOOK, stop(), { env: env(dir) });
  assert.equal(r.json, null);
});

test('hanging check with verifyTimeout 1: blocks with the timeout message, quickly', async () => {
  const dir = project({ verify: nodeCmd('setTimeout(()=>{},60000)'), verifyTimeout: 1 });
  const t0 = Date.now();
  const r = await runHook(HOOK, stop(), { env: env(dir) });
  assert.equal(r.json.decision, 'block');
  assert.match(r.json.reason, /no terminó en 1 s/);
  assert.ok(Date.now() - t0 < 10000);
});

test('folder without git + failing check: blocks', async () => {
  const dir = project({ verify: FAIL }, { git: false, dirty: false });
  const r = await runHook(HOOK, stop(), { env: env(dir) });
  assert.equal(r.json.decision, 'block');
});

test('no verify command configured: allows stopping', async () => {
  const dir = project({ protect: [] });
  const r = await runHook(HOOK, stop(), { env: env(dir) });
  assert.equal(r.json, null);
});

test('broken harness.json: allows stopping and warns', async () => {
  const dir = tempProject({ '.claude/harness.json': '{ x' });
  const r = await runHook(HOOK, stop(), { env: env(dir) });
  assert.equal(r.json, null);
  assert.match(r.stderr, /harness\.json/);
});

test('lang en: English reason', async () => {
  const dir = project({ verify: FAIL, lang: 'en' });
  const r = await runHook(HOOK, stop(), { env: env(dir) });
  assert.match(r.json.reason, /project check fails/);
});
