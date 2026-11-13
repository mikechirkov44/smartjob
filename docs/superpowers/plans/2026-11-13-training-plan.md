# SmartJob Training Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add editable courses with multimedia introductions, named public attempts and immediate feedback.
**Architecture:** Separate NestJS training module with Prisma course/revision/attempt tables; use existing organization authorization. React administration and public course pages use version-pinned attempts and server-side scoring.
**Tech Stack:** Existing React/TypeScript, NestJS, Prisma, PostgreSQL, nginx and Docker.
**Spec:** 2026-11-13-training-design.md

## Global Constraints
- Preserve existing surveys, databases, files and ports; SmartJob stays on 3002.
- Named participation without registration; feedback immediately after each answer.
- Editable ordered text/image/video introductions; immutable published versions.
- First phishing template: 10 questions; default pass mark 80%.
- Uploaded images up to 5 MB, MP4/WebM up to 50 MB (implementation defaults).
- Current server has only 377 MB free: inspect storage before building or uploading media.

## Review Focus
- Cross-organization IDs and spoofed organization header must not grant access.
- Publishing while someone takes a course must not change their questions or score.
- Double-clicks and repeated answers must not add points or duplicate completion.
- Invalid, oversized, missing or interrupted media must fail clearly without losing editor text.
- Closed links, empty names and incomplete attempts must not produce successful results.

### Task 1: Course persistence and publication
**Files:** apps/api/prisma/schema.prisma; new migration; apps/api/src/training/{training.module.ts,training.controller.ts,training.service.ts,training.dto.ts,training.types.ts,training.service.spec.ts}; apps/api/src/app.module.ts.
**Interfaces:** organization-scoped GET/POST /organizations/:organizationId/training; GET/PATCH /:id; POST /:id/publish, /:id/close, /:id/duplicate. Course stores draft; CourseRevision stores immutable validated content; TrainingAttempt pins revision and stores participant name and server-generated attempt token.
- [ ] Write tests for scoped reads/writes, VIEWER denial on mutations, invalid course and publication preserving old revisions.
- [ ] Run targeted Jest suite and confirm failure before implementation.
- [ ] Implement DTO validation and service-level membership checks against the path organization (existing guard also accepts a header). Draft saves never mutate revisions. Reject publication with empty lesson/questions or invalid answer definitions.
- [ ] Run suite, generate Prisma client and build API; commit task.

### Task 2: Named attempts and scoring
**Files:** apps/api/src/training/{public-training.controller.ts,attempts.service.ts,attempts.dto.ts,attempts.service.spec.ts}.
**Interfaces:** GET /public/training/:linkToken returns active overview; POST /:linkToken/start accepts participantName and returns attemptToken; GET /attempts/:attemptToken returns pinned course and saved progress without future correct answers; POST /attempts/:attemptToken/answers accepts questionId and choice and returns only that question feedback; POST /attempts/:attemptToken/complete returns server-computed score/pass/summary. Scoped GET /organizations/:organizationId/training/:id/attempts returns paginated results and details.
- [ ] Write failing tests for whitespace-only name, closed link, forged score, unanswered completion, duplicate answer, version change and out-of-order answers.
- [ ] Implement transactions and unique answer-per-attempt constraints; first answer is immutable and repeat submission returns stored feedback. Compute score against pinned revision; retain all attempts.
- [ ] Verify tests and build; commit task.

### Task 3: Training media
**Files:** apps/api/src/training/{training-media.controller.ts,training-media.service.ts,training-media.service.spec.ts}; apps/web/nginx.conf.
**Interfaces:** organization-scoped POST /organizations/:organizationId/training/media multipart file returns mediaId/kind/url; opaque media GET supports image display and HTTP Range video playback.
- [ ] Write failing tests for file signatures, MIME mismatch, size limits, traversal, cross-org attachment and video range requests.
- [ ] Stream uploads to disk with limits; validate signatures, store organization metadata, permit only server-owned media references when saving/publishing. Do not load 50 MB videos into memory. Preserve published media. Set nginx body limit 55m for upload route and clear errors for disk exhaustion.
- [ ] Verify range playback, invalid uploads and existing cover uploads still work; commit task.

### Task 4: Administration and first template
**Files:** apps/web/src/pages/{TrainingListPage.tsx,TrainingEditPage.tsx,TrainingResultsPage.tsx}; apps/web/src/components/training/{LessonEditor.tsx,QuestionEditor.tsx,TrainingPreview.tsx,training.css}; apps/web/src/{App.tsx,components/Layout.tsx}; apps/api/src/training/phishing-template.ts.
**Interfaces:** /training, /training/new, /training/:id/edit, /training/:id/results; existing auth organizationId and API client. Editor consumes validated content blocks {id,type,text?,mediaId?,caption?} and questions with sender/display name, sender address, subject, body, safe link labels, correct choice and explanation.
- [ ] Add tests for draft round-trip, ordered blocks, failed upload preserving text, accessible move/remove controls and organization switching.
- [ ] Implement list/editor/results, upload progress, publication/close/copy-link, dirty-state warning and preview. Reuse existing visual styles.
- [ ] Add 10 original Russian examples and short introduction/pamphlet; deliberately inert domains and links. Include safe legitimate examples, deceptive domains, attachments, urgent payment and credential requests.
- [ ] Run web build and component checks; commit task.

### Task 5: Public experience and deployment
**Files:** apps/web/src/pages/PublicTrainingPage.tsx; apps/web/src/components/training/{LessonViewer.tsx,EmailExercise.tsx}; apps/web/src/App.tsx; deployment notes.
**Interfaces:** public /learn/:linkToken; attempt token retained for resume on the same device; lesson blocks rendered as safe text/media and example links displayed as text, never followed.
- [ ] Test name -> lesson -> answer -> immediate feedback -> completion; refresh resume, repeated attempt, closed course, mobile layout and inaccessible media.
- [ ] Implement public route, progress, responsive email exercise, result and reminder; use server feedback and scores.
- [ ] Inspect Docker disk usage and reclaim only confirmed unused SmartJob build artifacts if needed. Back up SmartJob DB before migration; build tagged images and retain rollback images. Never remove working volumes or another app's files.
- [ ] Deploy migration and containers on existing port 3002; verify login, existing survey, named training, actual image/video playback, results, immutable previous attempt and restart persistence. Record evidence and remaining limits.
