-- The combined value was never intended for this DB; remove it.
-- Will fail if rows still use the value — re-ingest or convert them first.

DELETE FROM acled_weekly_agg WHERE disorder_type = 'Political violence; Demonstrations';

ALTER TYPE disorder_type RENAME TO disorder_type_old;
CREATE TYPE disorder_type AS ENUM ('Political violence', 'Demonstrations', 'Strategic developments');
ALTER TABLE acled_weekly_agg
    ALTER COLUMN disorder_type TYPE disorder_type
    USING disorder_type::text::disorder_type;
DROP TYPE disorder_type_old;
