ALTER TABLE "activities"
    ADD COLUMN "recap_description" TEXT NOT NULL DEFAULT '',
    ADD COLUMN "recap_photo_keys" TEXT[] DEFAULT ARRAY[]::TEXT[],
    ADD COLUMN "recap_album_url" TEXT NOT NULL DEFAULT '';
