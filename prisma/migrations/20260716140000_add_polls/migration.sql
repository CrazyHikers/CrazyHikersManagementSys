-- AlterEnum
ALTER TYPE "public"."AuditEntityType" ADD VALUE 'poll';

-- CreateEnum
CREATE TYPE "public"."PollScope" AS ENUM ('member_plus', 'manager_plus', 'admin');

-- CreateEnum
CREATE TYPE "public"."PollStatus" AS ENUM ('draft', 'open', 'closed');

-- CreateTable
CREATE TABLE "public"."polls" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "scope" "public"."PollScope" NOT NULL,
    "status" "public"."PollStatus" NOT NULL DEFAULT 'draft',
    "allow_other" BOOLEAN NOT NULL DEFAULT false,
    "deadline" TIMESTAMP(3) NOT NULL,
    "created_by_email" TEXT NOT NULL,
    "published_at" TIMESTAMP(3),
    "closed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "polls_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."poll_options" (
    "id" TEXT NOT NULL,
    "poll_id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL,

    CONSTRAINT "poll_options_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."poll_participations" (
    "poll_id" TEXT NOT NULL,
    "voter_email" TEXT NOT NULL,
    "voted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "poll_participations_pkey" PRIMARY KEY ("poll_id", "voter_email")
);

-- CreateTable
CREATE TABLE "public"."poll_ballots" (
    "id" TEXT NOT NULL,
    "poll_id" TEXT NOT NULL,
    "option_id" TEXT,
    "other_text" TEXT,

    CONSTRAINT "poll_ballots_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "poll_ballot_choice_xor" CHECK (
      ("option_id" IS NOT NULL AND "other_text" IS NULL)
      OR ("option_id" IS NULL AND "other_text" IS NOT NULL)
    )
);

-- CreateIndex
CREATE INDEX "polls_scope_idx" ON "public"."polls"("scope");
CREATE INDEX "polls_status_idx" ON "public"."polls"("status");
CREATE INDEX "polls_deadline_idx" ON "public"."polls"("deadline");
CREATE INDEX "polls_created_by_email_idx" ON "public"."polls"("created_by_email");
CREATE UNIQUE INDEX "poll_options_poll_id_sort_order_key" ON "public"."poll_options"("poll_id", "sort_order");
CREATE INDEX "poll_options_poll_id_idx" ON "public"."poll_options"("poll_id");
CREATE INDEX "poll_participations_voter_email_idx" ON "public"."poll_participations"("voter_email");
CREATE INDEX "poll_participations_voted_at_idx" ON "public"."poll_participations"("voted_at");
CREATE INDEX "poll_ballots_poll_id_idx" ON "public"."poll_ballots"("poll_id");
CREATE INDEX "poll_ballots_option_id_idx" ON "public"."poll_ballots"("option_id");

-- AddForeignKey
ALTER TABLE "public"."polls" ADD CONSTRAINT "polls_created_by_email_fkey" FOREIGN KEY ("created_by_email") REFERENCES "public"."users"("email") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "public"."poll_options" ADD CONSTRAINT "poll_options_poll_id_fkey" FOREIGN KEY ("poll_id") REFERENCES "public"."polls"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "public"."poll_participations" ADD CONSTRAINT "poll_participations_poll_id_fkey" FOREIGN KEY ("poll_id") REFERENCES "public"."polls"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "public"."poll_participations" ADD CONSTRAINT "poll_participations_voter_email_fkey" FOREIGN KEY ("voter_email") REFERENCES "public"."users"("email") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "public"."poll_ballots" ADD CONSTRAINT "poll_ballots_poll_id_fkey" FOREIGN KEY ("poll_id") REFERENCES "public"."polls"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "public"."poll_ballots" ADD CONSTRAINT "poll_ballots_option_id_fkey" FOREIGN KEY ("option_id") REFERENCES "public"."poll_options"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
