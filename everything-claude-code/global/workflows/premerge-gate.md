# Workflow: premerge-gate

Purpose:
Final strict gate for merge readiness.

Sequence:
1. Scope diff check (files touched vs approved scope)
2. Business behavior check (unchanged unless requested)
3. i18n consistency check for changed user-facing text
4. UX sanity check (readability / truncation / labels)
5. Manual test checklist review
6. Rollback plan confirmation

Decision output:
- PASS or FAIL
- Remaining risks
- Required fixes before merge
- Exact rollback files
