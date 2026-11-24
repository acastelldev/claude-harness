import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { runHook, script, tempProject, nodeCmd } from './helpers.mjs';

const HOOK = script('format-edited.mjs');
const ev = (file) => ({ hook_event_name: 'PostToolUse', tool_name: 'Edit', tool_input: { file_path: file } });
const env = (dir) => ({ CLAUDE_PROJECT_DIR: dir });
// A "formatter" that records the argument it got in witness.txt.
const RECORD = `${nodeCmd("require('fs').writeFileSync('witness.txt', process.argv[1])")} {file}`;

test('no format configured: does nothing', async () => {
  const dir = tempProject({ '.claude/harness.json': { verify: 'x' } });
  const r = await runHook(HOOK, ev(join(dir, 'a.js')), { env: env(dir) });
  assert.equal(r.code, 0);
  assert.equal(existsSync(join(dir, 'witness.txt')), false);
});

test('format configured: runs it with the edited file, also with spaces in the path', async () => {
  const dir = tempProject({ '.claude/harness.json': { format: RECORD } }, { name: 'con espacio' });
  const file = join(dir, 'src', 'mi archivo.js');
  const r = await runHook(HOOK, ev(file), { env: env(dir) });
  assert.equal(r.code, 0);
  assert.equal(readFileSync(join(dir, 'witness.txt'), 'utf8'), file);
});

test('failing formatter never fails the hook', async () => {
  const dir = tempProject({ '.claude/harness.json': { format: `${nodeCmd('process.exit(4)')} {file}` } });
  const r = await runHook(HOOK, ev(join(dir, 'a.js')), { env: env(dir) });
  assert.equal(r.code, 0);
});

test('protected file is never handed to the formatter', async () => {
  const dir = tempProject({ '.claude/harness.json': { format: RECORD } });
  await runHook(HOOK, ev(join(dir, '.env')), { env: env(dir) });
  assert.equal(existsSync(join(dir, 'witness.txt')), false);
});
