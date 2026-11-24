// /harness:init helper. Run from the project root.
//   node init.mjs detect                      -> JSON {stack, verify, format, evidence}
//   node init.mjs write --verify "<cmd>" [--format "<cmd>"] [--lang es|en] [--team]
// write creates/merges .claude/harness.json and .claude/settings.json without losing anything.
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const dir = process.cwd();
const has = (f) => existsSync(join(dir, f));
const read = (f) => readFileSync(join(dir, f), 'utf8');

export const DENY_READ = [
  'Read(./.env)', 'Read(./.env.local)', 'Read(./.env.*.local)', 'Read(./.env.production)',
  'Read(**/*.pem)', 'Read(**/*.key)',
];
const MARKETPLACE = { acastell: { source: { source: 'github', repo: 'acastelldev/claude-harness' } } };
const PLUGIN_ID = 'harness@acastell';

function detect() {
  const evidence = [];
  if (has('package.json')) {
    evidence.push('package.json');
    let pkg = {};
    try { pkg = JSON.parse(read('package.json')); } catch { /* unreadable package.json: no script */ }
    const script = pkg?.scripts?.test;
    const real = typeof script === 'string' && script.trim() && !/no test specified/.test(script);
    let runner = 'npm';
    if (has('pnpm-lock.yaml')) { runner = 'pnpm'; evidence.push('pnpm-lock.yaml'); }
    else if (has('yarn.lock')) { runner = 'yarn'; evidence.push('yarn.lock'); }
    const deps = { ...(pkg.dependencies ?? {}), ...(pkg.devDependencies ?? {}) };
    return {
      stack: 'node',
      verify: real ? `${runner} test` : null,
      format: deps.prettier ? 'npx prettier --write {file}' : null,
      evidence,
    };
  }
  const reqs = ['requirements.txt', 'requirements-dev.txt'].filter(has);
  if (has('pyproject.toml') || reqs.length) {
    if (has('pyproject.toml')) evidence.push('pyproject.toml');
    evidence.push(...reqs);
    const uv = has('uv.lock');
    if (uv) evidence.push('uv.lock');
    const py = has('pyproject.toml') ? read('pyproject.toml') : '';
    const pytest = /pytest/.test(py + reqs.map(read).join('\n'));
    const tool = pytest ? 'pytest' : 'python -m unittest';
    return {
      stack: 'python',
      verify: uv ? `uv run ${tool}` : (pytest ? 'python -m pytest' : tool),
      format: /ruff/.test(py) ? 'ruff format {file}' : null,
      evidence,
    };
  }
  if (has('Cargo.toml')) return { stack: 'rust', verify: 'cargo test', format: null, evidence: ['Cargo.toml'] };
  if (has('go.mod')) return { stack: 'go', verify: 'go test ./...', format: null, evidence: ['go.mod'] };
  return { stack: null, verify: null, format: null, evidence };
}

function parseArgs(argv) {
  const out = { team: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--team') out.team = true;
    else if (['--verify', '--format', '--lang'].includes(a)) out[a.slice(2)] = argv[++i];
    else throw new Error(`argumento desconocido: ${a}`);
  }
  return out;
}

function readJsonFile(rel) {
  if (!has(rel)) return {};
  const text = read(rel).replace(/^﻿/, '');
  const v = JSON.parse(text);
  if (!v || typeof v !== 'object' || Array.isArray(v)) throw new Error('no es un objeto JSON');
  return v;
}

const addAll = (list, items) => {
  const out = Array.isArray(list) ? [...list] : [];
  for (const it of items) if (!out.includes(it)) out.push(it);
  return out;
};

function write(args) {
  if (!args.verify) throw new Error('falta --verify "<comando>" (el comando que dice si el proyecto está bien)');
  let settings;
  let harness;
  try { settings = readJsonFile(join('.claude', 'settings.json')); } catch (e) {
    throw new Error(`.claude/settings.json no se puede leer (${e.message}); arréglalo a mano, no lo toco`);
  }
  try { harness = readJsonFile(join('.claude', 'harness.json')); } catch (e) {
    throw new Error(`.claude/harness.json no se puede leer (${e.message}); arréglalo o bórralo`);
  }

  const nextHarness = {
    verify: args.verify,
    protect: Array.isArray(harness.protect) ? harness.protect : [],
    format: args.format ?? harness.format ?? null,
    lang: args.lang ?? harness.lang ?? 'es',
    verifyTimeout: harness.verifyTimeout ?? 300,
  };

  const perms = settings.permissions && typeof settings.permissions === 'object' ? settings.permissions : {};
  const next = {
    ...settings,
    permissions: { ...perms, allow: addAll(perms.allow, [`Bash(${args.verify})`]), deny: addAll(perms.deny, DENY_READ) },
  };
  if (args.team) {
    next.extraKnownMarketplaces = { ...(settings.extraKnownMarketplaces ?? {}), ...MARKETPLACE };
    next.enabledPlugins = { ...(settings.enabledPlugins ?? {}), [PLUGIN_ID]: true };
  }

  mkdirSync(join(dir, '.claude'), { recursive: true });
  writeFileSync(join(dir, '.claude', 'harness.json'), `${JSON.stringify(nextHarness, null, 2)}\n`);
  writeFileSync(join(dir, '.claude', 'settings.json'), `${JSON.stringify(next, null, 2)}\n`);
  console.log('.claude/harness.json: verificación «%s», idioma %s', nextHarness.verify, nextHarness.lang);
  console.log('.claude/settings.json: allow Bash(%s); deny de leer .env y claves%s', args.verify,
    args.team ? '; catálogo acastell y plugin harness para el equipo' : '');
}

try {
  const [cmd, ...rest] = process.argv.slice(2);
  if (cmd === 'detect') console.log(JSON.stringify(detect()));
  else if (cmd === 'write') write(parseArgs(rest));
  else throw new Error('uso: node init.mjs detect | write --verify "<cmd>" [--format "<cmd>"] [--lang es|en] [--team]');
} catch (e) {
  console.error(`harness init: ${e.message}`);
  process.exit(1);
}
