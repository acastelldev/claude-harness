# Verificación con la documentación oficial

Cada afirmación del README y del vídeo, contrastada con code.claude.com. Claude Code cambia casi a diario: si algo deja
de ser cierto, se corrige aquí primero. Versión probada: Claude Code 2.1.327, Node 24 (Windows 11) — 24/11/2026.

| # | Afirmación | Estado | Fuente (consultada el 24/11/2026) |
|---|---|---|---|
| 1 | `marketplace.json` necesita `name`, `owner` y `plugins`; cada plugin, `name` y `source`; un `source` relativo se resuelve desde la raíz del catálogo | verificado | https://code.claude.com/docs/en/plugins/create-marketplace.md · https://code.claude.com/docs/en/plugins/marketplace-reference.md |
| 2 | Los nombres de plugin no pueden empezar por `claude-`, `anthropic-`, `anthropics-` ni `cc-plugin-` | verificado | https://code.claude.com/docs/en/plugins/marketplace-reference.md |
| 3 | En `plugin.json` solo `name` es obligatorio; `hooks/`, `skills/` y `agents/` se descubren solos en la raíz del plugin | verificado | https://code.claude.com/docs/en/plugins-reference.md |
| 4 | `hooks/hooks.json` va envuelto en `"hooks"`; la forma exec es `"command"` + `"args"` y `${CLAUDE_PLUGIN_ROOT}` se expande en `args` | verificado y probado en Windows (también con espacio en la ruta) | https://code.claude.com/docs/en/plugins-reference.md · https://code.claude.com/docs/en/hooks.md |
| 5 | En Windows una orden en texto usa Git Bash si existe y si no PowerShell; la forma exec no pasa por ninguna shell | verificado | https://code.claude.com/docs/en/hooks.md |
| 6 | `timeout` de un hook va en segundos (600 por defecto) | verificado | https://code.claude.com/docs/en/hooks.md |
| 7 | PreToolUse deniega con `hookSpecificOutput.permissionDecision: "deny"` y `permissionDecisionReason` | verificado | https://code.claude.com/docs/en/hooks.md |
| 8 | El deny de un hook se cumple también en modo `bypassPermissions` | pendiente de prueba real (Tarea 8) | — |
| 9 | Stop recibe `stop_hook_active` y bloquea con `{"decision":"block","reason":...}`; tope de 8 continuaciones seguidas (se reinicia con cada herramienta; `CLAUDE_CODE_STOP_HOOK_BLOCK_CAP`) | verificado | https://code.claude.com/docs/en/hooks.md |
| 10 | SessionStart añade contexto con `hookSpecificOutput.additionalContext` (máx. 10.000 caracteres); matchers `startup`, `resume`, `clear`, `compact`, `fork` | verificado | https://code.claude.com/docs/en/hooks.md |
| 11 | PostToolUse no bloquea por defecto | verificado | https://code.claude.com/docs/en/hooks.md |
| 12 | Los hooks reciben `CLAUDE_PROJECT_DIR`, `CLAUDE_PLUGIN_ROOT` y `CLAUDE_PLUGIN_DATA` | verificado | https://code.claude.com/docs/en/plugins-reference.md |
| 13 | En un SKILL.md de plugin se puede escribir `${CLAUDE_PLUGIN_ROOT}` y `${CLAUDE_SKILL_DIR}`; las skills se invocan como `/plugin:skill` | verificado | https://code.claude.com/docs/en/skills.md |
| 14 | Los subagentes de plugin ignoran `hooks`, `mcpServers` y `permissionMode`; se invocan con `@agent-plugin:nombre` | verificado | https://code.claude.com/docs/en/sub-agents.md |
| 15 | Un plugin no trae permisos: `plugin.json` no tiene campo de settings; un `CLAUDE.md` del plugin no se carga | verificado (lo segundo literal; lo primero por ausencia en la referencia) | https://code.claude.com/docs/en/plugins-reference.md |
| 16 | Reglas: `Bash(npm test)` exacta, `Bash(npm test *)` con comodín; `Read(./.env)` relativa al proyecto; orden deny → ask → allow | verificado | https://code.claude.com/docs/en/permissions.md |
| 17 | Compartir: `extraKnownMarketplaces` (`"source": {"source": "github", "repo": "..."}`) + `enabledPlugins` (`"plugin@catalogo": true`) en `.claude/settings.json`; los allow y el catálogo del proyecto solo valen tras aceptar la confianza de la carpeta | verificado | https://code.claude.com/docs/en/settings.md |
| 18 | `claude plugin validate --strict` trata los avisos como errores | verificado | https://code.claude.com/docs/en/plugins/cli-reference.md |
| 19 | Si no se sube `version`, los usuarios no reciben los cambios; la autoactualización está apagada en catálogos de terceros | verificado | https://code.claude.com/docs/en/plugins/install.md · https://code.claude.com/docs/en/plugins/host-marketplace.md |
