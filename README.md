# harness para Claude Code

[English](README.en.md)

Un **harness** es todo lo que rodea al modelo para que trabaje bien en tu proyecto: el contexto que lee y los controles
que no puede saltarse. Este plugin trae los controles comunes a todos tus proyectos y prepara cada uno con un comando:

- **Protege archivos sensibles.** Claude no puede editar `.env`, claves (`*.pem`, `*.key`, `id_rsa*`), lockfiles ni
  `.git`, ni siquiera en modo `bypassPermissions`. Tú decides qué más proteger.
- **No deja terminar con el proyecto roto.** Antes de que Claude diga «listo», ejecuta tu verificación (tests, build,
  lint). Si falla, le devuelve el error y Claude sigue hasta arreglarlo. Sin bucles infinitos.
- **`/harness:init`** detecta el lenguaje y escribe en tu proyecto un `CLAUDE.md` corto, los permisos y el comando de
  verificación.
- **`/harness:check`** ejecuta la verificación cuando quieras y explica qué falla.
- **Subagente `revisor`** revisa el diff en un contexto aparte antes de cerrar una tarea (solo lee).
- **Formato tras editar** (opcional): pasa tu formateador por cada archivo que Claude toca.

Funciona igual en Windows (sin Git Bash), Linux y macOS: los hooks son Node.js sin dependencias.

## Requisitos

- Claude Code 2.1.327 o posterior (probado con esa versión el 24/11/2026).
- Node.js 20 o posterior.

## Instalación

Dentro de Claude Code:

```
/plugin marketplace add acastelldev/claude-harness
/plugin install harness@acastell
```

Después, en cada proyecto:

```
/harness:init
```

`init` te enseña lo que va a escribir y pide confirmación. Crea o amplía:

| Archivo | Qué lleva |
|---|---|
| `.claude/harness.json` | el comando de verificación, archivos protegidos extra, formateador e idioma de los mensajes |
| `.claude/settings.json` | permiso para ejecutar tu verificación sin preguntar y prohibición de leer `.env` y claves |
| `CLAUDE.md` | una sección «Harness» con los comandos y las convenciones del proyecto |

Versiona los tres. Los permisos del proyecto valen cuando Claude Code confía en la carpeta (el diálogo de confianza la
primera vez que la abres).

### Por qué los permisos no van dentro del plugin

Un plugin puede traer hooks, skills y subagentes, pero no permisos: eso es de cada proyecto. Por eso el plugin trae lo
común (y se actualiza en todos tus proyectos a la vez) y `/harness:init` escribe lo propio de cada uno.

## Configuración: `.claude/harness.json`

```json
{
  "verify": "npm test",
  "protect": ["config/prod/**", "!package-lock.json"],
  "format": "npx prettier --write {file}",
  "lang": "es",
  "verifyTimeout": 300
}
```

- `verify`: el comando que dice si el proyecto está bien. Se ejecuta antes de terminar si hay cambios sin commitear (o
  siempre, fuera de git). Máximo 600 s.
- `protect`: se suman a los protegidos por defecto. Sin `/` comparan el nombre del archivo; con `/`, la ruta dentro del
  proyecto. `!` delante = excepción (por ejemplo, para dejar editar un lockfile).
- `format`: formateador por archivo; `{file}` es el archivo editado.
- `lang`: `es` o `en`, el idioma de los mensajes de los hooks.

Protegidos por defecto: `.env`, `.env.*` (salvo `.env.example` y `.env.sample`), `*.pem`, `*.key`, `id_rsa*`,
`id_ed25519*`, `.git/**`, `package-lock.json`, `pnpm-lock.yaml`, `yarn.lock`, `poetry.lock`, `uv.lock`, `Cargo.lock`.

## Compártelo con tu equipo

`/harness:init` con la opción de equipo añade a `.claude/settings.json`:

```json
{
  "extraKnownMarketplaces": {
    "acastell": { "source": { "source": "github", "repo": "acastelldev/claude-harness" } }
  },
  "enabledPlugins": { "harness@acastell": true }
}
```

Quien clone el repo y confíe en la carpeta tendrá el plugin sin instalar nada a mano.

## Actualizaciones

En catálogos de terceros la actualización automática viene apagada. Para traer la última versión:

```
/plugin marketplace update acastell
```

Si haces tu propia versión del plugin, sube `version` en `plugin.json` en cada cambio: sin eso, quien ya lo tiene
instalado no recibe nada.

## Errores típicos

- **«No pasa nada»:** el proyecto no tiene `.claude/harness.json`. Ejecuta `/harness:init`; al abrir una sesión, el
  harness te lo recuerda.
- **«Me pregunta permiso para los tests»:** aún no has aceptado la confianza de la carpeta.
- **«Claude no termina nunca»:** no pasa. Tras un bloqueo, el hook deja parar la siguiente vez (`stop_hook_active`) y
  Claude Code corta tras 8 continuaciones seguidas.
- **«Node no se encuentra»:** instala Node.js 20 o posterior y abre otra terminal.

## Desarrollo

```
npm test                                   # tests de los hooks (Node 22)
claude plugin validate --strict .          # catálogo
claude plugin validate --strict plugins/harness
```

Los tests se ejecutan en Windows, Linux y macOS en cada push. Cada afirmación de este README está contrastada con la
documentación oficial en [docs/verificacion.md](docs/verificacion.md).

`examples/` tiene dos proyectos inventados (Node y Python) para probarlo.

## Más

- Guía: [Un harness fiable para Claude Code: el playbook](https://acastell.dev/recursos/playbook-harness-claude-code)
- Vídeo: «Desarrolla un harness completo desde 0» (enlace al publicarse).

Licencia MIT.
