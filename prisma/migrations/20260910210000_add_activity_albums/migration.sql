CREATE TABLE "activity_albums" (
    "activity_id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    CONSTRAINT "activity_albums_pkey" PRIMARY KEY ("activity_id"),
    CONSTRAINT "activity_albums_activity_id_fkey" FOREIGN KEY ("activity_id") REFERENCES "activities"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
