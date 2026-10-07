import { GlobalRole, PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const email = (process.env.SUPER_ADMIN_EMAIL || 'admin@smartjob.local').toLowerCase();
  const password = process.env.SUPER_ADMIN_PASSWORD || 'ChangeMe123!';
  const name = process.env.SUPER_ADMIN_NAME || 'Супер-админ';
  const passwordHash = await bcrypt.hash(password, 10);

  await prisma.user.upsert({
    where: { email },
    update: {
      name,
      passwordHash,
      globalRole: GlobalRole.SUPER_ADMIN,
    },
    create: {
      email,
      name,
      passwordHash,
      globalRole: GlobalRole.SUPER_ADMIN,
    },
  });

  // eslint-disable-next-line no-console
  console.log(`Супер-админ готов: ${email}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
