-- One-time guard for migrating databases previously managed by `prisma db push`.
-- Abort before accepting schema changes if any poll or legacy promotion data exists.
DO $$
DECLARE
  row_count BIGINT;
BEGIN
  IF to_regclass('public.polls') IS NOT NULL THEN
    SELECT COUNT(*) INTO row_count FROM "public"."polls";
    IF row_count <> 0 THEN
      RAISE EXCEPTION 'Poll schema push aborted: polls contains % rows', row_count;
    END IF;
  END IF;

  IF to_regclass('public.promotion_requests') IS NOT NULL THEN
    SELECT COUNT(*) INTO row_count FROM "public"."promotion_requests";
    IF row_count <> 0 THEN
      RAISE EXCEPTION 'Poll schema push aborted: promotion_requests contains % rows', row_count;
    END IF;
  END IF;

  IF to_regclass('public.promotion_votes') IS NOT NULL THEN
    SELECT COUNT(*) INTO row_count FROM "public"."promotion_votes";
    IF row_count <> 0 THEN
      RAISE EXCEPTION 'Poll schema push aborted: promotion_votes contains % rows', row_count;
    END IF;
  END IF;
END $$;
