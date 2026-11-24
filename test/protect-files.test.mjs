import { test } from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { runHook, script, tempProject } from './helpers.mjs';

const HOOK = script('protect-files.mjs');
const ev = (tool, input) => ({ hook_event_name: 'PreToolUse', tool_name: tool, tool_input: input });
const env = (dir) => ({ CLAUDE_PROJECT_DIR: dir });

test('Edit of .env is denied with a reason naming the file and rule', async () => {
  const dir = tempProject({ '.claude/harness.json': { verify: 'npm test' } });
  const r = await runHook(HOOK, ev('Edit', { file_path: join(dir, '.env') }), { env: env(dir) });
  assert.equal(r.code, 0);
  const out = r.json.hookSpecificOutput;
  assert.equal(out.hookEventName, 'PreToolUse');
  assert.equal(out.permissionDecision, 'deny');
  assert.match(out.permissionDecisionReason, /\.env/);
  assert.match(out.permissionDecisionReason, /«\.env»/);
});

test('Write of an ordinary file is allowed silently', async () => {
  const dir = tempProject({ '.claude/harness.json': {} });
  const r = await runHook(HOOK, ev('Write', { file_path: join(dir, 'src', 'app.js') }), { env: env(dir) });
  assert.equal(r.code, 0);
  assert.equal(r.json, null);
});

test('NotebookEdit uses notebook_path', async () => {
  const dir = tempProject({});
  const r = await runHook(HOOK, ev('NotebookEdit', { notebook_path: join(dir, 'keys', 'server.pem') }), { env: env(dir) });
  assert.equal(r.json.hookSpecificOutput.permissionDecision, 'deny');
});

test('extra pattern from harness.json blocks config/prod/db.json', async () => {
  const dir = tempProject({ '.claude/harness.json': { protect: ['config/prod/**'] } });
  const r = await runHook(HOOK, ev('Edit', { file_path: join(dir, 'config', 'prod', 'db.json') }), { env: env(dir) });
  assert.equal(r.json.hookSpecificOutput.permissionDecision, 'deny');
  assert.match(r.json.hookSpecificOutput.permissionDecisionReason, /config\/prod\/\*\*/);
});

test('defaults apply even without harness.json (plugin installed, init not run)', async () => {
  const dir = tempProject({});
  const r = await runHook(HOOK, ev('Write', { file_path: join(dir, '.env') }), { env: env(dir) });
  assert.equal(r.json.hookSpecificOutput.permissionDecision, 'deny');
});

test('broken harness.json keeps the default protection and warns on stderr', async () => {
  const dir = tempProject({ '.claude/harness.json': '{ nope' });
  const r = await runHook(HOOK, ev('Edit', { file_path: join(dir, '.env') }), { env: env(dir) });
  assert.equal(r.code, 0);
  assert.equal(r.json.hookSpecificOutput.permissionDecision, 'deny');
  assert.match(r.stderr, /harness\.json/);
  const ok = await runHook(HOOK, ev('Edit', { file_path: join(dir, 'src', 'a.js') }), { env: env(dir) });
  assert.equal(ok.json, null);
});

test('empty or non-JSON stdin never breaks the work', async () => {
  const dir = tempProject({});
  for (const input of ['', 'not json', '[]']) {
    const r = await runHook(HOOK, input, { env: env(dir) });
    assert.equal(r.code, 0);
    assert.equal(r.json, null);
  }
});

test('lang en gives an English reason', async () => {
  const dir = tempProject({ '.claude/harness.json': { lang: 'en' } });
  const r = await runHook(HOOK, ev('Edit', { file_path: join(dir, '.env') }), { env: env(dir) });
  assert.match(r.json.hookSpecificOutput.permissionDecisionReason, /is protected/);
});

test('relative file_path resolves against the project, not the hook cwd', async () => {
  const dir = tempProject({});
  const r = await runHook(HOOK, ev('Edit', { file_path: 'config/.env.local' }), { env: env(dir) });
  assert.equal(r.json.hookSpecificOutput.permissionDecision, 'deny');
});
