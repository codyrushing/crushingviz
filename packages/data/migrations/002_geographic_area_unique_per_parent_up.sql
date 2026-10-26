-- Make geographic_area name uniqueness parent-aware.
--
-- The old unique index on (type, name) forbade the same name within the same
-- type anywhere in the table, but ACLED reuses admin1 names in different
-- countries (e.g. "Centre" exists in multiple countries), so inserting the
-- second one violated the index. Uniqueness is now (type, name, parent):
-- still enforced for regions/countries (parent IS NULL, collapsed by
-- NULLS NOT DISTINCT) but scoped per parent for admin1.

DROP INDEX IF EXISTS idx_geographic_area_type_name;

CREATE UNIQUE INDEX idx_geographic_area_type_name
    ON geographic_area(type, name, parent)
    NULLS NOT DISTINCT;
