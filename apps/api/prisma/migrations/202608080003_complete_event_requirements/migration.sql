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
