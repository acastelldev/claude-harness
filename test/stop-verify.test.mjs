import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runHook, script, tempProject, nodeCmd } from './helpers.mjs';

const HOOK = script('stop-verify.mjs');
const TRACK = script('track-edits.mjs');
const WITNESS = nodeCmd("require('fs').writeFileSync('witness.txt','x')");
const FAIL = nodeCmd("console.log('1 test falla: precio con IVA');process.exit(1)");
const PASS = nodeCmd('process.exit(0)');

// Each test gets its own plugin data folder (where the per-session edit marks live).
function setup(cfg, files = {}, { git = false } = {}) {
  const dir = tempProject({ '.claude/harness.json': cfg, 'src/a.js': 'a', ...files }, { git });
  const data = mkdtempSync(join(tmpdir(), 'harness-data-'));
  const env = { CLAUDE_PROJECT_DIR: dir, CLAUDE_PLUGIN_DATA: data };
  const stop = (sid = 's1', active = false) =>
    runHook(HOOK, { hook_event_name: 'Stop', session_id: sid, stop_hook_active: active }, { env });
  const edit = (sid = 's1', file = join(dir, 'src', 'a.js')) =>
    runHook(TRACK, { hook_event_name: 'PostToolUse', session_id: sid, tool_name: 'Edit', tool_input: { file_path: file } }, { env });
  return { dir, data, stop, edit };
}

test('no edit in this session: allows stopping without running the check, even with a dirty tree', async () => {
  const { dir, stop } = setup({ verify: WITNESS }, {}, { git: true });
  writeFileSync(join(dir, 'src', 'a.js'), 'trabajo a medias de la persona');
  const r = await stop();
  assert.equal(r.code, 0);
  assert.equal(r.json, null);
  assert.equal(existsSync(join(dir, 'witness.txt')), false);
});

test('edited in this session + failing check: blocks with the output tail', async () => {
  const { stop, edit } = setup({ verify: FAIL });
  await edit();
  const r = await stop();
  assert.equal(r.code, 0);
  assert.equal(r.json.decision, 'block');
  assert.match(r.json.reason, /la verificación del proyecto falla/);
  assert.match(r.json.reason, /precio con IVA/);
});

test('edited and then committed (clean tree): still runs the check', async () => {
  const { stop, edit } = setup({ verify: FAIL }, {}, { git: true });
  await edit();
  const r = await stop();
  assert.equal(r.json?.decision, 'block');
});

test('passing check clears the mark: the next stop runs nothing', async () => {
  const { dir, stop, edit } = setup({ verify: PASS });
  await edit();
  assert.equal((await stop()).json, null);
  writeFileSync(join(dir, '.claude', 'harness.json'), JSON.stringify({ verify: WITNESS }));
  await stop();
  assert.equal(existsSync(join(dir, 'witness.txt')), false);
});

test('stop_hook_active true: allows stopping, keeps the mark for the next turn', async () => {
  const { dir, stop, edit } = setup({ verify: WITNESS });
  await edit();
  const r = await stop('s1', true);
  assert.equal(r.json, null);
  assert.equal(existsSync(join(dir, 'witness.txt')), false);
  await stop('s1', false);
  assert.equal(existsSync(join(dir, 'witness.txt')), true);
});

test('edits from another session do not trigger this one', async () => {
  const { dir, stop, edit } = setup({ verify: WITNESS });
  await edit('otra');
  await stop('s1');
  assert.equal(existsSync(join(dir, 'witness.txt')), false);
});

test('hanging check with verifyTimeout 1: blocks with the timeout message, quickly', async () => {
  const { stop, edit } = setup({ verify: nodeCmd('setTimeout(()=>{},60000)'), verifyTimeout: 1 });
  await edit();
  const t0 = Date.now();
  const r = await stop();
  assert.equal(r.json.decision, 'block');
  assert.match(r.json.reason, /no terminó en 1 s/);
  assert.ok(Date.now() - t0 < 10000);
});

test('no harness.json or no verify command: allows stopping', async () => {
  const a = setup({ protect: [] });
  await a.edit();
  assert.equal((await a.stop()).json, null);
  const dir = tempProject({});
  const data = mkdtempSync(join(tmpdir(), 'harness-data-'));
  const r = await runHook(HOOK, { session_id: 's1' }, { env: { CLAUDE_PROJECT_DIR: dir, CLAUDE_PLUGIN_DATA: data } });
  assert.equal(r.code, 0);
  assert.equal(r.json, null);
  rmSync(data, { recursive: true, force: true });
});

test('broken harness.json: allows stopping and warns', async () => {
  const { stop, edit } = setup('{ x');
  await edit();
  const r = await stop();
  assert.equal(r.json, null);
  assert.match(r.stderr, /harness\.json/);
});

test('lang en: English reason', async () => {
  const { stop, edit } = setup({ verify: FAIL, lang: 'en' });
  await edit();
  const r = await stop();
  assert.match(r.json.reason, /project check fails/);
});

test('track-edits ignores events without a file and never fails', async () => {
  const { data } = setup({ verify: PASS });
  for (const input of ['', 'no json', { session_id: 's1', tool_input: {} }]) {
    const r = await runHook(TRACK, input, { env: { CLAUDE_PLUGIN_DATA: data } });
    assert.equal(r.code, 0);
  }
});
