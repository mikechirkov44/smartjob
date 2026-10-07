const fs = require('fs');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  const s = await prisma.survey.findFirst();
  fs.writeFileSync(
    'title-check.json',
    JSON.stringify(
      {
        title: s?.title,
        description: s?.description,
        coverImage: s?.coverImage,
      },
      null,
      2,
    ),
    'utf8',
  );
  console.log('written');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
