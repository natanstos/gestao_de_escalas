import { PrismaClient, RuleSeverity, RuleType } from "@prisma/client";

const prisma = new PrismaClient();
const names = ["Alexandre (Gelo)", "Alexandro Correia", "Amaro", "Davi Oiticica", "Fernando", "Danilo Oiticica", "Raniery", "Naldo", "José Erinaldo", "Josival (Vava)", "Juliano", "Júnior", "Manoel Carvalho", "Manoel Tenório", "Rafael", "Marcos André", "Pedro", "Reinaldo", "Ailson", "Dionísio", "Edvanio Souza", "Jonathan", "Leandro", "Marcos", "Renildo", "Ronaldo", "Rosivan", "Valter"];
const stationNames = ["Portaria", "Recepção", "Lateral esquerdo", "Lateral direito", "Galeria", "Escadaria"];

async function main() {
  const church = await prisma.church.upsert({ where: { slug: "brasilia" }, update: {}, create: { name: "Igreja de Brasília", slug: "brasilia" } });
  if (await prisma.worker.count({ where: { churchId: church.id } })) {
    console.log("Dados iniciais já existem; seed ignorado.");
    return;
  }
  const auxiliary = await prisma.ministryRole.upsert({ where: { churchId_name: { churchId: church.id, name: "Auxiliar" } }, update: {}, create: { churchId: church.id, name: "Auxiliar", abbreviation: "Aux." } });
  const deacon = await prisma.ministryRole.upsert({ where: { churchId_name: { churchId: church.id, name: "Diácono" } }, update: {}, create: { churchId: church.id, name: "Diácono", abbreviation: "Dc.", sortOrder: 2 } });
  const stations = [];
  for (const [index, name] of stationNames.entries()) stations.push(await prisma.station.upsert({ where: { churchId_name: { churchId: church.id, name } }, update: {}, create: { churchId: church.id, name, sortOrder: index, defaultQuantity: name === "Portaria" || name === "Escadaria" ? 2 : 1 } }));
  const workers = [];
  for (const [index, name] of names.entries()) {
    const role = index > 17 ? deacon : auxiliary;
    const worker = await prisma.worker.create({ data: { churchId: church.id, roleId: role.id, fullName: name, displayName: name, monthlyMaximum: 6 } });
    workers.push(worker);
    await prisma.workerStation.createMany({ data: stations.map((station) => ({ workerId: worker.id, stationId: station.id, enabled: true })) });
  }

  const sunday = await prisma.eventType.create({ data: { churchId: church.id, name: "Culto de domingo", code: "DOMINGO", weekday: 0, defaultTime: "18:00", color: "#1E3A5F" } });
  const tuesday = await prisma.eventType.create({ data: { churchId: church.id, name: "Culto de terça-feira", code: "TERCA", weekday: 2, defaultTime: "19:30", color: "#0F766E" } });
  const friday = await prisma.eventType.create({ data: { churchId: church.id, name: "Culto de sexta-feira", code: "SEXTA", weekday: 5, defaultTime: "19:30", color: "#D4A72C" } });
  const supper = await prisma.eventType.create({ data: { churchId: church.id, name: "Santa Ceia", code: "SANTA_CEIA", weekday: 0, defaultTime: "18:00", color: "#7C3AED" } });
  const eventSpecs = [
    ["2026-08-09T21:00:00.000Z", supper, "Santa Ceia"],
    ["2026-08-11T22:30:00.000Z", tuesday, "Culto de terça-feira"],
    ["2026-08-14T22:30:00.000Z", friday, "Culto de sexta-feira"],
    ["2026-08-16T21:00:00.000Z", sunday, "Culto de domingo"]
  ] as const;
  const events = [];
  for (const [startsAt, type, title] of eventSpecs) {
    const event = await prisma.event.create({ data: { churchId: church.id, eventTypeId: type.id, title, startsAt: new Date(startsAt) } });
    events.push(event);
    await prisma.eventRequirement.createMany({ data: stations.map((station) => ({ eventId: event.id, stationId: station.id, quantity: station.defaultQuantity })) });
  }
  const schedule = await prisma.schedule.create({ data: { churchId: church.id, name: "Escala de agosto de 2026", periodStart: new Date("2026-08-01T03:00:00Z"), periodEnd: new Date("2026-09-01T02:59:59Z") } });
  let cursor = 0;
  for (const event of events) {
    for (const station of stations) {
      const quantity = station.defaultQuantity;
      for (let slot = 0; slot < quantity; slot++) {
        await prisma.assignment.create({ data: { scheduleId: schedule.id, eventId: event.id, stationId: station.id, workerId: workers[cursor++ % workers.length].id, status: cursor % 3 === 0 ? "PENDING" : "CONFIRMED" } });
      }
    }
  }
  await prisma.distributionRule.createMany({ data: [
    { churchId: church.id, name: "Uma sexta-feira livre", description: "Cada obreiro deve ter ao menos uma sexta-feira livre por mês.", type: RuleType.MIN_DAYS_OFF, severity: RuleSeverity.REQUIRED, priority: 100, scope: { weekday: 5, period: "MONTH" }, parameters: { minimum: 1 }, violationMessage: "O obreiro ficaria sem uma sexta-feira livre." },
    { churchId: church.id, name: "Santa Ceia somente com auxiliares", description: "Restringe todas as posições da Santa Ceia aos auxiliares.", type: RuleType.ALLOWED_ROLE, severity: RuleSeverity.REQUIRED, priority: 100, scope: { eventCode: "SANTA_CEIA" }, parameters: { roles: ["AUXILIAR"] }, violationMessage: "A função do obreiro não é permitida na Santa Ceia." },
    { churchId: church.id, name: "Equilibrar carga mensal", description: "Prioriza quem serviu menos vezes no mês.", type: RuleType.BALANCE_LOAD, severity: RuleSeverity.PREFERRED, priority: 80, scope: { period: "MONTH" }, parameters: { tolerance: 1 }, violationMessage: "A distribuição mensal ficou desequilibrada." },
    { churchId: church.id, name: "Alternar postos", description: "Evita manter o obreiro sempre no mesmo posto.", type: RuleType.ROTATE_STATIONS, severity: RuleSeverity.PREFERRED, priority: 60, scope: { lookback: 3 }, parameters: { avoidRepeats: 2 }, violationMessage: "O obreiro foi repetido recentemente neste posto." }
  ] });
}

main().finally(() => prisma.$disconnect());
