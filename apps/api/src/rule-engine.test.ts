import { describe, expect, it } from "vitest";
import { rankCandidates } from "./rule-engine.js";

describe("rankCandidates", () => {
  it("bloqueia função não permitida na Santa Ceia", () => {
    const result = rankCandidates([
      { id: "aux", role: "AUXILIAR", active: true, unavailable: false, assignmentCount: 1, fridayCount: 0, recentStations: [] },
      { id: "dc", role: "DIACONO", active: true, unavailable: false, assignmentCount: 0, fridayCount: 0, recentStations: [] }
    ], [{ type: "ALLOWED_ROLE", severity: "REQUIRED", priority: 100, scope: { eventCode: "SANTA_CEIA" }, parameters: { roles: ["AUXILIAR"] } }], { eventCode: "SANTA_CEIA", weekday: 0, station: "Portaria", fridayCountInMonth: 4 });
    expect(result.map((item) => item.id)).toEqual(["aux"]);
  });

  it("preserva ao menos uma sexta livre", () => {
    const result = rankCandidates([
      { id: "livre", role: "AUXILIAR", active: true, unavailable: false, assignmentCount: 1, fridayCount: 2, recentStations: [] },
      { id: "limite", role: "AUXILIAR", active: true, unavailable: false, assignmentCount: 3, fridayCount: 3, recentStations: [] }
    ], [{ type: "MIN_DAYS_OFF", severity: "REQUIRED", priority: 100, scope: { weekday: 5 }, parameters: { minimum: 1 } }], { eventCode: "SEXTA", weekday: 5, station: "Recepção", fridayCountInMonth: 4 });
    expect(result.map((item) => item.id)).toEqual(["livre"]);
  });
});
