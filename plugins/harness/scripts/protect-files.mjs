// PreToolUse hook: deny edits to protected files (secrets, keys, lockfiles, .git).
// Never breaks the work: on any unexpected input it exits 0 without a decision.
import { loadConfig, protectedBy, readStdinJson, projectDir, msg, emit, DEFAULT_PROTECT } from './lib/harness.mjs';

const input = await readStdinJson();
const toolInput = input.tool_input && typeof input.tool_input === 'object' ? input.tool_input : {};
const file = toolInput.file_path ?? toolInput.notebook_path;

if (typeof file === 'string' && file) {
  const dir = projectDir();
  const { config, error } = loadConfig(dir);
  // A broken harness.json must not switch the default protection off: keep it and warn.
  if (error) process.stderr.write(`${msg('es', 'badConfig', { error })}\n`);
  const patterns = config ? config.protect : DEFAULT_PROTECT;
  const pattern = protectedBy(file, dir, patterns);
  if (pattern) {
    emit({
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        permissionDecision: 'deny',
        permissionDecisionReason: msg(config?.lang ?? 'es', 'blocked', { file, pattern }),
      },
    });
  }
}
