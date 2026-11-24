---
name: init
description: Prepara el proyecto actual para el harness. Detecta el lenguaje y el comando de verificación, escribe .claude/harness.json, añade permisos a .claude/settings.json y una sección «Harness» al CLAUDE.md. Úsala una vez por proyecto, cuando la persona pida instalar o configurar el harness. / Sets up the current project for the harness.
disable-model-invocation: true
---

# Preparar el proyecto para el harness

Trabaja desde la raíz del proyecto. Sigue los pasos en orden y no te saltes la confirmación.

1. **Node.** Ejecuta `node --version`. Si falla o es menor que 20, explica que el harness necesita Node.js 20 o superior
   (https://nodejs.org) y para aquí.

2. **Detectar.** Ejecuta:

   ```
   node "${CLAUDE_SKILL_DIR}/init.mjs" detect
   ```

   Devuelve JSON con `stack` (node, python, rust, go o null), `verify` (el comando que dice si el proyecto está bien),
   `format` (formateador por archivo, o null) y `evidence` (los archivos en los que se basa).

3. **Si `verify` es null**, pregunta a la persona qué comando comprueba que el proyecto funciona (tests, build o lint).
   No lo inventes.

4. **Enseña lo que vas a escribir** y pide confirmación antes de tocar nada:
   - `.claude/harness.json` con el comando de verificación (y el formateador si lo hay);
   - en `.claude/settings.json`: permitir ese comando sin preguntar y prohibir leer `.env` y claves;
   - una sección `## Harness` en `CLAUDE.md`.
   Pregunta también si quiere que el resto del equipo tenga el plugin al clonar el repo (opción `--team`) y en qué idioma
   quiere los mensajes de los hooks (español por defecto; `--lang en` para inglés).

5. **Escribir.** Con su sí:

   ```
   node "${CLAUDE_SKILL_DIR}/init.mjs" write --verify "<comando>" [--format "<comando con {file}>"] [--lang es|en] [--team]
   ```

   Si sale con error, explica el error y para: no edites esos archivos a mano.

6. **CLAUDE.md.** Si no existe, créalo; si existe, **añade al final** la sección (no cambies nada más). Si ya tiene una
   sección `## Harness`, sustitúyela. Contenido corto, con lo que detectaste:

   ```markdown
   ## Harness
   - Verificación: `<comando>`. Una tarea no está terminada hasta que pasa (el hook Stop lo comprueba).
   - Comandos del proyecto: <instalar, ejecutar, tests: los que veas en package.json / pyproject / Makefile>.
   - Convenciones: <2-4 que veas en el código: estilo, carpetas, nombres>.
   - Archivos protegidos: .env, claves, lockfiles y .git (y los de `.claude/harness.json` → `protect`). No se editan.
   ```

7. **Comprueba** con `node "${CLAUDE_PLUGIN_ROOT}/scripts/verify.mjs"` y di si el proyecto pasa ahora mismo.

8. **Cierra** diciendo qué archivos hay que versionar (`.claude/harness.json`, `.claude/settings.json`, `CLAUDE.md`)
   y que los cambios de permisos valen en la próxima sesión.

Responde en el idioma de la persona.
