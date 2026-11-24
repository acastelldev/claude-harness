import { spawn, execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
export const PLUGIN = join(ROOT, 'plugins', 'harness');
export const script = (name) => join(PLUGIN, 'scripts', name);

// Runs a hook the way Claude Code does: a node process with the event JSON on stdin.
export function runHook(file, input, { cwd, env = {}, timeoutMs = 30000 } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [file], {
      cwd: cwd ?? process.cwd(),
      env: { ...process.env, ...env },
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    const timer = setTimeout(() => { child.kill(); reject(new Error(`hook timed out: ${file}`)); }, timeoutMs);
    child.stdout.on('data', (d) => { stdout += d; });
    child.stderr.on('data', (d) => { stderr += d; });
    child.on('close', (code) => {
      clearTimeout(timer);
      let json = null;
      try { json = stdout.trim() ? JSON.parse(stdout) : null; } catch { json = null; }
      resolve({ code, stdout, stderr, json });
    });
    child.stdin.end(typeof input === 'string' ? input : JSON.stringify(input));
  });
}

// A throwaway project folder. files: { 'relative/path': 'content' }. git: init + commit.
export function tempProject(files = {}, { git = false, name = 'proyecto' } = {}) {
  const dir = join(mkdtempSync(join(tmpdir(), 'harness-')), name);
  mkdirSync(dir, { recursive: true });
  for (const [rel, content] of Object.entries(files)) {
    const p = join(dir, rel);
    mkdirSync(dirname(p), { recursive: true });
    writeFileSync(p, typeof content === 'string' ? content : JSON.stringify(content, null, 2));
  }
  if (git) {
    const g = (...a) => execFileSync('git', a, { cwd: dir, stdio: 'ignore' });
    g('init', '-q');
    g('-c', 'user.name=test', '-c', 'user.email=test@example.invalid', 'add', '-A');
    g('-c', 'user.name=test', '-c', 'user.email=test@example.invalid', 'commit', '-q', '--allow-empty', '-m', 'init');
  }
  return dir;
}

// A shell command that runs node with inline code, quoted for the system shell.
export const nodeCmd = (code) => `"${process.execPath}" -e "${code.replace(/"/g, '\\"')}"`;
