import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runHook, script, tempProject, nodeCmd } from './helpers.mjs';

const START = script('session-start.mjs');
const VERIFY = script('verify.mjs');
const ev = { hook_event_name: 'SessionStart', source: 'startup' };
const env = (dir) => ({ CLAUDE_PROJECT_DIR: dir });

test('session-start with config: one line with the check command and rule count', async () => {
  const dir = tempProject({ '.claude/harness.json': { verify: 'npm test', protect: ['config/prod/**'] } });
  const r = await runHook(START, ev, { env: env(dir) });
  assert.equal(r.code, 0);
  const ctx = r.json.hookSpecificOutput.additionalContext;
  assert.equal(r.json.hookSpecificOutput.hookEventName, 'SessionStart');
  assert.match(ctx, /«npm test»/);
  assert.match(ctx, /16 reglas/);
  assert.equal(ctx.includes('\n'), false);
});

test('session-start without config: tells to run /harness:init', async () => {
  const dir = tempProject({});
  const r = await runHook(START, ev, { env: env(dir) });
  assert.match(r.json.hookSpecificOutput.additionalContext, /ejecuta \/harness:init/);
});

test('session-start with broken config: badConfig with the reason', async () => {
  const dir = tempProject({ '.claude/harness.json': '{ x' });
  const r = await runHook(START, ev, { env: env(dir) });
  assert.equal(r.code, 0);
  assert.match(r.json.hookSpecificOutput.additionalContext, /no puedo leer \.claude\/harness\.json \(harness\.json: /);
});

test('verify.mjs: passing project exits 0', async () => {
  const dir = tempProject({ '.claude/harness.json': { verify: nodeCmd("console.log('ok')") } });
  const r = await runHook(VERIFY, '', { env: env(dir) });
  assert.equal(r.code, 0);
  assert.match(r.stdout, /ok/);
});

test('verify.mjs: failing project exits non-zero and prints the tail', async () => {
  const dir = tempProject({ '.claude/harness.json': { verify: nodeCmd("console.log('falla precio');process.exit(3)") } });
  const r = await runHook(VERIFY, '', { env: env(dir) });
  assert.equal(r.code, 3);
  assert.match(r.stdout, /falla precio/);
});

test('verify.mjs: no config exits 2 with the init hint', async () => {
  const dir = tempProject({});
  const r = await runHook(VERIFY, '', { env: env(dir) });
  assert.equal(r.code, 2);
  assert.match(r.stdout, /\/harness:init/);
});
