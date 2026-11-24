// Stop hook: if Claude edited files in this session, run the project's check before it finishes;
// if the check fails, block with the output so Claude keeps working. Respects stop_hook_active,
// so Claude gets one more turn to fix it and can never loop forever.
import {
  loadConfig, runVerify, readStdinJson, projectDir, msg, emit, hasChanged, clearChanged,
} from './lib/harness.mjs';

const MAX_TIMEOUT_S = 600; // hooks.json gives this hook 660 s; keep the check inside it

const input = await readStdinJson();
const session = input.session_id;
// Second stop in a row: let Claude stop. The mark stays, so the next turn checks again.
if (input.stop_hook_active === true) process.exit(0);
// Claude did not edit anything in this session (it only answered): nothing to check.
if (!hasChanged(session)) process.exit(0);

const dir = projectDir();
const { config, error } = loadConfig(dir);
if (error) {
  process.stderr.write(`${msg('es', 'badConfig', { error })}\n`);
  process.exit(0);
}
if (!config || !config.verify) process.exit(0);

const seconds = Math.min(config.verifyTimeout, MAX_TIMEOUT_S);
const result = await runVerify(config.verify, dir, seconds);
if (result.ok) {
  clearChanged(session);
} else {
  const reason = result.timedOut
    ? msg(config.lang, 'verifyTimeout', { cmd: config.verify, seconds })
    : msg(config.lang, 'verifyFailed', { cmd: config.verify, code: result.code, tail: result.tail.trim() });
  emit({ decision: 'block', reason });
}
process.exit(0);
