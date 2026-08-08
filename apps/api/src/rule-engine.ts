export type Candidate = {
  id: string;
  role: string;
  active: boolean;
  unavailable: boolean;
  assignmentCount: number;
  fridayCount: number;
  recentStations: string[];
};

export type EngineRule = {
  type: string;
  severity: "REQUIRED" | "PREFERRED" | "INFO";
  priority: number;
  scope: Record<string, unknown>;
  parameters: Record<string, unknown>;
};

export function rankCandidates(candidates: Candidate[], rules: EngineRule[], context: { eventCode: string; weekday: number; station: string; fridayCountInMonth: number }) {
  return candidates
    .map((candidate) => {
      const violations: string[] = [];
      let score = 100 - candidate.assignmentCount * 12;
      if (!candidate.active || candidate.unavailable) violations.push("Indisponível ou inativo");

      for (const rule of rules) {
        if (rule.type === "ALLOWED_ROLE" && rule.scope.eventCode === context.eventCode) {
          const allowed = (rule.parameters.roles as string[]) ?? [];
          if (!allowed.includes(candidate.role)) violations.push("Função não permitida neste culto");
        }
        if (rule.type === "MIN_DAYS_OFF" && context.weekday === Number(rule.scope.weekday)) {
          const minimum = Number(rule.parameters.minimum ?? 1);
          const maximumAssignments = Math.max(0, context.fridayCountInMonth - minimum);
          if (candidate.fridayCount >= maximumAssignments) violations.push("Folga mínima mensal não atendida");
        }
        if (rule.type === "ROTATE_STATIONS" && candidate.recentStations.includes(context.station)) score -= rule.priority / 2;
        if (rule.type === "BALANCE_LOAD") score -= candidate.assignmentCount * (rule.priority / 20);
      }

      return { ...candidate, score, violations };
    })
    .filter((candidate) => candidate.violations.length === 0)
    .sort((a, b) => b.score - a.score || a.assignmentCount - b.assignmentCount);
}
