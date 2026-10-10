import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

try {
  await prisma.connectionProbe.upsert({
    where: { id: 1 },
    update: { checkedAt: new Date() },
    create: { id: 1 },
  });
  console.log("Phase 1 seed complete. Demo websites are added in Phase 2.");
} finally {
  await prisma.$disconnect();
}
