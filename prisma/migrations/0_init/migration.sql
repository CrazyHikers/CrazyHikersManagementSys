-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "public"."ActivityManagerRole" AS ENUM ('manager', 'comanager');

-- CreateEnum
CREATE TYPE "public"."ActivityManagerStatus" AS ENUM ('invited', 'confirmed', 'declined');

-- CreateEnum
CREATE TYPE "public"."ActivityStatus" AS ENUM ('open', 'completed', 'cancelled');

-- CreateEnum
CREATE TYPE "public"."AuditAction" AS ENUM ('create', 'update', 'delete', 'status_change');

-- CreateEnum
CREATE TYPE "public"."AuditEntityType" AS ENUM ('user', 'activity', 'registration');

-- CreateEnum
CREATE TYPE "public"."FlagType" AS ENUM ('yellow', 'red');

-- CreateEnum
CREATE TYPE "public"."PromotionStatus" AS ENUM ('pending', 'pending_admin_review', 'approved', 'rejected', 'expired');

-- CreateEnum
CREATE TYPE "public"."PromotionType" AS ENUM ('member_to_intern', 'intern_to_qualified');

-- CreateEnum
CREATE TYPE "public"."RegistrationStatus" AS ENUM ('registered', 'registration_confirmed', 'attended', 'absent');

-- CreateEnum
CREATE TYPE "public"."UserRole" AS ENUM ('dev', 'admin', 'manager', 'member');

-- CreateEnum
CREATE TYPE "public"."WaiverStatus" AS ENUM ('approved', 'expired');

-- CreateTable
CREATE TABLE "public"."activities" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "cover_img_id" TEXT NOT NULL,
    "deadline" TIMESTAMP(3) NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "capacity" INTEGER NOT NULL,
    "maximum_registration" INTEGER,
    "metadata" JSONB,
    "status" "public"."ActivityStatus" NOT NULL DEFAULT 'open',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "activities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."activity_managers" (
    "activity_id" TEXT NOT NULL,
    "user_email" TEXT NOT NULL,
    "role" "public"."ActivityManagerRole" NOT NULL,
    "status" "public"."ActivityManagerStatus" NOT NULL DEFAULT 'confirmed',
    "invited_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "responded_at" TIMESTAMP(3),
    "token" TEXT,

    CONSTRAINT "activity_managers_pkey" PRIMARY KEY ("activity_id","user_email")
);

-- CreateTable
CREATE TABLE "public"."activity_updates" (
    "id" TEXT NOT NULL,
    "activity_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT,
    "posted_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "activity_updates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."app_settings" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,

    CONSTRAINT "app_settings_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "public"."audit_log" (
    "id" TEXT NOT NULL,
    "entity_type" "public"."AuditEntityType" NOT NULL,
    "entity_id" TEXT NOT NULL,
    "action" "public"."AuditAction" NOT NULL,
    "performed_by" TEXT,
    "old_values" JSONB,
    "new_values" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."discord_link_tokens" (
    "id" TEXT NOT NULL,
    "user_email" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "used_at" TIMESTAMP(3),

    CONSTRAINT "discord_link_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."discord_subscriptions" (
    "id" TEXT NOT NULL,
    "user_email" TEXT NOT NULL,
    "discord_user_id" TEXT NOT NULL,
    "username" TEXT,
    "dm_channel_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "discord_subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."manager_profiles" (
    "user_email" TEXT NOT NULL,
    "tag" TEXT NOT NULL,
    "intern" BOOLEAN NOT NULL DEFAULT true,
    "intern_since" TIMESTAMP(3),

    CONSTRAINT "manager_profiles_pkey" PRIMARY KEY ("user_email")
);

-- CreateTable
CREATE TABLE "public"."promotion_requests" (
    "id" TEXT NOT NULL,
    "user_email" TEXT NOT NULL,
    "type" "public"."PromotionType" NOT NULL,
    "status" "public"."PromotionStatus" NOT NULL DEFAULT 'pending',
    "application_text" TEXT,
    "requested_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "resolved_at" TIMESTAMP(3),

    CONSTRAINT "promotion_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."promotion_votes" (
    "id" TEXT NOT NULL,
    "request_id" TEXT NOT NULL,
    "voter_email" TEXT NOT NULL,
    "approved" BOOLEAN,
    "reason" TEXT,
    "voted_at" TIMESTAMP(3),
    "token" TEXT NOT NULL,

    CONSTRAINT "promotion_votes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."registration_proposals" (
    "activity_id" TEXT NOT NULL,
    "user_email" TEXT NOT NULL,
    "proposer_email" TEXT NOT NULL,
    "proposed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "registration_proposals_pkey" PRIMARY KEY ("activity_id","user_email","proposer_email")
);

-- CreateTable
CREATE TABLE "public"."registrations" (
    "activity_id" TEXT NOT NULL,
    "user_email" TEXT NOT NULL,
    "status" "public"."RegistrationStatus" NOT NULL DEFAULT 'registered',
    "registered_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "confirmed_at" TIMESTAMP(3),
    "notes" TEXT,
    "form_data" JSONB,
    "pending_flag" TEXT,
    "pending_flag_reason" TEXT,

    CONSTRAINT "registrations_pkey" PRIMARY KEY ("activity_id","user_email")
);

-- CreateTable
CREATE TABLE "public"."telegram_link_tokens" (
    "id" TEXT NOT NULL,
    "user_email" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "used_at" TIMESTAMP(3),

    CONSTRAINT "telegram_link_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."telegram_subscriptions" (
    "id" TEXT NOT NULL,
    "user_email" TEXT NOT NULL,
    "chat_id" TEXT NOT NULL,
    "username" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "telegram_subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."user_flags" (
    "id" TEXT NOT NULL,
    "user_email" TEXT NOT NULL,
    "activity_id" TEXT NOT NULL,
    "flag_type" "public"."FlagType" NOT NULL,
    "reason" TEXT,
    "issued_by" TEXT NOT NULL,
    "issued_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "invalidated" BOOLEAN NOT NULL DEFAULT false,
    "invalidated_at" TIMESTAMP(3),
    "invalidated_by" TEXT,

    CONSTRAINT "user_flags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."user_waivers" (
    "file_id" TEXT NOT NULL,
    "user_email" TEXT NOT NULL,
    "signed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "public"."WaiverStatus" NOT NULL DEFAULT 'approved',
    "signed_version" INTEGER,
    "signed_name" TEXT,

    CONSTRAINT "user_waivers_pkey" PRIMARY KEY ("file_id")
);

-- CreateTable
CREATE TABLE "public"."users" (
    "email" TEXT NOT NULL,
    "uid" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" "public"."UserRole" NOT NULL DEFAULT 'member',
    "password_hash" TEXT,
    "profile" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notification_prefs" JSONB,

    CONSTRAINT "users_pkey" PRIMARY KEY ("email")
);

-- CreateTable
CREATE TABLE "public"."verification_tokens" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "verification_tokens_pkey" PRIMARY KEY ("identifier","token")
);

-- CreateTable
CREATE TABLE "public"."waiver_templates" (
    "id" TEXT NOT NULL,
    "version" SERIAL NOT NULL,
    "r2_key" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "uploaded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "uploaded_by" TEXT NOT NULL,

    CONSTRAINT "waiver_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."web_push_subscriptions" (
    "id" TEXT NOT NULL,
    "user_email" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "user_agent" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_used_at" TIMESTAMP(3),

    CONSTRAINT "web_push_subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "activities_date_idx" ON "public"."activities"("date" ASC);

-- CreateIndex
CREATE INDEX "activities_deadline_idx" ON "public"."activities"("deadline" ASC);

-- CreateIndex
CREATE INDEX "activities_status_idx" ON "public"."activities"("status" ASC);

-- CreateIndex
CREATE INDEX "activity_managers_activity_id_idx" ON "public"."activity_managers"("activity_id" ASC);

-- CreateIndex
CREATE INDEX "activity_managers_role_idx" ON "public"."activity_managers"("role" ASC);

-- CreateIndex
CREATE INDEX "activity_managers_status_idx" ON "public"."activity_managers"("status" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "activity_managers_token_key" ON "public"."activity_managers"("token" ASC);

-- CreateIndex
CREATE INDEX "activity_managers_user_email_idx" ON "public"."activity_managers"("user_email" ASC);

-- CreateIndex
CREATE INDEX "activity_updates_activity_id_idx" ON "public"."activity_updates"("activity_id" ASC);

-- CreateIndex
CREATE INDEX "activity_updates_created_at_idx" ON "public"."activity_updates"("created_at" ASC);

-- CreateIndex
CREATE INDEX "audit_log_created_at_idx" ON "public"."audit_log"("created_at" ASC);

-- CreateIndex
CREATE INDEX "audit_log_entity_type_entity_id_idx" ON "public"."audit_log"("entity_type" ASC, "entity_id" ASC);

-- CreateIndex
CREATE INDEX "discord_link_tokens_expires_at_idx" ON "public"."discord_link_tokens"("expires_at" ASC);

-- CreateIndex
CREATE INDEX "discord_link_tokens_user_email_idx" ON "public"."discord_link_tokens"("user_email" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "discord_subscriptions_discord_user_id_key" ON "public"."discord_subscriptions"("discord_user_id" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "discord_subscriptions_user_email_key" ON "public"."discord_subscriptions"("user_email" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "manager_profiles_tag_key" ON "public"."manager_profiles"("tag" ASC);

-- CreateIndex
CREATE INDEX "promotion_requests_expires_at_idx" ON "public"."promotion_requests"("expires_at" ASC);

-- CreateIndex
CREATE INDEX "promotion_requests_status_idx" ON "public"."promotion_requests"("status" ASC);

-- CreateIndex
CREATE INDEX "promotion_requests_user_email_idx" ON "public"."promotion_requests"("user_email" ASC);

-- CreateIndex
CREATE INDEX "promotion_votes_request_id_idx" ON "public"."promotion_votes"("request_id" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "promotion_votes_request_id_voter_email_key" ON "public"."promotion_votes"("request_id" ASC, "voter_email" ASC);

-- CreateIndex
CREATE INDEX "promotion_votes_token_idx" ON "public"."promotion_votes"("token" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "promotion_votes_token_key" ON "public"."promotion_votes"("token" ASC);

-- CreateIndex
CREATE INDEX "registration_proposals_activity_id_user_email_idx" ON "public"."registration_proposals"("activity_id" ASC, "user_email" ASC);

-- CreateIndex
CREATE INDEX "registration_proposals_proposer_email_idx" ON "public"."registration_proposals"("proposer_email" ASC);

-- CreateIndex
CREATE INDEX "registrations_activity_id_idx" ON "public"."registrations"("activity_id" ASC);

-- CreateIndex
CREATE INDEX "registrations_status_idx" ON "public"."registrations"("status" ASC);

-- CreateIndex
CREATE INDEX "registrations_user_email_idx" ON "public"."registrations"("user_email" ASC);

-- CreateIndex
CREATE INDEX "telegram_link_tokens_expires_at_idx" ON "public"."telegram_link_tokens"("expires_at" ASC);

-- CreateIndex
CREATE INDEX "telegram_link_tokens_user_email_idx" ON "public"."telegram_link_tokens"("user_email" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "telegram_subscriptions_chat_id_key" ON "public"."telegram_subscriptions"("chat_id" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "telegram_subscriptions_user_email_key" ON "public"."telegram_subscriptions"("user_email" ASC);

-- CreateIndex
CREATE INDEX "user_flags_issued_at_idx" ON "public"."user_flags"("issued_at" ASC);

-- CreateIndex
CREATE INDEX "user_flags_user_email_idx" ON "public"."user_flags"("user_email" ASC);

-- CreateIndex
CREATE INDEX "user_waivers_user_email_idx" ON "public"."user_waivers"("user_email" ASC);

-- CreateIndex
CREATE INDEX "users_role_idx" ON "public"."users"("role" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "users_uid_key" ON "public"."users"("uid" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "verification_tokens_token_key" ON "public"."verification_tokens"("token" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "waiver_templates_version_key" ON "public"."waiver_templates"("version" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "web_push_subscriptions_endpoint_key" ON "public"."web_push_subscriptions"("endpoint" ASC);

-- CreateIndex
CREATE INDEX "web_push_subscriptions_user_email_idx" ON "public"."web_push_subscriptions"("user_email" ASC);

-- AddForeignKey
ALTER TABLE "public"."activity_managers" ADD CONSTRAINT "activity_managers_activity_id_fkey" FOREIGN KEY ("activity_id") REFERENCES "public"."activities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."activity_managers" ADD CONSTRAINT "activity_managers_user_email_fkey" FOREIGN KEY ("user_email") REFERENCES "public"."users"("email") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."activity_updates" ADD CONSTRAINT "activity_updates_activity_id_fkey" FOREIGN KEY ("activity_id") REFERENCES "public"."activities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."activity_updates" ADD CONSTRAINT "activity_updates_posted_by_fkey" FOREIGN KEY ("posted_by") REFERENCES "public"."users"("email") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."discord_link_tokens" ADD CONSTRAINT "discord_link_tokens_user_email_fkey" FOREIGN KEY ("user_email") REFERENCES "public"."users"("email") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."discord_subscriptions" ADD CONSTRAINT "discord_subscriptions_user_email_fkey" FOREIGN KEY ("user_email") REFERENCES "public"."users"("email") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."manager_profiles" ADD CONSTRAINT "manager_profiles_user_email_fkey" FOREIGN KEY ("user_email") REFERENCES "public"."users"("email") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."promotion_requests" ADD CONSTRAINT "promotion_requests_user_email_fkey" FOREIGN KEY ("user_email") REFERENCES "public"."users"("email") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."promotion_votes" ADD CONSTRAINT "promotion_votes_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "public"."promotion_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."registration_proposals" ADD CONSTRAINT "registration_proposals_activity_id_user_email_fkey" FOREIGN KEY ("activity_id", "user_email") REFERENCES "public"."registrations"("activity_id", "user_email") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."registration_proposals" ADD CONSTRAINT "registration_proposals_proposer_email_fkey" FOREIGN KEY ("proposer_email") REFERENCES "public"."users"("email") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."registrations" ADD CONSTRAINT "registrations_activity_id_fkey" FOREIGN KEY ("activity_id") REFERENCES "public"."activities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."registrations" ADD CONSTRAINT "registrations_user_email_fkey" FOREIGN KEY ("user_email") REFERENCES "public"."users"("email") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."telegram_link_tokens" ADD CONSTRAINT "telegram_link_tokens_user_email_fkey" FOREIGN KEY ("user_email") REFERENCES "public"."users"("email") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."telegram_subscriptions" ADD CONSTRAINT "telegram_subscriptions_user_email_fkey" FOREIGN KEY ("user_email") REFERENCES "public"."users"("email") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."user_flags" ADD CONSTRAINT "user_flags_activity_id_fkey" FOREIGN KEY ("activity_id") REFERENCES "public"."activities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."user_flags" ADD CONSTRAINT "user_flags_invalidated_by_fkey" FOREIGN KEY ("invalidated_by") REFERENCES "public"."users"("email") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."user_flags" ADD CONSTRAINT "user_flags_issued_by_fkey" FOREIGN KEY ("issued_by") REFERENCES "public"."users"("email") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."user_flags" ADD CONSTRAINT "user_flags_user_email_fkey" FOREIGN KEY ("user_email") REFERENCES "public"."users"("email") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."user_waivers" ADD CONSTRAINT "user_waivers_user_email_fkey" FOREIGN KEY ("user_email") REFERENCES "public"."users"("email") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."web_push_subscriptions" ADD CONSTRAINT "web_push_subscriptions_user_email_fkey" FOREIGN KEY ("user_email") REFERENCES "public"."users"("email") ON DELETE CASCADE ON UPDATE CASCADE;
