CREATE TABLE "public"."inbound_signup_attempts" (
    "id" TEXT NOT NULL,
    "request_code" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "browser_token_hash" TEXT NOT NULL,
    "locale" TEXT NOT NULL DEFAULT 'zh',
    "setup_token" TEXT,
    "message_id" TEXT,
    "verified_at" TIMESTAMP(3),
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inbound_signup_attempts_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "inbound_signup_attempts_request_code_key"
    ON "public"."inbound_signup_attempts"("request_code");
CREATE UNIQUE INDEX "inbound_signup_attempts_setup_token_key"
    ON "public"."inbound_signup_attempts"("setup_token");
CREATE UNIQUE INDEX "inbound_signup_attempts_message_id_key"
    ON "public"."inbound_signup_attempts"("message_id");
CREATE INDEX "inbound_signup_attempts_email_idx"
    ON "public"."inbound_signup_attempts"("email");
CREATE INDEX "inbound_signup_attempts_expires_at_idx"
    ON "public"."inbound_signup_attempts"("expires_at");
