import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Story 9563142's only scenario is a smoke test (home page loads, shows the
// product name) that needs no fixture data. Story 9563143's golden-path
// journey creates all the data it needs through the app itself (register,
// create, publish). So "seeding" here means resetting to a clean, known
// state before each CI run, not inserting fixed fixture rows nothing
// consumes — deletion order respects foreign keys (children before
// parents).
async function main() {
  await prisma.omlMetadata.deleteMany();
  await prisma.projectAttachment.deleteMany();
  await prisma.projectImage.deleteMany();
  await prisma.project.deleteMany();
  await prisma.profile.deleteMany();
  await prisma.user.deleteMany();
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exitCode = 1;
  });
