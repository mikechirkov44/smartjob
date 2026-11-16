# Typed training assignments — 2026-11-16

User approved mixed email, single answer, multiple answers, work situation and
true/false assignments, with empty templates and reworking existing courses.

Legacy assignments without type remain emails. The old boolean column is kept;
a nullable JSON selection column stores option IDs. Answer validation and scoring
run on the server; multi-select requires the exact set, independent of order.
Public course responses exclude answer keys and explanations until submission.

The editor can add a blank template and change type with a reset confirmation.
All relevant answer labels, previews and named results reflect the chosen type.

The catalog uses neutral option IDs and scenario-specific action alternatives,
with legitimate and malicious email examples. The migration compares complete
original questions before replacing them. Custom text is preserved; draft and
published content are matched independently. Active courses get a new revision;
previous attempts retain their original content and answers. Repeat migration
is idempotent. Back up PostgreSQL before deploying the additive migration.

Verification:37 backend tests and3 frontend state checks;69 HTTP integration
checks,19 runtime migration/legacy-attempt checks, browser creation/publication
and completion of a multi-select exercise with saved100% result. Independent
review findings on catalog patterns and migration matching fixed and tested.
A browser check also identified the sticky editor toolbar hiding behind the
header while scrolling; its offset is corrected in this release.
