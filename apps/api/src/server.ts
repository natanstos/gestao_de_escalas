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

app.get("/api/health", (_req, res) => res.json({ status: "ok", service: "gestao-de-escalas" }));

app.get("/api/dashboard", async (_req, res, next) => {
  try {
    const currentChurch = await church();
    const [workers, rules, schedule] = await Promise.all([
      prisma.worker.count({ where: { churchId: currentChurch.id, active: true } }),
      prisma.distributionRule.count({ where: { churchId: currentChurch.id, active: true } }),
      prisma.schedule.findFirst({ where: { churchId: currentChurch.id }, orderBy: { periodStart: "desc" }, include: scheduleInclude })
    ]);
    const events = schedule ? [...new Map(schedule.assignments.map((a) => [a.eventId, a.event])).values()] : [];
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

const workerInput = z.object({ displayName: z.string().min(2).max(100), roleName: z.string().min(2).max(50), phone: z.string().max(30).optional().default(""), active: z.boolean().optional().default(true) });

app.post("/api/workers", async (req, res, next) => {
  try {
    const currentChurch = await church();
    const input = workerInput.parse(req.body);
    const role = await prisma.ministryRole.findFirstOrThrow({ where: { churchId: currentChurch.id, name: input.roleName } });
    const worker = await prisma.worker.create({ data: { churchId: currentChurch.id, roleId: role.id, fullName: input.displayName, displayName: input.displayName, phone: input.phone, active: input.active }, include: { role: true, _count: { select: { assignments: true } } } });
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
    res.json(await prisma.worker.update({ where: { id: existing.id }, data: { displayName: input.displayName, fullName: input.displayName, phone: input.phone, active: input.active, roleId: role?.id }, include: { role: true, _count: { select: { assignments: true } } } }));
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

app.post("/api/schedules/:id/regenerate", async (req, res, next) => {
  try {
    const currentChurch = await church();
    const schedule = await prisma.schedule.findFirstOrThrow({ where: { id: req.params.id, churchId: currentChurch.id }, include: scheduleInclude });
    const workers = await prisma.worker.findMany({ where: { churchId: currentChurch.id, active: true }, include: { role: true, availability: true } });
    const counts = new Map<string, number>();
    schedule.assignments.forEach(item => counts.set(item.workerId, (counts.get(item.workerId) ?? 0) + 1));
    const updates: Array<{ id: string; workerId: string }> = [];
    for (const assignment of schedule.assignments) {
      const candidates = workers.filter(worker => {
        const unavailable = worker.availability.some(item => item.kind === "indisponivel" && item.startsAt <= assignment.event.startsAt && item.endsAt >= assignment.event.startsAt);
        const allowedRole = assignment.event.eventType.code !== "SANTA_CEIA" || worker.role.name === "Auxiliar";
        return worker.id !== assignment.workerId && !unavailable && allowedRole && !updates.some(item => item.workerId === worker.id && schedule.assignments.find(a => a.id === item.id)?.eventId === assignment.eventId);
      }).sort((a, b) => (counts.get(a.id) ?? 0) - (counts.get(b.id) ?? 0) || a.displayName.localeCompare(b.displayName));
      const selected = candidates[0];
      if (selected) { updates.push({ id: assignment.id, workerId: selected.id }); counts.set(selected.id, (counts.get(selected.id) ?? 0) + 1); }
    }
    await prisma.$transaction(updates.map(update => prisma.assignment.update({ where: { id: update.id }, data: { workerId: update.workerId, status: "PENDING", origin: "AUTOMATIC" } })));
    res.json(await prisma.schedule.findUniqueOrThrow({ where: { id: schedule.id }, include: scheduleInclude }));
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
    const openRequirements = await prisma.eventRequirement.count({ where: { event: { assignments: { none: { scheduleId: schedule.id } } }, required: true } });
    if (openRequirements > 0) return res.status(409).json({ message: "Existem postos obrigatórios sem preenchimento.", openRequirements });
    res.json(await prisma.schedule.update({ where: { id: schedule.id }, data: { status: ScheduleStatus.PUBLISHED, publishedAt: new Date(), version: { increment: 1 } } }));
  } catch (error) { next(error); }
});

app.get("/api/public/:token", async (req, res, next) => {
  try {
    res.json(await prisma.schedule.findFirstOrThrow({ where: { publicToken: req.params.token, status: ScheduleStatus.PUBLISHED }, include: { church: true, assignments: { include: { event: { include: { eventType: true } }, station: true, worker: { include: { role: true } } } } } }));
  } catch (error) { next(error); }
});

app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(error);
  if (error instanceof z.ZodError) return res.status(400).json({ message: "Dados inválidos", issues: error.issues });
  res.status(500).json({ message: "Não foi possível concluir a operação." });
});

const port = Number(process.env.PORT ?? 3000);
app.listen(port, () => console.log(`API disponível na porta ${port}`));
