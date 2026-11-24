// SessionStart hook: one line of context saying how this project is checked and protected.
import { loadConfig, projectDir, msg, emit } from './lib/harness.mjs';

const { config, error } = loadConfig(projectDir());
let text;
if (error) text = msg('es', 'badConfig', { error });
else if (!config) text = msg('es', 'noConfig');
else if (config.verify) text = msg(config.lang, 'sessionInfo', { verify: config.verify, count: config.protect.length });
else text = msg(config.lang, 'sessionNoVerify', { count: config.protect.length });

emit({ hookSpecificOutput: { hookEventName: 'SessionStart', additionalContext: text.replace(/\s*\n\s*/g, ' ') } });
