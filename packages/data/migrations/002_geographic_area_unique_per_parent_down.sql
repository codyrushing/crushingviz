-- Restore the global (type, name) uniqueness.
-- Will fail if parent-scoped duplicates exist, which must be resolved first.

DROP INDEX IF EXISTS idx_geographic_area_type_name;

CREATE UNIQUE INDEX idx_geographic_area_type_name ON geographic_area(type, name);
