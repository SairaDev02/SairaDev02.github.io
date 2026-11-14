# AGENTS.md

## Testing

This project is exempt from TDD. Its only automated tests are the Playwright end-to-end tests in `e2e/` (`npm run e2e`); the owner removed the unit tests on purpose. Verify behavior changes by adding or updating an e2e test where one fits, or by checking the rendered site. Keep new tests in `e2e/`.

## Agent skills

### Issue tracker

Issues are tracked in GitHub Issues for SairaDev02/SairaDev02.github.io, via the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

The five default triage labels: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: one `GLOSSARY.md` and `docs/adr/` at the repo root. See `docs/agents/domain.md`.
