// PostToolUse hook: run the project's formatter on the file Claude just edited.
// Optional (only with "format" in .claude/harness.json) and never blocks or fails.
import { loadConfig, protectedBy, runVerify, readStdinJson, projectDir } from './lib/harness.mjs';

const quote = (p) => (process.platform === 'win32' ? `"${p}"` : `'${p.replace(/'/g, "'\\''")}'`);

try {
  const input = await readStdinJson();
  const file = input?.tool_input?.file_path;
  const dir = projectDir();
  const { config } = loadConfig(dir);
  const applies = config?.formatFiles ? protectedBy(file, dir, config.formatFiles) !== null : true;
  if (typeof file === 'string' && file && config?.format && applies && !protectedBy(file, dir, config.protect)) {
    const cmd = config.format.includes('{file}') ? config.format.replaceAll('{file}', quote(file)) : `${config.format} ${quote(file)}`;
    await runVerify(cmd, dir, 60);
  }
} catch {
  // a formatter problem must never interrupt the work
}
process.exit(0);
