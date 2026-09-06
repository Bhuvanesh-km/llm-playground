-- Backfills `failureKind` for failures recorded before the column existed.
--
-- Scoped by model id, not by matching `errorMessage`. The old copy used one
-- sentence for both 401 and 403, and a 401 means this app's own key was
-- rejected for every model, so reading that prose could mark the whole
-- catalogue as permanently refused. The two ids below were confirmed by calling
-- OpenRouter directly at the time of this migration: both return 403,
-- "only available on agentic harnesses".
--
-- A statement about what already happened, not a rule. Nothing reads this list
-- afterwards: new refusals classify themselves.
UPDATE "Answer"
SET "failureKind" = 'PERMANENT_REFUSAL'
WHERE "status" = 'FAILED'
  AND "failureKind" IS NULL
  AND "modelId" IN (
    'thinkingmachines/inkling:free',
    'thinkingmachines/inkling-small:free'
  );
