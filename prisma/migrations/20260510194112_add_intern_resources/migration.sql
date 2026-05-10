/*
  Warnings:

  - You are about to drop the column `issued_at` on the `user_flags` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "InternResourceKind" AS ENUM ('DOCUMENT', 'VIDEO');

-- DropIndex
DROP INDEX "user_flags_issued_at_idx";

-- AlterTable
ALTER TABLE "user_flags" DROP COLUMN "issued_at";

-- CreateTable
CREATE TABLE "intern_resources" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "r2_key" TEXT NOT NULL,
    "kind" "InternResourceKind" NOT NULL,
    "mime" TEXT NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "uploaded_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "intern_resources_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "intern_resources_r2_key_key" ON "intern_resources"("r2_key");

-- CreateIndex
CREATE INDEX "intern_resources_created_at_idx" ON "intern_resources"("created_at");

-- CreateIndex
CREATE INDEX "user_flags_activity_id_idx" ON "user_flags"("activity_id");

-- AddForeignKey
ALTER TABLE "intern_resources" ADD CONSTRAINT "intern_resources_uploaded_by_id_fkey" FOREIGN KEY ("uploaded_by_id") REFERENCES "users"("email") ON DELETE CASCADE ON UPDATE CASCADE;
