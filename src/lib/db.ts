import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: ReturnType<typeof createPrismaClient> | undefined;
};

function createPrismaClient() {
  const adapter = new PrismaPg({
    connectionString: process.env.POSTGRES_PRISMA_URL!,
  });

  // Activity reads (including nested relations) exclude the private album by
  // default. Only authorized readers may explicitly select recapAlbumUrl.
  return new PrismaClient({ adapter, omit: { activity: { recapAlbumUrl: true } } });
}

export const db = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = db;
}
