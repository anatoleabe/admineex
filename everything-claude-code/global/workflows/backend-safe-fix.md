# Workflow: backend-safe-fix

Purpose:
Run a safe backend change with strict scope control.

Sequence:
1. `/backend-review <scope>`
2. `/safe-patch <scope> <constraints>`
3. `/validate-premerge <scope>`

Gate rules:
- Stop if evidence is incomplete.
- Stop if patch exceeds approved files.
- Stop if side effects on adjacent business models are unclear.

Deliverable:
- Risk-aware minimal patch + verification checklist.
