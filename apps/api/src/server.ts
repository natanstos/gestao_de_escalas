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

app.get("/api/health", (_req, res) => res.json({ status: "ok", service: "gestao-de-escalas" }));

app.get("/api/dashboard", async (_req, res, next) => {
  try {
    const currentChurch = await church();
    const [workers, rules, schedule] = await Promise.all([
      prisma.worker.count({ where: { churchId: currentChurch.id, active: true } }),
      prisma.distributionRule.count({ where: { churchId: currentChurch.id, active: true } }),
      prisma.schedule.findFirst({ where: { churchId: currentChurch.id }, orderBy: { periodStart: "desc" }, include: { assignments: { include: { event: { include: { eventType: true } }, station: true, worker: { include: { role: true } } } } } })
    ]);
    const events = schedule ? [...new Map(schedule.assignments.map((a) => [a.eventId, a.event])).values()] : [];
    res.json({ church: currentChurch, workers, rules, schedule, events });
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
