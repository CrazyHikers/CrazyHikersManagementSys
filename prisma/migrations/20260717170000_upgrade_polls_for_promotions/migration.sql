-- This migration upgrades databases that already received the initial poll
-- schema. Legacy promotion voting data is intentionally unsupported because
-- the deployment was verified to contain no promotion requests or votes.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "public"."promotion_requests") THEN
    RAISE EXCEPTION 'Cannot upgrade polls while legacy promotion requests exist';
  END IF;

  IF EXISTS (SELECT 1 FROM "public"."promotion_votes") THEN
    RAISE EXCEPTION 'Cannot upgrade polls while legacy promotion votes exist';
  END IF;
END $$;

-- Preserve the meaning of the previous manager_plus electorate and add the
-- new lower identity tier without recreating the enum or recasting its data.
ALTER TYPE "public"."PollScope" RENAME VALUE 'manager_plus' TO 'qualified_manager_plus';
ALTER TYPE "public"."PollScope" ADD VALUE 'intern_manager_plus' BEFORE 'qualified_manager_plus';

-- CreateEnum
CREATE TYPE "public"."PollKind" AS ENUM ('choice', 'approval');
CREATE TYPE "public"."PollAudienceMode" AS ENUM ('role_scope', 'explicit_list');
CREATE TYPE "public"."PollFeedbackPolicy" AS ENUM ('disabled', 'optional', 'required_on_reject', 'required');
CREATE TYPE "public"."PollCreatorType" AS ENUM ('admin', 'system');
CREATE TYPE "public"."PollOutcome" AS ENUM ('passed', 'rejected', 'no_quorum');
CREATE TYPE "public"."PollOptionSemanticKey" AS ENUM ('approve', 'reject');

-- AlterTable
ALTER TABLE "public"."poll_ballots"
  ADD COLUMN "feedback" TEXT,
  ADD COLUMN "voter_email" TEXT;

ALTER TABLE "public"."poll_options"
  ADD COLUMN "semantic_key" "public"."PollOptionSemanticKey";

ALTER TABLE "public"."polls"
  ADD COLUMN "anonymous" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "audience_mode" "public"."PollAudienceMode" NOT NULL DEFAULT 'role_scope',
  ADD COLUMN "auto_settle" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "creator_type" "public"."PollCreatorType" NOT NULL DEFAULT 'admin',
  ADD COLUMN "feedback_policy" "public"."PollFeedbackPolicy" NOT NULL DEFAULT 'disabled',
  ADD COLUMN "kind" "public"."PollKind" NOT NULL DEFAULT 'choice',
  ADD COLUMN "minimum_approval_bps" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "minimum_participation_bps" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "outcome" "public"."PollOutcome",
  ADD COLUMN "settled_at" TIMESTAMP(3),
  ALTER COLUMN "scope" DROP NOT NULL,
  ALTER COLUMN "created_by_email" DROP NOT NULL;

ALTER TABLE "public"."polls"
  ADD CONSTRAINT "polls_creator_invariant" CHECK (
    ("creator_type" = 'admin' AND "created_by_email" IS NOT NULL)
    OR ("creator_type" = 'system' AND "created_by_email" IS NULL)
  ),
  ADD CONSTRAINT "polls_audience_invariant" CHECK (
    ("audience_mode" = 'role_scope' AND "scope" IS NOT NULL)
    OR ("audience_mode" = 'explicit_list' AND "scope" IS NULL)
  ),
  ADD CONSTRAINT "polls_participation_bps_range" CHECK (
    "minimum_participation_bps" BETWEEN 0 AND 10000
  ),
  ADD CONSTRAINT "polls_approval_bps_range" CHECK (
    "minimum_approval_bps" BETWEEN 0 AND 10000
  );

ALTER TABLE "public"."promotion_requests"
  ADD COLUMN "poll_id" TEXT NOT NULL;

-- DropTable
DROP TABLE "public"."promotion_votes";

-- CreateTable
CREATE TABLE "public"."poll_electorate" (
  "poll_id" TEXT NOT NULL,
  "voter_email" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "poll_electorate_pkey" PRIMARY KEY ("poll_id", "voter_email")
);

-- CreateIndex
CREATE INDEX "poll_electorate_voter_email_idx" ON "public"."poll_electorate"("voter_email");
CREATE INDEX "poll_ballots_voter_email_idx" ON "public"."poll_ballots"("voter_email");
CREATE UNIQUE INDEX "poll_ballots_poll_id_voter_email_key" ON "public"."poll_ballots"("poll_id", "voter_email");
CREATE UNIQUE INDEX "promotion_requests_poll_id_key" ON "public"."promotion_requests"("poll_id");

-- AddForeignKey
ALTER TABLE "public"."promotion_requests" ADD CONSTRAINT "promotion_requests_poll_id_fkey" FOREIGN KEY ("poll_id") REFERENCES "public"."polls"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "public"."poll_electorate" ADD CONSTRAINT "poll_electorate_poll_id_fkey" FOREIGN KEY ("poll_id") REFERENCES "public"."polls"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "public"."poll_electorate" ADD CONSTRAINT "poll_electorate_voter_email_fkey" FOREIGN KEY ("voter_email") REFERENCES "public"."users"("email") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "public"."poll_ballots" ADD CONSTRAINT "poll_ballots_voter_email_fkey" FOREIGN KEY ("voter_email") REFERENCES "public"."users"("email") ON DELETE CASCADE ON UPDATE CASCADE;
