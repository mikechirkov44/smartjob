// Execute only after database backup and the additive selection-column migration.
const { PrismaClient } = require("@prisma/client");
const { reworkForMappings } = require("./rework-training-content.cjs");
const { validateContent } = require("./dist/training/training.content");
const { isDeepStrictEqual } = require("node:util");
const mappings = require("./training-rework-20261116.json");
const db = new PrismaClient();
(async () => {
  let updated = 0;
  for (const row of await db.trainingCourse.findMany({
    where: { status: { not: "DELETED" } },
  })) {
    await db.$transaction(async (tx) => {
      const c = await tx.trainingCourse.findUnique({ where: { id: row.id } });
      const draft = reworkForMappings(c.draft,mappings);
      let published = null;
      let old = null;
      if (c.status === "ACTIVE" && c.publishedVersion) {
        old = await tx.trainingRevision.findUnique({
          where: {
            courseId_version: { courseId: c.id, version: c.publishedVersion },
          },
        });
        if (old)
          published = reworkForMappings(old.content,mappings);
      }
      const publishChanged =
        published && !isDeepStrictEqual(published, old.content);
      const draftChanged = !isDeepStrictEqual(draft, c.draft);
      if (!publishChanged && !draftChanged) return;
      validateContent(draft, false);
      if (publishChanged) validateContent(published);
      const version = c.publishedVersion + (publishChanged ? 1 : 0);
      const update = await tx.trainingCourse.updateMany({
        where: { id: c.id, updatedAt: c.updatedAt },
        data: { draft, publishedVersion: version },
      });
      if (update.count !== 1) throw Error("Concurrent edit: " + c.id);
      if (publishChanged)
        await tx.trainingRevision.create({
          data: { courseId: c.id, version, content: published },
        });
      updated++;
    });
  }
  console.log("Reworked courses: " + updated);
})()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
