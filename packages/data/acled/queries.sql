/* @name InsertAsyncJob */
INSERT INTO async_job (source, status, duration, type, meta)
VALUES (:source!, :status!, :duration!, :type!, :meta!)
RETURNING id;
