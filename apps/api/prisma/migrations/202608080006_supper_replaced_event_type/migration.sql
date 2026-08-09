ALTER TABLE "Event"
ADD COLUMN "replacedEventTypeId" TEXT;

-- Registra o tipo de culto que ocupa normalmente a data da Santa Ceia.
UPDATE "Event" supper
SET "replacedEventTypeId" = regular."eventTypeId"
FROM "EventType" supper_type, "Event" regular, "EventType" regular_type
WHERE supper_type.id = supper."eventTypeId"
  AND supper_type.code = 'SANTA_CEIA'
  AND regular."churchId" = supper."churchId"
  AND regular.id <> supper.id
  AND regular."startsAt"::date = supper."startsAt"::date
  AND regular_type.id = regular."eventTypeId"
  AND regular_type.code <> 'SANTA_CEIA';

UPDATE "Event" supper
SET "replacedEventTypeId" = regular_type.id
FROM "EventType" supper_type, "EventType" regular_type
WHERE supper_type.id = supper."eventTypeId"
  AND supper_type.code = 'SANTA_CEIA'
  AND supper."replacedEventTypeId" IS NULL
  AND regular_type."churchId" = supper."churchId"
  AND regular_type.code <> 'SANTA_CEIA'
  AND regular_type.weekday = EXTRACT(DOW FROM supper."startsAt")::integer;

-- Corrige ocorrências já duplicadas na mesma data. As relações dependentes
-- são removidas por cascata e serão recriadas na próxima geração da escala.
DELETE FROM "Event" regular
USING "Event" supper, "EventType" supper_type, "EventType" regular_type
WHERE supper_type.id = supper."eventTypeId"
  AND supper_type.code = 'SANTA_CEIA'
  AND regular."churchId" = supper."churchId"
  AND regular.id <> supper.id
  AND regular."startsAt"::date = supper."startsAt"::date
  AND regular_type.id = regular."eventTypeId"
  AND regular_type.code <> 'SANTA_CEIA';
