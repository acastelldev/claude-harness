// Runs the project's check by hand (used by /harness:check). Exit code = the check's.
import { loadConfig, runVerify, projectDir, msg } from './lib/harness.mjs';

const dir = projectDir();
const { config, error } = loadConfig(dir);
if (error || !config || !config.verify) {
  console.log(error ? msg('es', 'badConfig', { error }) : msg(config?.lang ?? 'es', 'noConfig'));
  process.exit(2);
}

const seconds = config.verifyTimeout;
const r = await runVerify(config.verify, dir, seconds);
const en = config.lang === 'en';
if (r.timedOut) {
  console.log(msg(config.lang, 'verifyTimeout', { cmd: config.verify, seconds }));
  process.exit(124);
}
console.log(r.ok
  ? (en ? `Check "${config.verify}": OK` : `Verificación «${config.verify}»: OK`)
  : (en ? `Check "${config.verify}": FAILS (exit code ${r.code})` : `Verificación «${config.verify}»: FALLA (código ${r.code})`));
if (r.tail.trim()) console.log(r.tail.trim());
process.exit(r.ok ? 0 : (r.code || 1));
