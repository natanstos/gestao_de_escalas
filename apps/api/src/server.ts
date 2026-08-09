import express from "express";
import cors from "cors";
import helmet from "helmet";
import { Prisma, PrismaClient, RuleSeverity, RuleType, ScheduleStatus } from "@prisma/client";
import { z } from "zod";

const prisma = new PrismaClient();
const app = express();
app.use(helmet());
app.use(cors({ origin: process.env.NODE_ENV === "production" ? false : true }));
app.use(express.json({ limit: "1mb" }));

const church = () => prisma.church.findFirstOrThrow({ where: { active: true } });
const scheduleInclude = { assignments: { include: { event: { include: { eventType: true } }, station: true, worker: { include: { role: true } } }, orderBy: [{ event: { startsAt: "asc" as const } }, { station: { sortOrder: "asc" as const } }] } };
const dateKey = (date: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
const weekdayAtChurch = (date: Date) => ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(new Intl.DateTimeFormat("en-US", { timeZone: "America/Sao_Paulo", weekday: "short" }).format(date));
const isWorkerAvailable = (worker: { active: boolean; temporarilyUnavailable: boolean; availabilityMode: string; availableWeekdays: number[]; availableDates: Date[]; availability: Array<{ kind: string; startsAt: Date; endsAt: Date }> }, startsAt: Date) => {
  if (!worker.active || worker.temporarilyUnavailable) return false;
  const matchesMode = worker.availabilityMode === "ALL"
    || (worker.availabilityMode === "WEEKDAYS" && worker.availableWeekdays.includes(weekdayAtChurch(startsAt)))
    || (worker.availabilityMode === "DATES" && worker.availableDates.some(date => dateKey(date) === dateKey(startsAt)));
  const unavailable = worker.availability.some(item => item.kind === "indisponivel" && item.startsAt <= startsAt && item.endsAt >= startsAt);
  return matchesMode && !unavailable;
};

app.get("/api/health", (_req, res) => res.json({ status: "ok", service: "gestao-de-escalas" }));

app.get("/api/dashboard", async (_req, res, next) => {
  try {
    const currentChurch = await church();
    const [workers, rules, schedule] = await Promise.all([
      prisma.worker.count({ where: { churchId: currentChurch.id, active: true } }),
      prisma.distributionRule.count({ where: { churchId: currentChurch.id, active: true } }),
      prisma.schedule.findFirst({ where: { churchId: currentChurch.id }, orderBy: { periodStart: "desc" }, include: scheduleInclude })
    ]);
    const events = schedule ? await prisma.event.findMany({
      where: { churchId: currentChurch.id, startsAt: { gte: schedule.periodStart, lte: schedule.periodEnd }, canceled: false },
      include: { eventType: true, requirements: { include: { station: true }, orderBy: { station: { sortOrder: "asc" } } } },
      orderBy: { startsAt: "asc" }
    }) : [];
    res.json({ church: currentChurch, workers, rules, schedule, events });
  } catch (error) { next(error); }
});

app.patch("/api/church", async (req, res, next) => {
  try {
    const currentChurch = await church();
    const input = z.object({ name: z.string().min(3).max(120), timezone: z.string().min(3).max(80) }).parse(req.body);
    res.json(await prisma.church.update({ where: { id: currentChurch.id }, data: input }));
  } catch (error) { next(error); }
});

app.get("/api/workers", async (_req, res, next) => {
  try {
    const currentChurch = await church();
    const workers = await prisma.worker.findMany({ where: { churchId: currentChurch.id }, include: { role: true, _count: { select: { assignments: true } } }, orderBy: { displayName: "asc" } });
    res.json(workers);
  } catch (error) { next(error); }
});

const workerInput = z.object({
  displayName: z.string().min(2).max(100),
  roleName: z.string().min(2).max(50),
  phone: z.string().max(30).optional().default(""),
  active: z.boolean().optional().default(true),
  availabilityMode: z.enum(["ALL", "WEEKDAYS", "DATES"]).optional().default("ALL"),
  availableWeekdays: z.array(z.number().int().min(0).max(6)).optional().default([]),
  availableDates: z.array(z.coerce.date()).optional().default([]),
  temporarilyUnavailable: z.boolean().optional().default(false)
});

app.post("/api/workers", async (req, res, next) => {
  try {
    const currentChurch = await church();
    const input = workerInput.parse(req.body);
    const role = await prisma.ministryRole.findFirstOrThrow({ where: { churchId: currentChurch.id, name: input.roleName } });
    const worker = await prisma.worker.create({ data: { churchId: currentChurch.id, roleId: role.id, fullName: input.displayName, displayName: input.displayName, phone: input.phone, active: input.active, availabilityMode: input.availabilityMode, availableWeekdays: input.availableWeekdays, availableDates: input.availableDates, temporarilyUnavailable: input.temporarilyUnavailable }, include: { role: true, _count: { select: { assignments: true } } } });
    const stations = await prisma.station.findMany({ where: { churchId: currentChurch.id, active: true } });
    await prisma.workerStation.createMany({ data: stations.map(station => ({ workerId: worker.id, stationId: station.id })) });
    res.status(201).json(worker);
  } catch (error) { next(error); }
});

app.patch("/api/workers/:id", async (req, res, next) => {
  try {
    const currentChurch = await church();
    const existing = await prisma.worker.findFirstOrThrow({ where: { id: req.params.id, churchId: currentChurch.id } });
    const input = workerInput.partial().parse(req.body);
    const role = input.roleName ? await prisma.ministryRole.findFirstOrThrow({ where: { churchId: currentChurch.id, name: input.roleName } }) : null;
    res.json(await prisma.worker.update({ where: { id: existing.id }, data: { displayName: input.displayName, fullName: input.displayName, phone: input.phone, active: input.active, roleId: role?.id, availabilityMode: input.availabilityMode, availableWeekdays: input.availableWeekdays, availableDates: input.availableDates, temporarilyUnavailable: input.temporarilyUnavailable }, include: { role: true, _count: { select: { assignments: true } } } }));
  } catch (error) { next(error); }
});

app.patch("/api/events/:id", async (req, res, next) => {
  try {
    const currentChurch = await church();
    const existing = await prisma.event.findFirstOrThrow({ where: { id: req.params.id, churchId: currentChurch.id } });
    const input = z.object({ title: z.string().min(3).max(120), startsAt: z.coerce.date() }).parse(req.body);
    res.json(await prisma.event.update({ where: { id: existing.id }, data: input, include: { eventType: true } }));
  } catch (error) { next(error); }
});

app.get("/api/stations", async (_req, res, next) => {
  try {
    const currentChurch = await church();
    res.json(await prisma.station.findMany({ where: { churchId: currentChurch.id }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }] }));
  } catch (error) { next(error); }
});

const stationInput = z.object({ name: z.string().min(2).max(80), defaultQuantity: z.number().int().min(1).max(10), active: z.boolean().optional().default(true) });

app.post("/api/stations", async (req, res, next) => {
  try {
    const currentChurch = await church();
    const input = stationInput.parse(req.body);
    const [eventTypes, events, lastStation] = await Promise.all([
      prisma.eventType.findMany({ where: { churchId: currentChurch.id, active: true } }),
      prisma.event.findMany({ where: { churchId: currentChurch.id, canceled: false } }),
      prisma.station.findFirst({ where: { churchId: currentChurch.id }, orderBy: { sortOrder: "desc" } })
    ]);
    const station = await prisma.$transaction(async tx => {
      const created = await tx.station.create({ data: { churchId: currentChurch.id, ...input, sortOrder: (lastStation?.sortOrder ?? -1) + 1 } });
      await tx.eventTypeStation.createMany({ data: eventTypes.map(eventType => ({ eventTypeId: eventType.id, stationId: created.id, quantity: input.defaultQuantity, enabled: true })) });
      await tx.eventRequirement.createMany({ data: events.map(event => ({ eventId: event.id, stationId: created.id, quantity: input.defaultQuantity, required: true })) });
      return created;
    });
    res.status(201).json(station);
  } catch (error) { next(error); }
});

app.patch("/api/stations/:id", async (req, res, next) => {
  try {
    const currentChurch = await church();
    const existing = await prisma.station.findFirstOrThrow({ where: { id: req.params.id, churchId: currentChurch.id } });
    const input = stationInput.partial().parse(req.body);
    const station = await prisma.$transaction(async tx => {
      const updated = await tx.station.update({ where: { id: existing.id }, data: input });
      if (input.active === false) {
        await tx.eventTypeStation.updateMany({ where: { stationId: existing.id }, data: { enabled: false } });
        await tx.eventRequirement.deleteMany({ where: { stationId: existing.id, event: { churchId: currentChurch.id } } });
      }
      return updated;
    });
    res.json(station);
  } catch (error) { next(error); }
});

app.get("/api/event-types", async (_req, res, next) => {
  try {
    const currentChurch = await church();
    res.json(await prisma.eventType.findMany({ where: { churchId: currentChurch.id, active: true }, include: { stations: { include: { station: true }, orderBy: { station: { sortOrder: "asc" } } } }, orderBy: [{ weekday: "asc" }, { name: "asc" }] }));
  } catch (error) { next(error); }
});

app.put("/api/event-types/:id/stations", async (req, res, next) => {
  try {
    const currentChurch = await church();
    const eventType = await prisma.eventType.findFirstOrThrow({ where: { id: req.params.id, churchId: currentChurch.id } });
    const input = z.object({ positions: z.array(z.object({ stationId: z.string().min(1), enabled: z.boolean(), quantity: z.number().int().min(1).max(10) })) }).parse(req.body);
    const churchStations = await prisma.station.findMany({ where: { churchId: currentChurch.id, id: { in: input.positions.map(item => item.stationId) } } });
    if (churchStations.length !== input.positions.length) return res.status(400).json({ message: "Uma ou mais posições são inválidas." });
    const events = await prisma.event.findMany({ where: { churchId: currentChurch.id, eventTypeId: eventType.id } });
    await prisma.$transaction(async tx => {
      for (const position of input.positions) {
        await tx.eventTypeStation.upsert({ where: { eventTypeId_stationId: { eventTypeId: eventType.id, stationId: position.stationId } }, update: { enabled: position.enabled, quantity: position.quantity }, create: { eventTypeId: eventType.id, stationId: position.stationId, enabled: position.enabled, quantity: position.quantity } });
        if (position.enabled) {
          for (const event of events) await tx.eventRequirement.upsert({ where: { eventId_stationId: { eventId: event.id, stationId: position.stationId } }, update: { quantity: position.quantity, required: true }, create: { eventId: event.id, stationId: position.stationId, quantity: position.quantity, required: true } });
        } else {
          await tx.eventRequirement.deleteMany({ where: { stationId: position.stationId, eventId: { in: events.map(event => event.id) } } });
          await tx.assignment.deleteMany({ where: { stationId: position.stationId, eventId: { in: events.map(event => event.id) } } });
        }
      }
    });
    res.json(await prisma.eventType.findUniqueOrThrow({ where: { id: eventType.id }, include: { stations: { include: { station: true }, orderBy: { station: { sortOrder: "asc" } } } } }));
  } catch (error) { next(error); }
});

app.patch("/api/assignments/:id", async (req, res, next) => {
  try {
    const currentChurch = await church();
    const input = z.object({ workerId: z.string().min(1) }).parse(req.body);
    const assignment = await prisma.assignment.findFirstOrThrow({
      where: { id: req.params.id, schedule: { churchId: currentChurch.id } },
      include: { event: { include: { eventType: true } }, station: true }
    });
    const worker = await prisma.worker.findFirstOrThrow({ where: { id: input.workerId, churchId: currentChurch.id }, include: { role: true, availability: true } });
    if (!isWorkerAvailable(worker, assignment.event.startsAt)) return res.status(409).json({ message: "O obreiro não está disponível nessa data." });
    if (assignment.event.eventType.code === "SANTA_CEIA" && worker.role.name !== "Auxiliar") return res.status(409).json({ message: "Na Santa Ceia, somente auxiliares podem ser escalados." });
    const alreadyAssigned = await prisma.assignment.findFirst({ where: { scheduleId: assignment.scheduleId, eventId: assignment.eventId, workerId: worker.id, id: { not: assignment.id } } });
    if (alreadyAssigned) return res.status(409).json({ message: "O obreiro já está escalado neste culto." });
    res.json(await prisma.assignment.update({ where: { id: assignment.id }, data: { workerId: worker.id, origin: "MANUAL", status: "PENDING" }, include: { worker: { include: { role: true } }, station: true, event: { include: { eventType: true } } } }));
  } catch (error) { next(error); }
});

app.put("/api/schedules/:id/visible-events", async (req, res, next) => {
  try {
    const currentChurch = await church();
    const schedule = await prisma.schedule.findFirstOrThrow({ where: { id: req.params.id, churchId: currentChurch.id } });
    const input = z.object({ eventIds: z.array(z.string().min(1)) }).parse(req.body);
    const validEvents = await prisma.event.findMany({ where: { id: { in: input.eventIds }, churchId: currentChurch.id, startsAt: { gte: schedule.periodStart, lte: schedule.periodEnd } }, select: { id: true } });
    if (validEvents.length !== new Set(input.eventIds).size) return res.status(400).json({ message: "Um ou mais cultos não pertencem a esta escala." });
    await prisma.$transaction([
      prisma.event.updateMany({ where: { churchId: currentChurch.id, startsAt: { gte: schedule.periodStart, lte: schedule.periodEnd } }, data: { visibleInSchedule: false } }),
      prisma.event.updateMany({ where: { id: { in: validEvents.map(event => event.id) } }, data: { visibleInSchedule: true } })
    ]);
    res.json(await prisma.event.findMany({ where: { churchId: currentChurch.id, startsAt: { gte: schedule.periodStart, lte: schedule.periodEnd }, canceled: false }, include: { eventType: true, requirements: { include: { station: true }, orderBy: { station: { sortOrder: "asc" } } } }, orderBy: { startsAt: "asc" } }));
  } catch (error) { next(error); }
});

app.put("/api/schedules/:id/santa-ceia", async (req, res, next) => {
  try {
    const currentChurch = await church();
    const schedule = await prisma.schedule.findFirstOrThrow({ where: { id: req.params.id, churchId: currentChurch.id } });
    const input = z.object({ startsAt: z.coerce.date() }).parse(req.body);
    if (input.startsAt < schedule.periodStart || input.startsAt > schedule.periodEnd) return res.status(400).json({ message: "A data deve estar dentro do mês da escala." });
    const eventTypes = await prisma.eventType.findMany({ where: { churchId: currentChurch.id, active: true }, include: { stations: true } });
    const supperType = eventTypes.find(eventType => eventType.code === "SANTA_CEIA");
    if (!supperType) throw new Error("Tipo de culto Santa Ceia não encontrado.");
    const supper = await prisma.event.findFirstOrThrow({ where: { churchId: currentChurch.id, eventTypeId: supperType.id, startsAt: { gte: schedule.periodStart, lte: schedule.periodEnd } } });
    const oldDate = dateKey(supper.startsAt);
    const newDate = dateKey(input.startsAt);
    const dayRange = (day: string) => ({ gte: new Date(`${day}T00:00:00-03:00`), lt: new Date(new Date(`${day}T00:00:00-03:00`).getTime() + 24 * 60 * 60 * 1000) });
    const [regularOnTarget, regularOnSource] = await Promise.all([
      prisma.event.findFirst({ where: { churchId: currentChurch.id, id: { not: supper.id }, eventTypeId: { not: supperType.id }, startsAt: dayRange(newDate) } }),
      prisma.event.findFirst({ where: { churchId: currentChurch.id, id: { not: supper.id }, eventTypeId: { not: supperType.id }, startsAt: dayRange(oldDate) } })
    ]);
    const sourceType = eventTypes.find(eventType => eventType.id === supper.replacedEventTypeId)
      ?? eventTypes.find(eventType => eventType.code !== "SANTA_CEIA" && eventType.weekday === weekdayAtChurch(supper.startsAt));
    const targetType = eventTypes.find(eventType => eventType.id === regularOnTarget?.eventTypeId)
      ?? eventTypes.find(eventType => eventType.code !== "SANTA_CEIA" && eventType.weekday === weekdayAtChurch(input.startsAt));
    await prisma.$transaction(async tx => {
      if (regularOnTarget) await tx.event.delete({ where: { id: regularOnTarget.id } });
      await tx.event.update({ where: { id: supper.id }, data: { startsAt: input.startsAt, title: supperType.name, visibleInSchedule: true, replacedEventTypeId: targetType?.id ?? null } });
      if (oldDate !== newDate && sourceType && !regularOnSource) {
        const restored = await tx.event.create({ data: { churchId: currentChurch.id, eventTypeId: sourceType.id, title: sourceType.name, startsAt: new Date(`${oldDate}T${sourceType.defaultTime ?? "18:00"}:00-03:00`), visibleInSchedule: true } });
        await tx.eventRequirement.createMany({ data: sourceType.stations.filter(position => position.enabled).map(position => ({ eventId: restored.id, stationId: position.stationId, quantity: position.quantity, required: true })) });
      }
    });
    res.json(await prisma.event.findUniqueOrThrow({ where: { id: supper.id }, include: { eventType: true, requirements: { include: { station: true }, orderBy: { station: { sortOrder: "asc" } } } } }));
  } catch (error) { next(error); }
});

app.post("/api/schedules/:id/regenerate", async (req, res, next) => {
  try {
    const currentChurch = await church();
    const schedule = await prisma.schedule.findFirstOrThrow({ where: { id: req.params.id, churchId: currentChurch.id }, include: scheduleInclude });
    const workers = await prisma.worker.findMany({ where: { churchId: currentChurch.id, active: true }, include: { role: true, availability: true } });
    const events = await prisma.event.findMany({
      where: { churchId: currentChurch.id, startsAt: { gte: schedule.periodStart, lte: schedule.periodEnd }, canceled: false, visibleInSchedule: true },
      include: { eventType: true, requirements: { include: { station: true }, orderBy: { station: { sortOrder: "asc" } } } },
      orderBy: { startsAt: "asc" }
    });
    const counts = new Map<string, number>();
    schedule.assignments.forEach(item => counts.set(item.workerId, (counts.get(item.workerId) ?? 0) + 1));
    const nextAssignments: Array<{ scheduleId: string; eventId: string; stationId: string; workerId: string; origin: string; status: "PENDING"; notes: string | null }> = [];
    for (const event of events) {
      const selectedWorkers = new Set<string>();
      for (const requirement of event.requirements) {
        const currentSlots = schedule.assignments.filter(item => item.eventId === event.id && item.stationId === requirement.stationId);
        for (let slot = 0; slot < requirement.quantity; slot += 1) {
          const currentWorkerId = currentSlots[slot]?.workerId;
          const eligibleWorkers = workers.filter(worker => {
            const allowedRole = event.eventType.code !== "SANTA_CEIA" || worker.role.name === "Auxiliar";
            return allowedRole && isWorkerAvailable(worker, event.startsAt) && !selectedWorkers.has(worker.id);
          }).sort((a, b) => (counts.get(a.id) ?? 0) - (counts.get(b.id) ?? 0) || a.displayName.localeCompare(b.displayName));
          const selected = eligibleWorkers.find(worker => worker.id !== currentWorkerId) ?? eligibleWorkers[0];
          if (!selected) throw new Error(`Nenhum obreiro elegível para o posto ${requirement.station.name} em ${event.title}.`);
          selectedWorkers.add(selected.id);
          counts.set(selected.id, (counts.get(selected.id) ?? 0) + 1);
          nextAssignments.push({ scheduleId: schedule.id, eventId: event.id, stationId: requirement.stationId, workerId: selected.id, origin: "AUTOMATIC", status: "PENDING", notes: null });
        }
      }
    }
    await prisma.$transaction(async tx => {
      await tx.assignment.deleteMany({ where: { scheduleId: schedule.id } });
      await tx.assignment.createMany({ data: nextAssignments });
    });
    const regeneratedSchedule = await prisma.schedule.findUniqueOrThrow({ where: { id: schedule.id }, include: scheduleInclude });
    const allEvents = await prisma.event.findMany({ where: { churchId: currentChurch.id, startsAt: { gte: schedule.periodStart, lte: schedule.periodEnd }, canceled: false }, include: { eventType: true, requirements: { include: { station: true }, orderBy: { station: { sortOrder: "asc" } } } }, orderBy: { startsAt: "asc" } });
    res.json({ schedule: regeneratedSchedule, events: allEvents });
  } catch (error) { next(error); }
});

app.get("/api/rules", async (_req, res, next) => {
  try {
    const currentChurch = await church();
    res.json(await prisma.distributionRule.findMany({ where: { churchId: currentChurch.id }, orderBy: [{ priority: "desc" }, { name: "asc" }] }));
  } catch (error) { next(error); }
});

const ruleInput = z.object({
  name: z.string().min(3).max(100),
  description: z.string().max(500).optional(),
  type: z.nativeEnum(RuleType),
  severity: z.nativeEnum(RuleSeverity),
  priority: z.number().int().min(1).max(100).default(50),
  scope: z.record(z.string(), z.unknown()),
  parameters: z.record(z.string(), z.unknown()),
  violationMessage: z.string().min(3).max(200)
});

app.post("/api/rules", async (req, res, next) => {
  try {
    const currentChurch = await church();
    const input = ruleInput.parse(req.body);
    res.status(201).json(await prisma.distributionRule.create({ data: {
      churchId: currentChurch.id,
      ...input,
      scope: input.scope as Prisma.InputJsonValue,
      parameters: input.parameters as Prisma.InputJsonValue
    } }));
  } catch (error) { next(error); }
});

app.patch("/api/rules/:id/toggle", async (req, res, next) => {
  try {
    const currentChurch = await church();
    const existing = await prisma.distributionRule.findFirstOrThrow({ where: { id: req.params.id, churchId: currentChurch.id } });
    res.json(await prisma.distributionRule.update({ where: { id: existing.id }, data: { active: !existing.active } }));
  } catch (error) { next(error); }
});

app.post("/api/schedules/:id/publish", async (req, res, next) => {
  try {
    const currentChurch = await church();
    const schedule = await prisma.schedule.findFirstOrThrow({ where: { id: req.params.id, churchId: currentChurch.id } });
    const openRequirements = await prisma.eventRequirement.count({ where: { event: { visibleInSchedule: true, assignments: { none: { scheduleId: schedule.id } } }, required: true } });
    if (openRequirements > 0) return res.status(409).json({ message: "Existem postos obrigatórios sem preenchimento.", openRequirements });
    res.json(await prisma.schedule.update({ where: { id: schedule.id }, data: { status: ScheduleStatus.PUBLISHED, publishedAt: new Date(), version: { increment: 1 } } }));
  } catch (error) { next(error); }
});

app.get("/api/public/:token", async (req, res, next) => {
  try {
    res.json(await prisma.schedule.findFirstOrThrow({ where: { publicToken: req.params.token, status: ScheduleStatus.PUBLISHED }, include: { church: true, assignments: { where: { event: { visibleInSchedule: true } }, include: { event: { include: { eventType: true } }, station: true, worker: { include: { role: true } } } } } }));
  } catch (error) { next(error); }
});

app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(error);
  if (error instanceof z.ZodError) return res.status(400).json({ message: "Dados inválidos", issues: error.issues });
  res.status(500).json({ message: "Não foi possível concluir a operação." });
});

const port = Number(process.env.PORT ?? 3000);
app.listen(port, () => console.log(`API disponível na porta ${port}`));
