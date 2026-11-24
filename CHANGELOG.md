# Cambios

## 0.1.0 — 2026

Primera versión.

- Hook PreToolUse que protege `.env`, claves, lockfiles y `.git` (y lo que liste `.claude/harness.json`).
- Hook Stop que ejecuta la verificación del proyecto antes de terminar si Claude editó archivos en la sesión
  (lo apunta un PostToolUse), con salvaguarda contra bucles.
- Hook SessionStart que dice cómo se verifica el proyecto o pide `/harness:init`.
- Hook PostToolUse opcional que formatea el archivo editado.
- Skills `/harness:init` y `/harness:check`; subagente `revisor`.
- Ejemplos `tienda-node` y `notas-python`.
