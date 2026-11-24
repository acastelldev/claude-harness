---
name: check
description: Comprueba si el proyecto pasa su verificación (tests, build, lint) con el comando de .claude/harness.json y explica qué falla. Úsala cuando la persona pregunte si todo pasa, antes de dar algo por terminado o tras un cambio grande. / Runs the project's check from .claude/harness.json and explains what fails.
---

# Verificación del proyecto

1. Ejecuta la verificación del harness (no inventes otro comando):

   ```
   node "${CLAUDE_PLUGIN_ROOT}/scripts/verify.mjs"
   ```

   Ejecútalo desde la raíz del proyecto. El código de salida es el del comando de verificación: 0 = pasa.

2. Si la salida dice que el harness no está configurado, dilo y sugiere `/harness:init`. No hagas nada más.

3. Si pasa, dilo en una línea con el comando que se ejecutó.

4. Si falla, explica en 3-5 líneas:
   - qué falla (el test, el archivo y la línea si aparecen en la salida),
   - la causa más probable, según la salida,
   - qué cambiarías para arreglarlo.

   **No arregles nada** salvo que la persona te lo pida: esta skill solo comprueba.

Responde en el idioma de la persona.
