# Command: /backend-review <scope>

Goal:
Analyze backend logic safely before any patch.

Steps:
1. Identify impacted files/functions/routes for <scope>.
2. Trace current calculation/decision flow end-to-end.
3. List all entry points that can trigger behavior.
4. Check bypass paths (service calls, cron, import flow, other controllers).
5. List edge cases and regression risks.
6. Propose smallest-safe patch strategy (no code changes yet).

Output format:
Use global/templates/output-format.md
