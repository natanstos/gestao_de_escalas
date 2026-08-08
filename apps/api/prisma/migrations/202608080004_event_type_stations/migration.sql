CREATE TABLE "EventTypeStation" (
  "eventTypeId" TEXT NOT NULL REFERENCES "EventType"("id") ON DELETE CASCADE,
  "stationId" TEXT NOT NULL REFERENCES "Station"("id") ON DELETE CASCADE,
  quantity INTEGER NOT NULL DEFAULT 1,
  enabled BOOLEAN NOT NULL DEFAULT true,
  PRIMARY KEY ("eventTypeId", "stationId")
);

INSERT INTO "EventTypeStation" ("eventTypeId", "stationId", quantity, enabled)
SELECT event_type.id, station.id, station."defaultQuantity", true
FROM "EventType" event_type
JOIN "Station" station ON station."churchId" = event_type."churchId" AND station.active = true;
