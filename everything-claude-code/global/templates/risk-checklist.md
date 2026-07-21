# Risk Checklist (Pre-Change)

## Scope Safety
- [ ] Change is limited to requested files/modules.
- [ ] No unrelated refactor.
- [ ] No API contract change unless explicitly requested.

## Logic Safety
- [ ] Existing business rules preserved.
- [ ] Entry points identified (controllers/services/jobs/imports).
- [ ] Bypass paths checked (cron/import/manual endpoints).

## Data Safety
- [ ] No schema/model/storage mutation unless required.
- [ ] No side effects on other calculation models.

## UX/I18N Safety
- [ ] User-facing text is translatable using existing system.
- [ ] No mixed language in same screen.
- [ ] No truncation/overflow regressions.

## Validation
- [ ] Manual test checklist prepared.
- [ ] Pre-merge sanity checks executed.
