# OpenSpec with Codex

Use the OpenSpec skills in `.agents/skills/` for spec-driven changes. Start with `$openspec-propose` to draft a change, then use `$openspec-apply-change` to implement it and `$openspec-archive-change` after implementation is complete.

Run OpenSpec from the repository root with `npm run --silent openspec -- <args>`. When an OpenSpec skill shows a command beginning with `openspec`, use that npm prefix to run the version pinned by this project. If dependencies are missing, run `npm ci --cache "${TMPDIR:-/tmp}/codex2-npm-cache"` first.

Canonical specifications live in `openspec/specs/`. Active changes live in `openspec/changes/` and completed changes go in `openspec/changes/archive/`.
