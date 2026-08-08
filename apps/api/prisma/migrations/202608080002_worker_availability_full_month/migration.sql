ALTER TABLE "Worker"
  ADD COLUMN "availabilityMode" TEXT NOT NULL DEFAULT 'ALL',
  ADD COLUMN "availableWeekdays" INTEGER[] NOT NULL DEFAULT ARRAY[]::INTEGER[],
  ADD COLUMN "availableDates" TIMESTAMP(3)[] NOT NULL DEFAULT ARRAY[]::TIMESTAMP(3)[],
  ADD COLUMN "temporarilyUnavailable" BOOLEAN NOT NULL DEFAULT false;

-- Completa as ocorrências semanais de cada escala já existente. A Santa Ceia
-- substitui o culto de domingo quando ambos caem na mesma data.
WITH occurrences AS (
  SELECT
    s.id AS schedule_id,
    s."churchId" AS church_id,
    et.id AS event_type_id,
    et.name AS title,
    et.code,
    day::date AS event_date,
    ((day::date + et."defaultTime"::time) AT TIME ZONE 'America/Sao_Paulo')::timestamp AS starts_at
  FROM "Schedule" s
  JOIN "EventType" et ON et."churchId" = s."churchId" AND et.active = true
  CROSS JOIN LATERAL generate_series((s."periodStart" - interval '3 hours')::date, (s."periodEnd" - interval '3 hours')::date, interval '1 day') day
  WHERE et.weekday IS NOT NULL
    AND et."defaultTime" IS NOT NULL
    AND EXTRACT(DOW FROM day)::integer = et.weekday
    AND et.code <> 'SANTA_CEIA'
    AND NOT (
      et.code = 'DOMINGO' AND EXISTS (
        SELECT 1 FROM "Event" supper
        JOIN "EventType" supper_type ON supper_type.id = supper."eventTypeId"
        WHERE supper."churchId" = s."churchId"
          AND supper_type.code = 'SANTA_CEIA'
          AND supper."startsAt"::date = day::date
      )
    )
), inserted_events AS (
  INSERT INTO "Event" (id, "churchId", "eventTypeId", title, "startsAt", canceled)
  SELECT 'event-' || md5(schedule_id || event_type_id || event_date::text), church_id, event_type_id, title, starts_at, false
  FROM occurrences occurrence
  WHERE NOT EXISTS (
    SELECT 1 FROM "Event" event
    WHERE event."churchId" = occurrence.church_id
      AND event."eventTypeId" = occurrence.event_type_id
      AND event."startsAt"::date = occurrence.event_date
  )
  RETURNING id, "churchId"
)
INSERT INTO "EventRequirement" (id, "eventId", "stationId", quantity, required)
SELECT 'requirement-' || md5(event.id || station.id), event.id, station.id, station."defaultQuantity", true
FROM "Event" event
JOIN "Schedule" schedule ON schedule."churchId" = event."churchId"
  AND event."startsAt" BETWEEN schedule."periodStart" AND schedule."periodEnd"
JOIN "Station" station ON station."churchId" = event."churchId" AND station.active = true
WHERE NOT EXISTS (
  SELECT 1 FROM "EventRequirement" requirement
  WHERE requirement."eventId" = event.id AND requirement."stationId" = station.id
);
