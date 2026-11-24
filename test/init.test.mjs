import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { runHook, PLUGIN, tempProject } from './helpers.mjs';

const INIT = join(PLUGIN, 'skills', 'init', 'init.mjs');
const run = (dir, ...args) => runHook(INIT, '', { cwd: dir, args });
const detect = async (dir) => JSON.parse((await run(dir, 'detect')).stdout);
const readJson = (dir, rel) => JSON.parse(readFileSync(join(dir, rel), 'utf8'));

test('detect: node with npm, test script and prettier', async () => {
  const dir = tempProject({ 'package.json': { scripts: { test: 'node --test' }, devDependencies: { prettier: '^3' } } });
  const d = await detect(dir);
  assert.equal(d.stack, 'node');
  assert.equal(d.verify, 'npm test');
  assert.equal(d.format, 'npx prettier --write {file}');
  assert.ok(d.evidence.includes('package.json'));
});

test('detect: pnpm and yarn lockfiles pick their runner', async () => {
  const pnpm = tempProject({ 'package.json': { scripts: { test: 'vitest' } }, 'pnpm-lock.yaml': '' });
  assert.equal((await detect(pnpm)).verify, 'pnpm test');
  const yarn = tempProject({ 'package.json': { scripts: { test: 'jest' } }, 'yarn.lock': '' });
  assert.equal((await detect(yarn)).verify, 'yarn test');
});

test('detect: npm default "no test specified" script counts as no check', async () => {
  const dir = tempProject({ 'package.json': { scripts: { test: 'echo "Error: no test specified" && exit 1' } } });
  const d = await detect(dir);
  assert.equal(d.stack, 'node');
  assert.equal(d.verify, null);
});

test('detect: python with pyproject, uv and ruff', async () => {
  const plain = tempProject({ 'requirements.txt': 'pytest\n' });
  assert.deepEqual([(await detect(plain)).stack, (await detect(plain)).verify], ['python', 'python -m pytest']);
  const uv = tempProject({
    'pyproject.toml': '[dependency-groups]\ndev = ["pytest"]\n[tool.ruff]\nline-length = 100\n', 'uv.lock': '',
  });
  const d = await detect(uv);
  assert.equal(d.verify, 'uv run pytest');
  assert.equal(d.format, 'ruff format {file}');
});

test('detect: python without pytest uses the standard library unittest', async () => {
  const dir = tempProject({ 'pyproject.toml': '[project]\nname = "notas"\n' });
  assert.equal((await detect(dir)).verify, 'python -m unittest');
  const uv = tempProject({ 'pyproject.toml': '[project]\nname = "notas"\n', 'uv.lock': '' });
  assert.equal((await detect(uv)).verify, 'uv run python -m unittest');
});

test('detect: rust and go', async () => {
  assert.equal((await detect(tempProject({ 'Cargo.toml': '[package]\n' }))).verify, 'cargo test');
  assert.equal((await detect(tempProject({ 'go.mod': 'module x\n' }))).verify, 'go test ./...');
});

test('detect: empty project', async () => {
  const d = await detect(tempProject({}));
  assert.equal(d.stack, null);
  assert.equal(d.verify, null);
});

test('write: creates harness.json and settings.json from nothing', async () => {
  const dir = tempProject({});
  const r = await run(dir, 'write', '--verify', 'npm test');
  assert.equal(r.code, 0, r.stdout + r.stderr);
  const h = readJson(dir, '.claude/harness.json');
  assert.equal(h.verify, 'npm test');
  assert.equal(h.lang, 'es');
  const s = readJson(dir, '.claude/settings.json');
  assert.ok(s.permissions.allow.includes('Bash(npm test)'));
  assert.ok(s.permissions.deny.includes('Read(./.env)'));
});

test('write: keeps existing permissions and hooks in settings.json', async () => {
  const dir = tempProject({
    '.claude/settings.json': {
      permissions: { allow: ['Bash(git status)'], deny: ['Read(./secrets/**)'] },
      hooks: { PostToolUse: [{ matcher: 'Write', hooks: [{ type: 'command', command: 'echo hi' }] }] },
      model: 'opus',
    },
  });
  await run(dir, 'write', '--verify', 'npm test');
  const s = readJson(dir, '.claude/settings.json');
  assert.ok(s.permissions.allow.includes('Bash(git status)'));
  assert.ok(s.permissions.allow.includes('Bash(npm test)'));
  assert.ok(s.permissions.deny.includes('Read(./secrets/**)'));
  assert.equal(s.hooks.PostToolUse[0].hooks[0].command, 'echo hi');
  assert.equal(s.model, 'opus');
});

test('write twice: identical files, no duplicate rules', async () => {
  const dir = tempProject({});
  await run(dir, 'write', '--verify', 'npm test', '--team');
  const a = readFileSync(join(dir, '.claude/settings.json'), 'utf8');
  const ha = readFileSync(join(dir, '.claude/harness.json'), 'utf8');
  await run(dir, 'write', '--verify', 'npm test', '--team');
  assert.equal(readFileSync(join(dir, '.claude/settings.json'), 'utf8'), a);
  assert.equal(readFileSync(join(dir, '.claude/harness.json'), 'utf8'), ha);
});

test('write --team: adds the marketplace and enables the plugin', async () => {
  const dir = tempProject({});
  await run(dir, 'write', '--verify', 'npm test', '--team');
  const s = readJson(dir, '.claude/settings.json');
  assert.deepEqual(s.extraKnownMarketplaces.acastell.source, { source: 'github', repo: 'acastelldev/claude-harness' });
  assert.equal(s.enabledPlugins['harness@acastell'], true);
});

test('write: keeps extra protect patterns already in harness.json', async () => {
  const dir = tempProject({ '.claude/harness.json': { verify: 'old', protect: ['config/prod/**'], lang: 'en' } });
  await run(dir, 'write', '--verify', 'npm test');
  const h = readJson(dir, '.claude/harness.json');
  assert.deepEqual(h.protect, ['config/prod/**']);
  assert.equal(h.verify, 'npm test');
  assert.equal(h.lang, 'en');
});

test('write: broken settings.json is left untouched and nothing is written', async () => {
  const dir = tempProject({ '.claude/settings.json': '{ roto' });
  const r = await run(dir, 'write', '--verify', 'npm test');
  assert.notEqual(r.code, 0);
  assert.match(r.stdout + r.stderr, /settings\.json/);
  assert.equal(readFileSync(join(dir, '.claude/settings.json'), 'utf8'), '{ roto');
  assert.equal(existsSync(join(dir, '.claude/harness.json')), false);
});

test('write without --verify fails with a clear message', async () => {
  const dir = tempProject({});
  const r = await run(dir, 'write');
  assert.notEqual(r.code, 0);
  assert.match(r.stdout + r.stderr, /--verify/);
});
