// Stop hook: before Claude finishes, run the project's check; if it fails, block with the
// output so Claude keeps working. Respects stop_hook_active so it can never loop forever.
import { spawnSync } from 'node:child_process';
import { loadConfig, runVerify, readStdinJson, projectDir, msg, emit } from './lib/harness.mjs';

const MAX_TIMEOUT_S = 600; // hooks.json gives this hook 660 s; keep the check inside it

const input = await readStdinJson();
if (input.stop_hook_active === true) process.exit(0);

const dir = projectDir();
const { config, error } = loadConfig(dir);
if (error) {
  process.stderr.write(`${msg('es', 'badConfig', { error })}\n`);
  process.exit(0);
}
if (!config || !config.verify) process.exit(0);

// Nothing changed in a git repo (Claude only answered a question): no need to run the check.
const git = spawnSync('git', ['status', '--porcelain'], { cwd: dir, encoding: 'utf8', windowsHide: true });
if (git.status === 0 && git.stdout.trim() === '') process.exit(0);

const seconds = Math.min(config.verifyTimeout, MAX_TIMEOUT_S);
const result = await runVerify(config.verify, dir, seconds);
if (!result.ok) {
  const reason = result.timedOut
    ? msg(config.lang, 'verifyTimeout', { cmd: config.verify, seconds })
    : msg(config.lang, 'verifyFailed', { cmd: config.verify, code: result.code, tail: result.tail.trim() });
  emit({ decision: 'block', reason });
}
