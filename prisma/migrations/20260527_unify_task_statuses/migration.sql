UPDATE "Task"
SET "status" = 'executing'
WHERE "status" IN ('working', 'researching');
