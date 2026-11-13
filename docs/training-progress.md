# Training execution ledger
Plan: docs/superpowers/plans/2026-11-13-training-plan.md
User authorized implementation, push and deployment.
Ruling: separate local clone and feature branch rather than linked worktree, because production checkout must remain untouched until deployment.

Tasks 1/2: schema, immutable publications, authorization, named attempts and scoring implemented; 13 unit tests passing; API build passes.

Final review: independent gpt-6-astra reviewer completed. Important findings addressed in one fix pass: pending edits preservation; router Back and organization-change dirty guards; transient resume token retention; publication bound to saved draft timestamp; exact pass comparison; VIEWER draft denial; streaming upload cleanup and disk-full errors; complete-container media checks and physical file verification using transaction client; 1MB JSON parsing with 900KB content cap; HTTP clipboard fallback; upload-only nginx body allowance. Backend22 tests + frontend3 tests pass, API build passes. Runtime integration pending.
Ruling: using React data router enables proper navigation blocking across browser Back, rather than only intercepting clicked links.
Ruling: score display floors to integer percent, while pass uses exact ratio, preventing a displayed80 from hiding a failing79.55.
Final: minor (deferred): unreferenced uploaded files are retained to avoid deleting media from old publications; no automatic garbage collection in first release.
Final: minor (deferred): upload feedback is textual rather than byte percentage.
Final: minor (deferred): external video links are not embedded; first version accepts actual MP4/WebM uploads.

Task 3: streaming uploads, MIME/container checks, scoped references and byte ranges verified.
Task 4: editor/list/results/template implemented and built.
Task 5 predeployment:22 backend tests +3 frontend state regressions;42 real HTTP integration checks on disposable PostgreSQL database all pass; browser created/saved/published a course and completed all10 questions with immediate feedback, final100% named result visibly confirmed. Production deployment pending.

Task 5: complete. Production deployed on192.168.1.11:3002 from feat/training. PostgreSQL backup saved before additive migration, old images/containers retained for rollback. Existing Survey/Response/Answer counts identical before/after. Production login, training list, initial phishing draft and survey read all return successful responses. GIIS remains active. Temporary verification database/containers removed after verification.
