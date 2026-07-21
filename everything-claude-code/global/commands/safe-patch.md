# Command: /safe-patch <scope> <constraints>

Goal:
Implement the smallest safe patch only.

Hard rules:
- Respect <constraints> exactly.
- Modify only approved files.
- No broad refactor.
- Preserve business logic unless explicitly requested.
- Keep coding style already used in file.

Steps:
1. Reconfirm evidence and guard conditions from current code.
2. Apply minimal patch.
3. Re-check for collateral changes.
4. Produce exact diff summary.
5. Provide focused manual verification steps.

Output format:
Use global/templates/output-format.md
Include:
- Why each touched file is necessary.
- Remaining uncovered paths.
