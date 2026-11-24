// PostToolUse hook: remember that Claude edited a file in this session, so the Stop hook
// checks the project only when Claude actually changed something. Never fails.
import { readStdinJson, markChanged } from './lib/harness.mjs';

try {
  const input = await readStdinJson();
  const t = input?.tool_input;
  const file = t && typeof t === 'object' ? (t.file_path ?? t.notebook_path) : null;
  if (typeof file === 'string' && file) markChanged(input.session_id);
} catch {
  // a bookkeeping problem must never interrupt the work
}
process.exit(0);
