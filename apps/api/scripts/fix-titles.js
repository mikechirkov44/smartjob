const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  const rows = await prisma.survey.findMany();
  for (const s of rows) {
    if (/\?/.test(s.title) || /\?/.test(s.description || '')) {
      await prisma.survey.update({
        where: { id: s.id },
        data: {
          title: 'Тестовый опрос',
          description: 'Опрос вовлечённости',
        },
      });
      console.log('fixed', s.id);
    }
  }
  console.log('surveys', rows.length);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
