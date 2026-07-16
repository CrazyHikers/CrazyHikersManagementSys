-- AlterEnum
ALTER TYPE "public"."AuditEntityType" ADD VALUE 'poll';

-- CreateEnum
CREATE TYPE "public"."PollScope" AS ENUM ('member_plus', 'intern_manager_plus', 'qualified_manager_plus', 'admin');
CREATE TYPE "public"."PollStatus" AS ENUM ('draft', 'open', 'closed');
CREATE TYPE "public"."PollKind" AS ENUM ('choice', 'approval');
CREATE TYPE "public"."PollAudienceMode" AS ENUM ('role_scope', 'explicit_list');
CREATE TYPE "public"."PollFeedbackPolicy" AS ENUM ('disabled', 'optional', 'required_on_reject', 'required');
CREATE TYPE "public"."PollCreatorType" AS ENUM ('admin', 'system');
CREATE TYPE "public"."PollOutcome" AS ENUM ('passed', 'rejected', 'no_quorum');
CREATE TYPE "public"."PollOptionSemanticKey" AS ENUM ('approve', 'reject');

-- CreateTable
CREATE TABLE "public"."polls" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "kind" "public"."PollKind" NOT NULL DEFAULT 'choice',
    "audience_mode" "public"."PollAudienceMode" NOT NULL DEFAULT 'role_scope',
    "scope" "public"."PollScope",
    "status" "public"."PollStatus" NOT NULL DEFAULT 'draft',
    "anonymous" BOOLEAN NOT NULL DEFAULT true,
    "feedback_policy" "public"."PollFeedbackPolicy" NOT NULL DEFAULT 'disabled',
    "creator_type" "public"."PollCreatorType" NOT NULL DEFAULT 'admin',
    "allow_other" BOOLEAN NOT NULL DEFAULT false,
    "auto_settle" BOOLEAN NOT NULL DEFAULT false,
    "minimum_participation_bps" INTEGER NOT NULL DEFAULT 0,
    "minimum_approval_bps" INTEGER NOT NULL DEFAULT 0,
    "outcome" "public"."PollOutcome",
    "deadline" TIMESTAMP(3) NOT NULL,
    "created_by_email" TEXT,
    "published_at" TIMESTAMP(3),
    "closed_at" TIMESTAMP(3),
    "settled_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "polls_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "polls_creator_invariant" CHECK (
      ("creator_type" = 'admin' AND "created_by_email" IS NOT NULL)
      OR ("creator_type" = 'system' AND "created_by_email" IS NULL)
    ),
    CONSTRAINT "polls_audience_invariant" CHECK (
      ("audience_mode" = 'role_scope' AND "scope" IS NOT NULL)
      OR ("audience_mode" = 'explicit_list' AND "scope" IS NULL)
    ),
    CONSTRAINT "polls_participation_bps_range" CHECK (
      "minimum_participation_bps" BETWEEN 0 AND 10000
    ),
    CONSTRAINT "polls_approval_bps_range" CHECK (
      "minimum_approval_bps" BETWEEN 0 AND 10000
    )
);

-- CreateTable
CREATE TABLE "public"."poll_options" (
    "id" TEXT NOT NULL,
    "poll_id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "semantic_key" "public"."PollOptionSemanticKey",
    "sort_order" INTEGER NOT NULL,

    CONSTRAINT "poll_options_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."poll_electorate" (
    "poll_id" TEXT NOT NULL,
    "voter_email" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "poll_electorate_pkey" PRIMARY KEY ("poll_id", "voter_email")
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
    "feedback" TEXT,
    "voter_email" TEXT,

    CONSTRAINT "poll_ballots_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "poll_ballot_choice_xor" CHECK (
      ("option_id" IS NOT NULL AND "other_text" IS NULL)
      OR ("option_id" IS NULL AND "other_text" IS NOT NULL)
    )
);

-- AlterTable
DROP TABLE "public"."promotion_votes";
ALTER TABLE "public"."promotion_requests" ADD COLUMN "poll_id" TEXT NOT NULL;

-- CreateIndex
CREATE INDEX "polls_scope_idx" ON "public"."polls"("scope");
CREATE INDEX "polls_status_idx" ON "public"."polls"("status");
CREATE INDEX "polls_deadline_idx" ON "public"."polls"("deadline");
CREATE INDEX "polls_created_by_email_idx" ON "public"."polls"("created_by_email");
CREATE UNIQUE INDEX "poll_options_poll_id_sort_order_key" ON "public"."poll_options"("poll_id", "sort_order");
CREATE INDEX "poll_options_poll_id_idx" ON "public"."poll_options"("poll_id");
CREATE INDEX "poll_electorate_voter_email_idx" ON "public"."poll_electorate"("voter_email");
CREATE INDEX "poll_participations_voter_email_idx" ON "public"."poll_participations"("voter_email");
CREATE INDEX "poll_participations_voted_at_idx" ON "public"."poll_participations"("voted_at");
CREATE UNIQUE INDEX "poll_ballots_poll_id_voter_email_key" ON "public"."poll_ballots"("poll_id", "voter_email");
CREATE INDEX "poll_ballots_poll_id_idx" ON "public"."poll_ballots"("poll_id");
CREATE INDEX "poll_ballots_option_id_idx" ON "public"."poll_ballots"("option_id");
CREATE INDEX "poll_ballots_voter_email_idx" ON "public"."poll_ballots"("voter_email");
CREATE UNIQUE INDEX "promotion_requests_poll_id_key" ON "public"."promotion_requests"("poll_id");

-- AddForeignKey
ALTER TABLE "public"."polls" ADD CONSTRAINT "polls_created_by_email_fkey" FOREIGN KEY ("created_by_email") REFERENCES "public"."users"("email") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "public"."poll_options" ADD CONSTRAINT "poll_options_poll_id_fkey" FOREIGN KEY ("poll_id") REFERENCES "public"."polls"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "public"."poll_electorate" ADD CONSTRAINT "poll_electorate_poll_id_fkey" FOREIGN KEY ("poll_id") REFERENCES "public"."polls"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "public"."poll_electorate" ADD CONSTRAINT "poll_electorate_voter_email_fkey" FOREIGN KEY ("voter_email") REFERENCES "public"."users"("email") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "public"."poll_participations" ADD CONSTRAINT "poll_participations_poll_id_fkey" FOREIGN KEY ("poll_id") REFERENCES "public"."polls"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "public"."poll_participations" ADD CONSTRAINT "poll_participations_voter_email_fkey" FOREIGN KEY ("voter_email") REFERENCES "public"."users"("email") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "public"."poll_ballots" ADD CONSTRAINT "poll_ballots_poll_id_fkey" FOREIGN KEY ("poll_id") REFERENCES "public"."polls"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "public"."poll_ballots" ADD CONSTRAINT "poll_ballots_option_id_fkey" FOREIGN KEY ("option_id") REFERENCES "public"."poll_options"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "public"."poll_ballots" ADD CONSTRAINT "poll_ballots_voter_email_fkey" FOREIGN KEY ("voter_email") REFERENCES "public"."users"("email") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "public"."promotion_requests" ADD CONSTRAINT "promotion_requests_poll_id_fkey" FOREIGN KEY ("poll_id") REFERENCES "public"."polls"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
