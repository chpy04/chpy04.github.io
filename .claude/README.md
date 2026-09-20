# `.claude/`

Checked-in configuration for agents working in this repo.

- **`rules/*.md`** — the conventions, one file per area. Each has a `paths`
  frontmatter glob and is loaded only when Claude touches a matching file, so
  none of it costs context on unrelated work. `CLAUDE.md` at the repo root
  carries the always-loaded half: what the app is, the five silent
  invariants, and the merge gate.
- **`skills/*/SKILL.md`** — one per phase of the **unattended** task
  lifecycle: `plan`, `implement`, `review-pr`. Each is invoked by hand
  (`/plan 42`) or by `scripts/herd.sh`, and they deliberately never invoke
  each other — a phase boundary is a human decision (D-011). Every one is
  `disable-model-invocation: true`, so none of this exists as far as an
  ordinary session is concerned, and `CLAUDE.md` does not mention them:
  a session with a human in it takes its approval in conversation.
  Unlike `rules/`, a skill is a _procedure_ rather than a convention: it
  costs no context until someone asks for it.
- **`settings.json`** — permission allowlist for the project's own read-only
  and verification commands, so the gate can be run without a prompt per
  step.

The mechanical half of these rules is enforced by `eslint.config.mjs`, whose
error messages name the rule file that explains them (D-014). Prose and lint
config are meant to agree — if you change one, change the other.

## Adapting this to your project

The rules are written about _this_ codebase, which is a template. When the
demo resource goes, these need a pass:

| file             | what to change                                                                         |
| ---------------- | -------------------------------------------------------------------------------------- |
| `data-access.md` | the ownership section names `item` / `item_note` as the example                        |
| `api-routes.md`  | the sample handler is the items one                                                    |
| `components.md`  | the "keep logic out of components" section names `lib/` modules that may not exist yet |
| `testing.md`     | the expected test count                                                                |
| `styling.md`     | nothing — the palette is generic                                                       |
| `imports.md`     | nothing — it is about runtimes, not this app                                           |
| `auth.md`        | nothing, until you implement `lib/auth-supabase.ts`                                    |
| `github.md`      | nothing — it reads the repo from the git remote                                        |

A rule that describes code which no longer exists is worse than no rule:
agents follow it.
