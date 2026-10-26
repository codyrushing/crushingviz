-- ACLED weekly aggregates also report a combined disorder category for rows
-- where both apply (sub-event "Excessive force against protesters"): only
-- combos seen in the distribution are 'Political violence; Demonstrations'.
-- Add it to the enum so those rows keep their exact on-disk value.

ALTER TYPE disorder_type ADD VALUE 'Political violence; Demonstrations';
