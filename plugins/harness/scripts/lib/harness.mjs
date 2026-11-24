// Shared code for the harness hooks. Node >= 20, no dependencies.
import { readFileSync, writeFileSync, mkdirSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, win32, posix } from 'node:path';
import { spawn } from 'node:child_process';

export const DEFAULT_PROTECT = [
  '.env', '.env.*', '!.env.example', '!.env.sample',
  '*.pem', '*.key', 'id_rsa*', 'id_ed25519*',
  '.git/**',
  'package-lock.json', 'pnpm-lock.yaml', 'yarn.lock', 'poetry.lock', 'uv.lock', 'Cargo.lock',
];

export const CONFIG_FILE = join('.claude', 'harness.json');
const TAIL = 4000;

const MESSAGES = {
  es: {
    blocked: 'Harness: «{file}» está protegido (regla «{pattern}»). No lo edites; si de verdad hay que cambiarlo, pídeselo a la persona.',
    verifyFailed: 'Harness: la verificación del proyecto falla («{cmd}», código {code}). Arréglalo antes de terminar. Últimas líneas:\n{tail}',
    verifyTimeout: 'Harness: la verificación («{cmd}») no terminó en {seconds} s. Revisa si algo se cuelga antes de terminar.',
    noConfig: 'Harness instalado pero sin configurar en este proyecto: ejecuta /harness:init.',
    badConfig: 'Harness: no puedo leer .claude/harness.json ({error}). Los hooks no bloquean nada hasta que se arregle.',
    sessionInfo: 'Harness activo. Verificación: «{verify}» (se ejecuta antes de terminar). Archivos protegidos: {count} reglas.',
    sessionNoVerify: 'Harness activo sin comando de verificación. Archivos protegidos: {count} reglas.',
  },
  en: {
    blocked: 'Harness: "{file}" is protected (rule "{pattern}"). Do not edit it; if it really must change, ask the person.',
    verifyFailed: 'Harness: the project check fails ("{cmd}", exit code {code}). Fix it before finishing. Last lines:\n{tail}',
    verifyTimeout: 'Harness: the check ("{cmd}") did not finish in {seconds} s. Look for something hanging before finishing.',
    noConfig: 'Harness is installed but not set up in this project: run /harness:init.',
    badConfig: 'Harness: cannot read .claude/harness.json ({error}). Hooks block nothing until it is fixed.',
    sessionInfo: 'Harness active. Check: "{verify}" (runs before finishing). Protected files: {count} rules.',
    sessionNoVerify: 'Harness active with no check command. Protected files: {count} rules.',
  },
};

export function msg(lang, key, vars = {}) {
  const table = MESSAGES[lang] ?? MESSAGES.es;
  return (table[key] ?? MESSAGES.es[key]).replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? ''));
}

// Per-session "Claude edited something" marks, so the Stop hook only checks work Claude did.
export function stateDir() {
  return process.env.CLAUDE_PLUGIN_DATA || join(tmpdir(), 'claude-harness');
}

function markPath(sessionId) {
  const safe = String(sessionId || 'default').replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 100);
  return join(stateDir(), `changed-${safe}`);
}

export function markChanged(sessionId) {
  mkdirSync(stateDir(), { recursive: true });
  writeFileSync(markPath(sessionId), new Date().toISOString());
}

export function hasChanged(sessionId) {
  return existsSync(markPath(sessionId));
}

export function clearChanged(sessionId) {
  rmSync(markPath(sessionId), { force: true });
}

export function projectDir() {
  return process.env.CLAUDE_PROJECT_DIR || process.cwd();
}

export function loadConfig(dir) {
  let text;
  try {
    text = readFileSync(join(dir, CONFIG_FILE), 'utf8');
  } catch (e) {
    if (e.code === 'ENOENT') return { config: null, error: null };
    return { config: null, error: `harness.json: ${e.message}` };
  }
  let raw;
  try {
    raw = JSON.parse(text.replace(/^﻿/, ''));
  } catch (e) {
    return { config: null, error: `harness.json: ${e.message}` };
  }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { config: null, error: 'harness.json: must be a JSON object' };
  }
  const str = (v) => (typeof v === 'string' && v.trim() ? v : null);
  const extra = Array.isArray(raw.protect) ? raw.protect.filter((p) => typeof p === 'string' && p) : [];
  const timeout = Number(raw.verifyTimeout);
  return {
    config: {
      verify: str(raw.verify),
      protect: [...DEFAULT_PROTECT, ...extra],
      format: str(raw.format),
      formatFiles: Array.isArray(raw.formatFiles) ? raw.formatFiles.filter((p) => typeof p === 'string' && p) : null,
      lang: raw.lang === 'en' ? 'en' : 'es',
      verifyTimeout: Number.isFinite(timeout) && timeout > 0 ? timeout : 300,
    },
    error: null,
  };
}

// Glob to RegExp: ** = any number of segments, * = within a segment, ? = one character.
function globToRegExp(glob, flags) {
  let re = '';
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i];
    if (c === '*') {
      if (glob[i + 1] === '*') {
        i++;
        if (glob[i + 1] === '/') { i++; re += '(?:.*/)?'; } else { re += '.*'; }
      } else {
        re += '[^/]*';
      }
    } else if (c === '?') {
      re += '[^/]';
    } else {
      re += c.replace(/[.+^${}()|[\]\\]/g, '\\$&');
    }
  }
  return new RegExp(`^${re}$`, flags);
}

function looksWindows(p) {
  return /^[a-zA-Z]:[\\/]/.test(p) || p.includes('\\');
}

// Returns the pattern that protects filePath, or null. Patterns without "/" match the file
// name; patterns with "/" match the path relative to the project. "!pattern" = exception.
export function protectedBy(filePath, dir, patterns) {
  if (typeof filePath !== 'string' || !filePath) return null;
  const win = process.platform === 'win32' || looksWindows(filePath) || looksWindows(dir);
  const P = win ? win32 : posix;
  const abs = P.isAbsolute(filePath) ? P.resolve(filePath) : P.resolve(dir, filePath);
  let rel = P.relative(P.resolve(dir), abs);
  const inside = rel && !rel.startsWith('..') && !P.isAbsolute(rel);
  rel = rel.split(P.sep).join('/');
  const name = abs.split(/[\\/]/).pop();
  // Windows and macOS (APFS by default) open .ENV as .env, so match without case there.
  const ci = process.platform === 'win32' || process.platform === 'darwin';
  const flags = ci ? 'i' : '';
  let hit = null;
  for (const raw of patterns) {
    const neg = raw.startsWith('!');
    const pat = neg ? raw.slice(1) : raw;
    const re = globToRegExp(pat, flags);
    let match;
    if (pat.includes('/')) {
      match = inside && re.test(rel);
    } else {
      match = re.test(name);
    }
    if (match) hit = neg ? null : raw;
  }
  return hit;
}

function decode(buf) {
  const text = new TextDecoder('utf-8', { fatal: false }).decode(buf);
  return text;
}

export function runVerify(cmd, cwd, timeoutS) {
  return new Promise((resolvePromise) => {
    const chunks = [];
    let size = 0;
    // detached on POSIX so a timeout can kill the whole process group (shell + its children).
    const child = spawn(cmd, {
      cwd, shell: true, windowsHide: true, detached: process.platform !== 'win32', stdio: ['ignore', 'pipe', 'pipe'],
    });
    const keep = (d) => {
      chunks.push(d);
      size += d.length;
      while (size > TAIL * 8 && chunks.length > 1) size -= chunks.shift().length;
    };
    child.stdout.on('data', keep);
    child.stderr.on('data', keep);
    let timedOut = false;
    let done = false;
    const timer = setTimeout(() => {
      timedOut = true;
      killTree(child);
      finish(null); // do not wait for pipes a grandchild may still hold open
    }, timeoutS * 1000);
    const finish = (code) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      // A background process started by the check (a server, a watcher) may still hold the pipes:
      // drop them so neither this promise nor the hook process waits for it.
      child.stdout.destroy();
      child.stderr.destroy();
      const text = decode(Buffer.concat(chunks)).replace(/\r\n/g, '\n');
      resolvePromise({ ok: !timedOut && code === 0, code: timedOut ? null : code, timedOut, tail: text.slice(-TAIL) });
    };
    child.on('error', () => finish(127));
    child.on('close', (code) => finish(code));
    // 'close' waits for every holder of the pipes; 'exit' is the command itself. Give the pipes a
    // moment to flush the last lines, then decide on the exit code.
    child.on('exit', (code) => setTimeout(() => finish(code), 250));
  });
}

function killTree(child) {
  if (process.platform === 'win32') {
    spawn('taskkill', ['/pid', String(child.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' });
  } else {
    try { process.kill(-child.pid, 'SIGKILL'); } catch { child.kill('SIGKILL'); }
  }
}

export async function readStdinJson() {
  const chunks = [];
  for await (const c of process.stdin) chunks.push(c);
  const text = Buffer.concat(chunks).toString('utf8').trim();
  if (!text) return {};
  try {
    const v = JSON.parse(text);
    return v && typeof v === 'object' ? v : {};
  } catch {
    return {};
  }
}

export function emit(obj) {
  process.stdout.write(JSON.stringify(obj));
}
