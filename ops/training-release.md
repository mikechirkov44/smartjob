# Training release

Standard clean builds use existing app Dockerfiles. The two ops Dockerfiles support
an installation with limited disk: api-update reuses the previous API dependency
layer (requires unchanged package.json), regenerates the Linux Prisma client and
builds TypeScript. web-built accepts the locally verified Vite dist output.

Back up PostgreSQL before applying migrations. The training migration is additive.
Keep the previous API/web images and a DB backup for rollback. Migrate with the
new API image before replacing containers. Preserve the uploads volume, network,
API alias and web port 3002. Existing survey data must not change.

Training media: JPG/PNG/WebP <= 5 MB; MP4/WebM <= 50 MB. Stored below the existing
uploads volume in training/. nginx allows multipart requests up to 55 MB; video
supports byte-range playback. Media URLs are opaque shared links, like survey covers.
Files referenced by old published versions are deliberately retained.

Verify: authenticated admin course creation/publication, shared-link named attempt,
all10 questions with feedback, server score, duplicate-answer replay, results,
media upload and206 range read, version pinning, organization permissions and an
existing survey endpoint. Never put credentials or actual participant data in Git.

Run `npm run test:training` for 22 backend tests and 3 frontend state regressions.
The integration script apps/api/test/training.integration.cjs must only run in a
disposable database. It creates test users and organizations and checks real HTTP
requests, images, MP4 ranges, publication conflicts and permissions.
