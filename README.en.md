# harness for Claude Code

[Español](README.md)

A **harness** is everything around the model that makes it work well in your project: the context it reads and the
controls it cannot skip. This plugin brings the controls every project needs and sets each project up with one command:

- **Protects sensitive files.** Claude cannot edit `.env`, keys (`*.pem`, `*.key`, `id_rsa*`), lockfiles or `.git`,
  not even in `bypassPermissions` mode. You choose what else to protect.
- **Does not let it finish with a broken project.** Before Claude says "done", it runs your check (tests, build, lint).
  If it fails, Claude gets the error back and keeps going until it is fixed. No endless loops.
- **`/harness:init`** detects the language and writes a short `CLAUDE.md`, the permissions and the check command into
  your project.
- **`/harness:check`** runs the check whenever you want and explains what fails.
- **`revisor` subagent** reviews the diff in a separate context before a task is closed (read-only).
- **Format after edit** (optional): runs your formatter on every file Claude touches.

Works the same on Windows (no Git Bash needed), Linux and macOS: the hooks are dependency-free Node.js.

## Requirements

- Claude Code 2.1.327 or later (tested with that version on 2026-11-24).
- Node.js 20 or later.

## Install

Inside Claude Code:

```
/plugin marketplace add acastelldev/claude-harness
/plugin install harness@acastell
```

Then, in each project:

```
/harness:init
```

`init` shows what it will write and asks first. It creates or extends:

| File | What it holds |
|---|---|
| `.claude/harness.json` | the check command, extra protected files, formatter and message language |
| `.claude/settings.json` | permission to run your check without asking, and a ban on reading `.env` and keys |
| `CLAUDE.md` | a "Harness" section with the project's commands and conventions |

Commit all three. Project permissions apply once Claude Code trusts the folder (the trust dialog the first time you
open it). Set `"lang": "en"` (or answer English in `init`) for English hook messages.

### Why the permissions are not inside the plugin

A plugin can ship hooks, skills and subagents, but not permissions: those belong to each project. So the plugin holds
what is common (and updates in all your projects at once) and `/harness:init` writes what is specific to each one.

## Configuration: `.claude/harness.json`

```json
{
  "verify": "npm test",
  "protect": ["config/prod/**", "!package-lock.json"],
  "format": "npx prettier --write {file}",
  "lang": "en",
  "verifyTimeout": 300
}
```

- `verify`: the command that says whether the project is fine. It runs before finishing when there are uncommitted
  changes (or always, outside git). 600 s at most.
- `protect`: added to the default list. Without `/` they match the file name; with `/`, the path inside the project.
  A leading `!` is an exception (for example, to allow editing a lockfile).
- `format`: per-file formatter; `{file}` is the edited file.
- `lang`: `es` or `en`, the language of the hook messages.

Protected by default: `.env`, `.env.*` (except `.env.example` and `.env.sample`), `*.pem`, `*.key`, `id_rsa*`,
`id_ed25519*`, `.git/**`, `package-lock.json`, `pnpm-lock.yaml`, `yarn.lock`, `poetry.lock`, `uv.lock`, `Cargo.lock`.

## Share it with your team

`/harness:init` with the team option adds to `.claude/settings.json`:

```json
{
  "extraKnownMarketplaces": {
    "acastell": { "source": { "source": "github", "repo": "acastelldev/claude-harness" } }
  },
  "enabledPlugins": { "harness@acastell": true }
}
```

Anyone who clones the repo and trusts the folder gets the plugin without installing anything by hand.

## Updates

Auto-update is off for third-party marketplaces. To get the latest version:

```
/plugin marketplace update acastell
```

If you make your own version of the plugin, bump `version` in `plugin.json` on every change: without it, people who
already installed it get nothing.

## Common problems

- **"Nothing happens":** the project has no `.claude/harness.json`. Run `/harness:init`; the harness reminds you at the
  start of each session.
- **"It asks permission to run the tests":** you have not accepted the folder trust dialog yet.
- **"Claude never finishes":** it does not happen. After one block the hook lets it stop the next time
  (`stop_hook_active`), and Claude Code cuts off after 8 continuations in a row.
- **"node not found":** install Node.js 20 or later and open a new terminal.

## Development

```
npm test                                   # hook tests (Node 22)
claude plugin validate --strict .          # marketplace
claude plugin validate --strict plugins/harness
```

Tests run on Windows, Linux and macOS on every push. Every claim in this README is checked against the official
documentation in [docs/verificacion.md](docs/verificacion.md) (in Spanish).

`examples/` has two made-up projects (Node and Python) to try it on.

## More

- Guide: [A reliable harness for Claude Code: the playbook](https://acastell.dev/recursos/claude-code-harness-playbook)
- Video (Spanish): "Desarrolla un harness completo desde 0" (link when published).

MIT licence.
