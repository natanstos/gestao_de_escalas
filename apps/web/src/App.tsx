import { useEffect, useRef, useState } from "react";
import { toBlob } from "html-to-image";
import {
  AlertTriangle,
  Building2,
  CalendarDays,
  Check,
  ChevronRight,
  ClipboardList,
  Download,
  FileText,
  History,
  LayoutDashboard,
  Lock,
  LockOpen,
  Menu,
  MessageCircle,
  Plus,
  RefreshCw,
  Save,
  Scale,
  Search,
  Settings,
  Share2,
  ShieldCheck,
  Sparkles,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import { initialRules, services, type Service } from "./data";

type View =
  | "dashboard"
  | "schedule"
  | "rules"
  | "workers"
  | "substitutions"
  | "settings";
const nav = [
  { id: "dashboard" as View, label: "Visão geral", icon: LayoutDashboard },
  { id: "schedule" as View, label: "Escalas", icon: CalendarDays },
  { id: "rules" as View, label: "Regras", icon: ShieldCheck },
];
type AvailabilityMode = "ALL" | "WEEKDAYS" | "DATES";
type WorkerPosition = {
  stationId: string;
  name: string;
  enabled: boolean;
  preferred: boolean;
};
type WorkerItem = {
  id: number | string;
  name: string;
  role: string;
  phone: string;
  active: boolean;
  assignments: number;
  availabilityMode: AvailabilityMode;
  availableWeekdays: number[];
  availableDates: string[];
  preferredWeekdays: number[];
  preferredDates: string[];
  temporarilyUnavailable: boolean;
  positions: WorkerPosition[];
};
const initialWorkers: WorkerItem[] = [
  {
    id: 1,
    name: "Alexandre (Gelo)",
    role: "Auxiliar",
    phone: "(61) 99911-2040",
    active: true,
    assignments: 3,
    availabilityMode: "ALL",
    availableWeekdays: [],
    availableDates: [],
    preferredWeekdays: [],
    preferredDates: [],
    temporarilyUnavailable: false,
    positions: [],
  },
];
const titles: Record<View, string> = {
  dashboard: "Olá, Natanael",
  schedule: "Escala mensal",
  rules: "Regras de distribuição",
  workers: "Obreiros",
  substitutions: "Substituições",
  settings: "Configurações",
};
const currentMonthKey = () =>
  new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    timeZone: "America/Sao_Paulo",
  }).format(new Date());
const monthLabelFromKey = (month: string) => {
  const [year, number] = month.split("-").map(Number);
  return new Intl.DateTimeFormat("pt-BR", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, number - 1, 1)));
};
const shiftMonth = (month: string, amount: number) => {
  const [year, number] = month.split("-").map(Number);
  const date = new Date(Date.UTC(year, number - 1 + amount, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
};

type ApiAssignment = {
  id: string;
  eventId: string;
  stationId: string;
  locked: boolean;
  event: {
    id: string;
    title: string;
    startsAt: string;
    eventType: { code: string; color: string };
  };
  station: { id: string; name: string; sortOrder: number };
  workerId: string;
  worker: { displayName: string };
  status: string;
};
type ApiEvent = {
  id: string;
  title: string;
  startsAt: string;
  visibleInSchedule: boolean;
  eventType: { code: string; color: string };
  requirements: Array<{
    quantity: number;
    station: { id: string; name: string; sortOrder: number };
  }>;
};
type ApiWorker = {
  id: string;
  displayName: string;
  phone?: string | null;
  active: boolean;
  availabilityMode: AvailabilityMode;
  availableWeekdays: number[];
  availableDates: string[];
  preferredWeekdays: number[];
  preferredDates: string[];
  temporarilyUnavailable: boolean;
  role: { name: string };
  _count: { assignments: number };
  skills?: Array<{
    stationId: string;
    enabled: boolean;
    preference: number;
    station: { name: string };
  }>;
};
type StationItem = {
  id: string;
  name: string;
  defaultQuantity: number;
  active: boolean;
  sortOrder: number;
};
type EventTypeItem = {
  id: string;
  name: string;
  code: string;
  weekday?: number | null;
  defaultTime?: string | null;
  stations: Array<{
    stationId: string;
    quantity: number;
    enabled: boolean;
    station: StationItem;
  }>;
};
const mapWorker = (worker: ApiWorker): WorkerItem => ({
  id: worker.id,
  name: worker.displayName,
  role: worker.role.name,
  phone: worker.phone ?? "",
  active: worker.active,
  assignments: worker._count.assignments,
  availabilityMode: worker.availabilityMode,
  availableWeekdays: worker.availableWeekdays ?? [],
  availableDates: (worker.availableDates ?? []).map((date) => date.slice(0, 10)),
  preferredWeekdays: worker.preferredWeekdays ?? [],
  preferredDates: (worker.preferredDates ?? []).map((date) => date.slice(0, 10)),
  temporarilyUnavailable: worker.temporarilyUnavailable,
  positions: (worker.skills ?? []).map((skill) => ({
    stationId: skill.stationId,
    name: skill.station.name,
    enabled: skill.enabled,
    preferred: skill.preference > 0,
  })),
});
const mapSchedule = (
  events: ApiEvent[],
  assignments: ApiAssignment[],
): Service[] => {
  const assignmentsByEvent = new Map<string, ApiAssignment[]>();
  assignments.forEach((item) =>
    assignmentsByEvent.set(item.eventId, [
      ...(assignmentsByEvent.get(item.eventId) ?? []),
      item,
    ]),
  );
  return events
    .map((event) => {
      const items = assignmentsByEvent.get(event.id) ?? [];
      const startsAt = new Date(event.startsAt);
      return {
        id: event.id,
        title: event.title,
        isoDate: event.startsAt,
        weekday: new Intl.DateTimeFormat("pt-BR", {
          weekday: "short",
          timeZone: "America/Sao_Paulo",
        })
          .format(startsAt)
          .slice(0, 3)
          .toUpperCase(),
        date: new Intl.DateTimeFormat("pt-BR", {
          day: "2-digit",
          month: "short",
          timeZone: "America/Sao_Paulo",
        })
          .format(startsAt)
          .replace(" de ", " ")
          .replace(".", "")
          .toUpperCase(),
        time: new Intl.DateTimeFormat("pt-BR", {
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
          timeZone: "America/Sao_Paulo",
        }).format(startsAt),
        color:
          event.eventType.code === "SANTA_CEIA"
            ? "purple"
            : event.eventType.code === "TERCA"
              ? "teal"
              : "gold",
        eventCode: event.eventType.code,
        visible: event.visibleInSchedule,
        assignments: event.requirements.map((requirement) => {
          const group = items.filter(
            (item) => item.stationId === requirement.station.id,
          );
          return {
            station: requirement.station.name,
            names: group.map((item) => item.worker.displayName),
            slots: group.map((item) => ({
              id: item.id,
              workerId: item.workerId,
              name: item.worker.displayName,
              locked: item.locked,
            })),
            status: (group.length < requirement.quantity
              ? "open"
              : group.some((item) => item.status === "PENDING")
                ? "pending"
                : "confirmed") as "open" | "pending" | "confirmed",
          };
        }),
      };
    })
    .sort(
      (a, b) => new Date(a.isoDate!).getTime() - new Date(b.isoDate!).getTime(),
    );
};

export default function App() {
  const [view, setView] = useState<View>("dashboard");
  const [rules, setRules] = useState(initialRules);
  const [mobileMenu, setMobileMenu] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [notice, setNotice] = useState("");
  const [workers, setWorkers] = useState(initialWorkers);
  const [scheduleServices, setScheduleServices] = useState(services);
  const [scheduleId, setScheduleId] = useState<string | null>(null);
  const [selectedMonth, setSelectedMonth] = useState(currentMonthKey);
  const [monthLoading, setMonthLoading] = useState(false);
  const [churchSettings, setChurchSettings] = useState({
    name: "Igreja de Brasília",
    timezone: "America/Sao_Paulo",
  });
  const [stations, setStations] = useState<StationItem[]>([]);
  const [eventTypes, setEventTypes] = useState<EventTypeItem[]>([]);
  const shareRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/workers")
      .then(async (response) => {
        if (!response.ok) throw new Error();
        setWorkers((await response.json()).map(mapWorker));
      })
      .catch(() => announce("Não foi possível carregar os obreiros."));
    fetch("/api/stations")
      .then(async (response) => {
        if (!response.ok) throw new Error();
        setStations(await response.json());
      })
      .catch(() => announce("Não foi possível carregar as posições."));
    fetch("/api/event-types")
      .then(async (response) => {
        if (!response.ok) throw new Error();
        setEventTypes(await response.json());
      })
      .catch(() => announce("Não foi possível carregar os tipos de culto."));
    void openMonth(currentMonthKey(), false);
  }, []);

  async function openMonth(month: string, notify = true) {
    setMonthLoading(true);
    try {
      const response = await fetch("/api/schedules/month", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ month }),
      });
      const dashboard = await response.json();
      if (!response.ok || !dashboard.schedule)
        throw new Error(dashboard.message);
      let assignments = dashboard.schedule.assignments ?? [];
      let events = dashboard.events ?? [];
      let generationWarning = "";
      if (dashboard.created || assignments.length === 0) {
        const generation = await fetch(
          `/api/schedules/${dashboard.schedule.id}/regenerate`,
          { method: "POST" },
        );
        const generated = await generation.json();
        if (generation.ok) {
          assignments = generated.schedule.assignments;
          events = generated.events;
        } else {
          generationWarning = generated.message ?? "O mês foi criado, mas precisa ser gerado manualmente.";
        }
      }
      setChurchSettings({
        name: dashboard.church.name,
        timezone: dashboard.church.timezone,
      });
      setScheduleId(dashboard.schedule.id);
      setScheduleServices(mapSchedule(events, assignments));
      setSelectedMonth(month);
      if (generationWarning) announce(generationWarning);
      else if (notify)
        announce(
          dashboard.created
            ? `Escala de ${monthLabelFromKey(month)} criada.`
            : `Escala de ${monthLabelFromKey(month)} carregada.`,
        );
    } catch (error) {
      announce(
        error instanceof Error && error.message
          ? error.message
          : "Não foi possível abrir este mês.",
      );
    } finally {
      setMonthLoading(false);
    }
  }

  const navigate = (target: View) => {
    setView(target);
    setMobileMenu(false);
  };
  const announce = (message: string) => {
    setNotice(message);
    window.setTimeout(() => setNotice(""), 2600);
  };

  async function shareImage() {
    if (!shareRef.current) return;
    const blob = await toBlob(shareRef.current, {
      pixelRatio: 2,
      backgroundColor: "#f8f5ed",
    });
    if (!blob) return;
    const label = monthLabelFromKey(selectedMonth);
    const file = new File([blob], `escala-${selectedMonth}.png`, {
      type: "image/png",
    });
    if (navigator.canShare?.({ files: [file] }))
      await navigator.share({
        title: `Escala de ${label}`,
        text: `Escala de Obreiros — ${label}`,
        files: [file],
      });
    else {
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = file.name;
      link.click();
      URL.revokeObjectURL(url);
      announce("Imagem baixada com sucesso.");
    }
  }

  return (
    <div className="app-shell">
      <aside className={mobileMenu ? "sidebar open" : "sidebar"}>
        <div className="brand">
          <div className="brand-mark">
            <ClipboardList size={22} />
          </div>
          <div>
            <strong>EscalaFácil</strong>
            <small>Igreja de Brasília</small>
          </div>
          <button
            className="close-menu"
            onClick={() => setMobileMenu(false)}
            aria-label="Fechar menu"
          >
            <X />
          </button>
        </div>
        <nav>
          {nav.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              className={view === id ? "nav-item active" : "nav-item"}
              onClick={() => navigate(id)}
            >
              <Icon size={19} />
              <span>{label}</span>
            </button>
          ))}
          <button
            className={view === "workers" ? "nav-item active" : "nav-item"}
            onClick={() => navigate("workers")}
          >
            <Users size={19} />
            <span>Obreiros</span>
          </button>
          <button
            className={
              view === "substitutions" ? "nav-item active" : "nav-item"
            }
            onClick={() => navigate("substitutions")}
          >
            <RefreshCw size={19} />
            <span>Substituições</span>
          </button>
        </nav>
        <div className="sidebar-bottom">
          <button
            className={view === "settings" ? "nav-item active" : "nav-item"}
            onClick={() => navigate("settings")}
          >
            <Settings size={19} />
            <span>Configurações</span>
          </button>
          <div className="profile">
            <div className="avatar">NS</div>
            <div>
              <strong>Natanael</strong>
              <small>Administrador</small>
            </div>
          </div>
        </div>
      </aside>
      {mobileMenu && (
        <button
          className="scrim"
          onClick={() => setMobileMenu(false)}
          aria-label="Fechar menu"
        />
      )}

      <main>
        <header className="topbar">
          <button
            className="menu-button"
            onClick={() => setMobileMenu(true)}
            aria-label="Abrir menu"
          >
            <Menu />
          </button>
          <div>
            <span className="eyebrow">IGREJA DE BRASÍLIA</span>
            <h1>{titles[view]}</h1>
          </div>
          <button
            className="primary desktop-action"
            onClick={() => setShareOpen(true)}
          >
            <Share2 size={18} /> Compartilhar
          </button>
        </header>
        {view === "dashboard" && (
          <Dashboard
            month={selectedMonth}
            services={scheduleServices.filter(
              (service) => service.visible !== false,
            )}
            onNavigate={navigate}
            onShare={() => setShareOpen(true)}
          />
        )}
        {view === "schedule" && (
          <SchedulePage
            scheduleId={scheduleId}
            selectedMonth={selectedMonth}
            monthLoading={monthLoading}
            onMonthChange={openMonth}
            services={scheduleServices}
            setServices={setScheduleServices}
            workers={workers}
            onShare={() => setShareOpen(true)}
            announce={announce}
          />
        )}
        {view === "rules" && (
          <RulesPage rules={rules} setRules={setRules} announce={announce} />
        )}
        {view === "workers" && (
          <WorkersPage
            workers={workers}
            setWorkers={setWorkers}
            stations={stations}
            announce={announce}
          />
        )}
        {view === "substitutions" && <SubstitutionsPage announce={announce} />}
        {view === "settings" && (
          <SettingsPage
            settings={churchSettings}
            setSettings={setChurchSettings}
            scheduleId={scheduleId}
            selectedMonth={selectedMonth}
            services={scheduleServices}
            setServices={setScheduleServices}
            stations={stations}
            setStations={setStations}
            eventTypes={eventTypes}
            setEventTypes={setEventTypes}
            announce={announce}
          />
        )}
      </main>

      <nav className="bottom-nav">
        {nav.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            className={view === id ? "active" : ""}
            onClick={() => navigate(id)}
          >
            <Icon />
            <span>{label}</span>
          </button>
        ))}
        <button onClick={() => setShareOpen(true)}>
          <Share2 />
          <span>Compartilhar</span>
        </button>
      </nav>
      {shareOpen && (
        <ShareModal
          services={scheduleServices.filter(
            (service) => service.visible !== false,
          )}
          selectedMonth={selectedMonth}
          shareRef={shareRef}
          onClose={() => setShareOpen(false)}
          onShare={shareImage}
          announce={announce}
        />
      )}
      {notice && (
        <div className="toast">
          <Check size={18} />
          {notice}
        </div>
      )}
    </div>
  );
}

function Dashboard({
  month,
  services,
  onNavigate,
  onShare,
}: {
  month: string;
  services: Service[];
  onNavigate: (v: View) => void;
  onShare: () => void;
}) {
  return (
    <div className="page">
      <section className="hero">
        <div>
          <span className="pill">
            <Sparkles size={15} /> Escala em revisão
          </span>
          <h2>Organize o mês com tranquilidade.</h2>
          <p>
            A escala de {monthLabelFromKey(month)} está disponível para revisão
            e compartilhamento.
          </p>
          <div className="hero-actions">
            <button className="primary" onClick={() => onNavigate("schedule")}>
              Revisar escala <ChevronRight size={18} />
            </button>
            <button className="ghost" onClick={onShare}>
              <Share2 size={18} /> Prévia
            </button>
          </div>
        </div>
        <div className="progress-ring">
          <strong>92%</strong>
          <span>preenchida</span>
        </div>
      </section>
      <section className="stats">
        <article>
          <div className="stat-icon blue">
            <Users />
          </div>
          <div>
            <strong>28</strong>
            <span>Obreiros ativos</span>
          </div>
          <small>+2 este mês</small>
        </article>
        <article>
          <div className="stat-icon green">
            <Check />
          </div>
          <div>
            <strong>19</strong>
            <span>Confirmações</span>
          </div>
          <small>76% respondidas</small>
        </article>
        <article>
          <div className="stat-icon amber">
            <AlertTriangle />
          </div>
          <div>
            <strong>4</strong>
            <span>Pendências</span>
          </div>
          <small>Requer atenção</small>
        </article>
        <article>
          <div className="stat-icon purple">
            <Scale />
          </div>
          <div>
            <strong>4</strong>
            <span>Regras ativas</span>
          </div>
          <small>Todas validadas</small>
        </article>
      </section>
      <div className="content-grid">
        <section className="panel">
          <div className="panel-head">
            <div>
              <span className="eyebrow">PRÓXIMOS CULTOS</span>
              <h3>Agenda da escala</h3>
            </div>
            <button
              className="text-button"
              onClick={() => onNavigate("schedule")}
            >
              Ver todos <ChevronRight size={16} />
            </button>
          </div>
          <div className="event-list">
            {services.map((service) => (
              <ServiceRow key={service.id} service={service} />
            ))}
          </div>
        </section>
        <aside className="panel attention">
          <div className="panel-head">
            <div>
              <span className="eyebrow">ATENÇÃO</span>
              <h3>Antes de publicar</h3>
            </div>
          </div>
          <ul>
            <li>
              <span className="alert-dot red" />
              <div>
                <strong>Revise as posições</strong>
                <small>{monthLabelFromKey(month)}</small>
              </div>
              <ChevronRight />
            </li>
            <li>
              <span className="alert-dot amber" />
              <div>
                <strong>3 confirmações pendentes</strong>
                <small>Lembre os obreiros</small>
              </div>
              <ChevronRight />
            </li>
            <li>
              <span className="alert-dot green" />
              <div>
                <strong>Regras atendidas</strong>
                <small>Distribuição equilibrada</small>
              </div>
              <Check />
            </li>
          </ul>
          <button
            className="secondary full"
            onClick={() => onNavigate("schedule")}
          >
            Resolver pendências
          </button>
        </aside>
      </div>
    </div>
  );
}

function ServiceRow({ service }: { service: Service }) {
  const filled = service.assignments.reduce(
    (sum, a) => sum + a.names.length,
    0,
  );
  return (
    <article className="event-row">
      <div className={`date-card ${service.color}`}>
        <strong>{service.date.split(" ")[0]}</strong>
        <span>{service.date.split(" ")[1]}</span>
      </div>
      <div className="event-copy">
        <strong>{service.title}</strong>
        <span>
          {service.weekday === "DOM"
            ? "Domingo"
            : service.weekday === "TER"
              ? "Terça-feira"
              : "Sexta-feira"}{" "}
          · {service.time}
        </span>
      </div>
      <div className="mini-avatars">
        {service.assignments
          .flatMap((a) => a.names)
          .slice(0, 4)
          .map((name, i) => (
            <span key={name}>
              {name
                .split(" ")
                .map((p) => p[0])
                .slice(0, 2)
                .join("")}
            </span>
          ))}
        <small>+{Math.max(0, filled - 4)}</small>
      </div>
      <span
        className={
          service.assignments.some((a) => a.status === "open")
            ? "status warning"
            : "status success"
        }
      >
        {service.assignments.some((a) => a.status === "open")
          ? "1 vaga"
          : "Completo"}
      </span>
      <ChevronRight className="row-arrow" />
    </article>
  );
}

function SchedulePage({
  scheduleId,
  selectedMonth,
  monthLoading,
  onMonthChange,
  services,
  setServices,
  workers,
  onShare,
  announce,
}: {
  scheduleId: string | null;
  selectedMonth: string;
  monthLoading: boolean;
  onMonthChange: (month: string) => Promise<void>;
  services: Service[];
  setServices: React.Dispatch<React.SetStateAction<Service[]>>;
  workers: WorkerItem[];
  onShare: () => void;
  announce: (m: string) => void;
}) {
  const [editing, setEditing] = useState<Service | null>(null);
  const [editingAssignment, setEditingAssignment] = useState<{
    serviceId: string | number;
    assignmentId: string;
    workerId: string;
    station: string;
    currentName: string;
  } | null>(null);
  const [confirmGenerate, setConfirmGenerate] = useState(false);
  const [validation, setValidation] = useState<{
    valid: boolean;
    summary: { errors: number; warnings: number; locked: number };
    issues: Array<{ severity: string; title: string; detail: string }>;
  } | null>(null);
  const [revisions, setRevisions] = useState<
    Array<{ id: string; version: number; reason: string; createdAt: string }>
  >([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [daySelectorOpen, setDaySelectorOpen] = useState(false);
  const [selectedEventIds, setSelectedEventIds] = useState<
    Array<string | number>
  >([]);
  const visibleServices = services.filter(
    (service) => service.visible !== false,
  );
  const openDaySelector = () => {
    setSelectedEventIds(
      services
        .filter((service) => service.visible !== false)
        .map((service) => service.id),
    );
    setDaySelectorOpen(true);
  };
  const saveVisibleDays = async () => {
    if (!scheduleId) return;
    try {
      const response = await fetch(
        `/api/schedules/${scheduleId}/visible-events`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ eventIds: selectedEventIds.map(String) }),
        },
      );
      if (!response.ok) throw new Error();
      setServices((current) =>
        current.map((service) => ({
          ...service,
          visible: selectedEventIds.includes(service.id),
        })),
      );
      setDaySelectorOpen(false);
      announce(
        "Dias exibidos na escala foram atualizados. Gere novamente para redistribuir os obreiros.",
      );
    } catch {
      announce("Não foi possível salvar os dias da escala.");
    }
  };
  const regenerate = async () => {
    if (!scheduleId)
      return announce("A escala ainda não foi carregada do servidor.");
    try {
      const response = await fetch(`/api/schedules/${scheduleId}/regenerate`, {
        method: "POST",
      });
      const result = await response.json();
      if (!response.ok)
        throw new Error(result.message ?? "Não foi possível gerar a escala.");
      setServices(mapSchedule(result.events, result.schedule.assignments));
      setConfirmGenerate(false);
      announce("Nova sugestão salva no banco. Revise antes de publicar.");
    } catch (error) {
      announce(
        error instanceof Error
          ? error.message
          : "Não foi possível gerar a escala. Tente novamente.",
      );
    }
  };
  const reviewBeforeGenerate = async () => {
    if (!scheduleId) return announce("A escala ainda não foi carregada.");
    try {
      const response = await fetch(`/api/schedules/${scheduleId}/validate`);
      if (!response.ok) throw new Error();
      setValidation(await response.json());
      setConfirmGenerate(true);
    } catch {
      announce("Não foi possível validar a escala.");
    }
  };
  const openHistory = async () => {
    if (!scheduleId) return;
    try {
      const response = await fetch(`/api/schedules/${scheduleId}/revisions`);
      if (!response.ok) throw new Error();
      setRevisions(await response.json());
      setHistoryOpen(true);
    } catch {
      announce("Não foi possível carregar as versões.");
    }
  };
  const restoreRevision = async (revisionId: string) => {
    if (!scheduleId) return;
    try {
      const response = await fetch(
        `/api/schedules/${scheduleId}/revisions/${revisionId}/restore`,
        { method: "POST" },
      );
      if (!response.ok) throw new Error();
      const restored = await response.json();
      const dashboard = await (
        await fetch(`/api/dashboard?month=${selectedMonth}`)
      ).json();
      setServices(mapSchedule(dashboard.events, restored.assignments));
      setHistoryOpen(false);
      announce("Versão restaurada. O estado anterior também foi guardado.");
    } catch {
      announce("Não foi possível restaurar esta versão.");
    }
  };
  const toggleLock = async (
    serviceId: string | number,
    assignmentId: string,
    locked: boolean,
  ) => {
    try {
      const response = await fetch(`/api/assignments/${assignmentId}/lock`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locked }),
      });
      if (!response.ok) throw new Error();
      setServices((current) =>
        current.map((service) =>
          service.id !== serviceId
            ? service
            : {
                ...service,
                assignments: service.assignments.map((item) => ({
                  ...item,
                  slots: item.slots?.map((slot) =>
                    slot.id === assignmentId ? { ...slot, locked } : slot,
                  ),
                })),
              },
        ),
      );
      announce(
        locked
          ? "Alocação protegida."
          : "Alocação liberada para a próxima geração.",
      );
    } catch {
      announce("Não foi possível alterar a proteção.");
    }
  };
  const saveAssignment = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editingAssignment) return;
    const workerId = String(new FormData(event.currentTarget).get("workerId"));
    try {
      const response = await fetch(
        `/api/assignments/${editingAssignment.assignmentId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ workerId }),
        },
      );
      const body = await response.json();
      if (!response.ok) throw new Error(body.message);
      setServices((current) =>
        current.map((service) =>
          service.id !== editingAssignment.serviceId
            ? service
            : {
                ...service,
                assignments: service.assignments.map((assignment) => {
                  if (
                    !assignment.slots?.some(
                      (slot) => slot.id === editingAssignment.assignmentId,
                    )
                  )
                    return assignment;
                  const slots = assignment.slots.map((slot) =>
                    slot.id === editingAssignment.assignmentId
                      ? {
                          ...slot,
                          workerId: body.workerId,
                          name: body.worker.displayName,
                          locked: true,
                        }
                      : slot,
                  );
                  return {
                    ...assignment,
                    slots,
                    names: slots.map((slot) => slot.name),
                    status: "pending",
                  };
                }),
              },
        ),
      );
      setEditingAssignment(null);
      announce("Alocação manual salva.");
    } catch (error) {
      announce(
        error instanceof Error && error.message
          ? error.message
          : "Não foi possível alterar a alocação.",
      );
    }
  };
  const saveService = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editing) return;
    const form = new FormData(event.currentTarget);
    const title = String(form.get("title"));
    const date = String(form.get("date"));
    const time = String(form.get("time"));
    try {
      const response = await fetch(`/api/events/${editing.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, startsAt: `${date}T${time}:00-03:00` }),
      });
      if (!response.ok) throw new Error();
      const updated = await response.json();
      const updatedDate = new Date(updated.startsAt);
      setServices((current) =>
        current.map((service) =>
          service.id === editing.id
            ? {
                ...service,
                title: updated.title,
                isoDate: updated.startsAt,
                weekday: new Intl.DateTimeFormat("pt-BR", {
                  weekday: "short",
                  timeZone: "America/Sao_Paulo",
                })
                  .format(updatedDate)
                  .slice(0, 3)
                  .toUpperCase(),
                date: new Intl.DateTimeFormat("pt-BR", {
                  day: "2-digit",
                  month: "short",
                  timeZone: "America/Sao_Paulo",
                })
                  .format(updatedDate)
                  .replace(" de ", " ")
                  .replace(".", "")
                  .toUpperCase(),
                time: new Intl.DateTimeFormat("pt-BR", {
                  hour: "2-digit",
                  minute: "2-digit",
                  hour12: false,
                  timeZone: "America/Sao_Paulo",
                }).format(updatedDate),
              }
            : service,
        ),
      );
      setEditing(null);
      announce("Culto salvo no PostgreSQL.");
    } catch {
      announce("Não foi possível salvar o culto.");
    }
  };
  return (
    <div className="page">
      <div className="page-toolbar">
        <div className="month-switch">
          <button
            disabled={monthLoading}
            onClick={() => onMonthChange(shiftMonth(selectedMonth, -1))}
            aria-label="Mês anterior"
          >
            ‹
          </button>
          <strong>{monthLabelFromKey(selectedMonth)}</strong>
          <button
            disabled={monthLoading}
            onClick={() => onMonthChange(shiftMonth(selectedMonth, 1))}
            aria-label="Próximo mês"
          >
            ›
          </button>
        </div>
        <div>
          <button className="ghost" onClick={openHistory}>
            <History size={18} /> Versões
          </button>
          <button className="ghost" onClick={openDaySelector}>
            <CalendarDays size={18} /> Selecionar dias
          </button>
          <button className="ghost" onClick={reviewBeforeGenerate}>
            <Sparkles size={18} /> Gerar novamente
          </button>
          <button className="primary" onClick={onShare}>
            <MessageCircle size={18} /> Compartilhar
          </button>
        </div>
      </div>
      <div className="month-summary">
        <CalendarDays />
        <strong>{visibleServices.length} cultos selecionados</strong>
        <span>
          Alterações manuais protegidas permanecem intactas ao gerar novamente.
        </span>
      </div>
      <div className="schedule-grid">
        {visibleServices.map((service) => (
          <article className="service-card" key={service.id}>
            <div className="service-head">
              <div className={`large-date ${service.color}`}>
                <strong>{service.date.split(" ")[0]}</strong>
                <span>{service.date.split(" ")[1]}</span>
              </div>
              <div>
                <span className="eyebrow">
                  {service.weekday} · {service.time}
                </span>
                <h3>{service.title}</h3>
              </div>
              <button
                className="icon-button edit-service"
                aria-label={`Editar ${service.title}`}
                onClick={() => setEditing(service)}
              >
                •••
              </button>
            </div>
            <div className="assignment-list">
              {service.assignments.map((a) => (
                <div
                  key={a.station}
                  className={
                    a.status === "open" ? "assignment open-slot" : "assignment"
                  }
                >
                  <span>{a.station}</span>
                  <div className="assignment-workers">
                    {a.slots?.map((slot) => (
                      <div
                        className={
                          slot.locked
                            ? "assignment-chip locked"
                            : "assignment-chip"
                        }
                        key={slot.id}
                      >
                        <button
                          onClick={() =>
                            setEditingAssignment({
                              serviceId: service.id,
                              assignmentId: slot.id,
                              workerId: slot.workerId,
                              station: a.station,
                              currentName: slot.name,
                            })
                          }
                        >
                          {slot.name}
                          <span>Editar</span>
                        </button>
                        <button
                          className="slot-lock"
                          aria-label={
                            slot.locked
                              ? `Liberar ${slot.name}`
                              : `Proteger ${slot.name}`
                          }
                          title={
                            slot.locked
                              ? "Protegido na geração"
                              : "Proteger na geração"
                          }
                          onClick={() =>
                            toggleLock(service.id, slot.id, !slot.locked)
                          }
                        >
                          {slot.locked ? (
                            <Lock size={14} />
                          ) : (
                            <LockOpen size={14} />
                          )}
                        </button>
                      </div>
                    ))}
                    {!a.slots?.length && <strong>+ Preencher vaga</strong>}
                  </div>
                  {a.status === "confirmed" ? (
                    <Check className="ok" />
                  ) : a.status === "pending" ? (
                    <span className="pending-dot" />
                  ) : (
                    <Plus />
                  )}
                </div>
              ))}
            </div>
          </article>
        ))}
      </div>
      {confirmGenerate && (
        <div className="modal-backdrop">
          <section className="confirm-modal validation-modal">
            <div className="stat-icon purple">
              <ShieldCheck />
            </div>
            <h2>Revisão antes de gerar</h2>
            <p>
              {validation?.summary.locked ?? 0} alocação(ões) protegida(s) serão
              preservadas. A versão atual será guardada para restauração.
            </p>
            {validation && (
              <div className="validation-summary">
                <span
                  className={
                    validation.summary.errors ? "has-errors" : "is-valid"
                  }
                >
                  <strong>{validation.summary.errors}</strong> conflitos
                </span>
                <span>
                  <strong>{validation.summary.warnings}</strong> alertas
                </span>
                <span>
                  <strong>{validation.summary.locked}</strong> protegidas
                </span>
              </div>
            )}
            <div className="validation-issues">
              {validation?.issues
                .filter((issue) => issue.severity !== "info")
                .slice(0, 6)
                .map((issue, index) => (
                  <article
                    key={`${issue.title}-${index}`}
                    className={issue.severity}
                  >
                    <AlertTriangle size={17} />
                    <div>
                      <strong>{issue.title}</strong>
                      <span>{issue.detail}</span>
                    </div>
                  </article>
                ))}
              {validation?.issues.filter((issue) => issue.severity !== "info")
                .length === 0 && (
                <article className="success">
                  <Check size={17} />
                  <div>
                    <strong>Nenhum conflito encontrado</strong>
                    <span>
                      A escala está pronta para uma nova distribuição.
                    </span>
                  </div>
                </article>
              )}
            </div>
            <div className="modal-actions">
              <button
                className="ghost"
                onClick={() => setConfirmGenerate(false)}
              >
                Cancelar
              </button>
              <button className="primary" onClick={regenerate}>
                Gerar e criar nova versão
              </button>
            </div>
          </section>
        </div>
      )}
      {historyOpen && (
        <div className="modal-backdrop">
          <section className="form-modal history-modal">
            <div className="modal-head">
              <div>
                <span className="eyebrow">HISTÓRICO</span>
                <h2>Versões da escala</h2>
              </div>
              <button
                className="icon-button"
                onClick={() => setHistoryOpen(false)}
              >
                <X />
              </button>
            </div>
            <p className="form-help">
              Cada geração guarda a distribuição anterior. Restaurar também cria
              um ponto de retorno.
            </p>
            <div className="revision-list">
              {revisions.map((revision) => (
                <article key={revision.id}>
                  <div>
                    <strong>Versão {revision.version}</strong>
                    <span>
                      {revision.reason} ·{" "}
                      {new Intl.DateTimeFormat("pt-BR", {
                        dateStyle: "short",
                        timeStyle: "short",
                      }).format(new Date(revision.createdAt))}
                    </span>
                  </div>
                  <button
                    className="secondary"
                    onClick={() => restoreRevision(revision.id)}
                  >
                    <RefreshCw size={15} /> Restaurar
                  </button>
                </article>
              ))}
              {revisions.length === 0 && (
                <div className="empty-state">
                  A primeira versão será criada ao gerar novamente.
                </div>
              )}
            </div>
          </section>
        </div>
      )}
      {editing && (
        <div className="modal-backdrop">
          <form className="form-modal" onSubmit={saveService}>
            <div className="modal-head">
              <div>
                <span className="eyebrow">EDITAR CULTO</span>
                <h2>{editing.title}</h2>
              </div>
              <button
                type="button"
                className="icon-button"
                onClick={() => setEditing(null)}
              >
                <X />
              </button>
            </div>
            <label>
              Nome do culto
              <input name="title" defaultValue={editing.title} required />
            </label>
            <div className="form-grid">
              <label>
                Data
                <input
                  name="date"
                  type="date"
                  defaultValue={(editing.isoDate ?? `${selectedMonth}-01`).slice(0, 10)}
                  required
                />
              </label>
              <label>
                Horário
                <input
                  name="time"
                  type="time"
                  defaultValue={editing.time}
                  required
                />
              </label>
            </div>
            <div className="modal-actions">
              <button
                type="button"
                className="ghost"
                onClick={() => setEditing(null)}
              >
                Cancelar
              </button>
              <button type="submit" className="primary">
                <Save size={17} /> Salvar culto
              </button>
            </div>
          </form>
        </div>
      )}
      {editingAssignment && (
        <div className="modal-backdrop">
          <form className="form-modal" onSubmit={saveAssignment}>
            <div className="modal-head">
              <div>
                <span className="eyebrow">ALOCAÇÃO MANUAL</span>
                <h2>{editingAssignment.station}</h2>
              </div>
              <button
                type="button"
                className="icon-button"
                onClick={() => setEditingAssignment(null)}
              >
                <X />
              </button>
            </div>
            <p className="form-help">
              Substitua {editingAssignment.currentName} por outro obreiro. As
              regras e a disponibilidade serão validadas.
            </p>
            <label>
              Obreiro
              <select name="workerId" defaultValue={editingAssignment.workerId}>
                {workers
                  .filter(
                    (worker) => worker.active && !worker.temporarilyUnavailable,
                  )
                  .map((worker) => (
                    <option key={worker.id} value={worker.id}>
                      {worker.name} · {worker.role}
                    </option>
                  ))}
              </select>
            </label>
            <div className="modal-actions">
              <button
                type="button"
                className="ghost"
                onClick={() => setEditingAssignment(null)}
              >
                Cancelar
              </button>
              <button type="submit" className="primary">
                <Save size={17} /> Salvar alocação
              </button>
            </div>
          </form>
        </div>
      )}
      {daySelectorOpen && (
        <div className="modal-backdrop">
          <section className="form-modal day-selector-modal">
            <div className="modal-head">
              <div>
                <span className="eyebrow">DIAS DA ESCALA</span>
                <h2>Quais cultos devem aparecer?</h2>
              </div>
              <button
                className="icon-button"
                onClick={() => setDaySelectorOpen(false)}
              >
                <X />
              </button>
            </div>
            <p className="form-help">
              Desmarque os dias anteriores à publicação ou qualquer culto que
              não deve fazer parte desta escala.
            </p>
            <div className="day-selector-actions">
              <button
                className="text-button"
                onClick={() =>
                  setSelectedEventIds(services.map((service) => service.id))
                }
              >
                Marcar todos
              </button>
              <button
                className="text-button"
                onClick={() => {
                  const today = new Date();
                  setSelectedEventIds(
                    services
                      .filter(
                        (service) =>
                          !service.isoDate ||
                          new Date(service.isoDate) >=
                            new Date(
                              today.getFullYear(),
                              today.getMonth(),
                              today.getDate(),
                            ),
                      )
                      .map((service) => service.id),
                  );
                }}
              >
                A partir de hoje
              </button>
              <button
                className="text-button muted-text"
                onClick={() => setSelectedEventIds([])}
              >
                Limpar
              </button>
            </div>
            <div className="day-options">
              {services.map((service) => (
                <label
                  className={
                    selectedEventIds.includes(service.id) ? "selected" : ""
                  }
                  key={service.id}
                >
                  <input
                    type="checkbox"
                    checked={selectedEventIds.includes(service.id)}
                    onChange={(event) =>
                      setSelectedEventIds((current) =>
                        event.target.checked
                          ? [...current, service.id]
                          : current.filter((id) => id !== service.id),
                      )
                    }
                  />
                  <div className={`mini-date ${service.color}`}>
                    <strong>{service.date.split(" ")[0]}</strong>
                    <span>{service.weekday}</span>
                  </div>
                  <div>
                    <strong>{service.title}</strong>
                    <span>{service.time}</span>
                  </div>
                </label>
              ))}
            </div>
            <div className="modal-actions">
              <button
                className="ghost"
                onClick={() => setDaySelectorOpen(false)}
              >
                Cancelar
              </button>
              <button className="primary" onClick={saveVisibleDays}>
                <Save size={17} /> Salvar dias selecionados
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

function RulesPage({
  rules,
  setRules,
  announce,
}: {
  rules: typeof initialRules;
  setRules: React.Dispatch<React.SetStateAction<typeof initialRules>>;
  announce: (m: string) => void;
}) {
  return (
    <div className="page">
      <section className="rules-intro">
        <div>
          <span className="pill">
            <ShieldCheck size={15} /> Motor de regras
          </span>
          <h2>As regras trabalham por você.</h2>
          <p>
            Critérios obrigatórios bloqueiam conflitos. Preferências orientam o
            gerador quando existem várias opções válidas.
          </p>
        </div>
        <button
          className="primary"
          onClick={() =>
            announce("Editor de nova regra pronto para a próxima etapa.")
          }
        >
          <Plus size={18} /> Nova regra
        </button>
      </section>
      <div className="rule-list">
        {rules.map((rule) => (
          <article className="rule-card" key={rule.id}>
            <div
              className={`rule-symbol ${rule.kind === "Obrigatória" ? "required" : "preferred"}`}
            >
              {rule.icon === "shield" ? (
                <ShieldCheck />
              ) : rule.icon === "balance" ? (
                <Scale />
              ) : rule.icon === "repeat" ? (
                <RefreshCw />
              ) : (
                <CalendarDays />
              )}
            </div>
            <div className="rule-copy">
              <div>
                <h3>{rule.name}</h3>
                <span
                  className={
                    rule.kind === "Obrigatória"
                      ? "tag required"
                      : "tag preferred"
                  }
                >
                  {rule.kind}
                </span>
              </div>
              <p>{rule.description}</p>
            </div>
            <label className="switch">
              <input
                type="checkbox"
                checked={rule.active}
                onChange={() =>
                  setRules((current) =>
                    current.map((item) =>
                      item.id === rule.id
                        ? { ...item, active: !item.active }
                        : item,
                    ),
                  )
                }
              />
              <span />
            </label>
            <button className="icon-button">
              <ChevronRight />
            </button>
          </article>
        ))}
      </div>
    </div>
  );
}

function WorkersPage({
  workers,
  setWorkers,
  stations,
  announce,
}: {
  workers: WorkerItem[];
  setWorkers: React.Dispatch<React.SetStateAction<WorkerItem[]>>;
  stations: StationItem[];
  announce: (m: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [selected, setSelected] = useState<WorkerItem | null>(null);
  const [availabilityMode, setAvailabilityMode] =
    useState<AvailabilityMode>("ALL");
  const [availableDates, setAvailableDates] = useState<string[]>([]);
  const [newDate, setNewDate] = useState("");
  const [preferredDates, setPreferredDates] = useState<string[]>([]);
  const [newPreferredDate, setNewPreferredDate] = useState("");
  const [positions, setPositions] = useState<WorkerPosition[]>([]);
  const filtered = workers.filter((worker) =>
    `${worker.name} ${worker.role}`.toLowerCase().includes(query.toLowerCase()),
  );
  const saveWorker = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const name = String(form.get("name") || "").trim();
    if (!name) return;
    try {
      const response = await fetch(
        selected ? `/api/workers/${selected.id}` : "/api/workers",
        {
          method: selected ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            displayName: name,
            roleName: String(form.get("role")),
            phone: String(form.get("phone")),
            active: selected?.active ?? true,
            availabilityMode,
            availableWeekdays: form.getAll("weekdays").map(Number),
            availableDates: availableDates.map(
              (date) => `${date}T12:00:00.000Z`,
            ),
            preferredWeekdays: form.getAll("preferredWeekdays").map(Number),
            preferredDates: preferredDates.map(
              (date) => `${date}T12:00:00.000Z`,
            ),
            temporarilyUnavailable: form.get("temporarilyUnavailable") === "on",
            positions: positions.map((position) => ({
              stationId: position.stationId,
              enabled: position.enabled,
              preference: position.preferred ? 1 : 0,
            })),
          }),
        },
      );
      if (!response.ok) throw new Error();
      const worker = mapWorker(await response.json());
      setWorkers((current) =>
        selected
          ? current.map((item) => (item.id === selected.id ? worker : item))
          : [...current, worker].sort((a, b) => a.name.localeCompare(b.name)),
      );
      setFormOpen(false);
      setSelected(null);
      announce(
        selected
          ? "Cadastro salvo no PostgreSQL."
          : "Obreiro salvo no PostgreSQL.",
      );
    } catch {
      announce("Não foi possível salvar o obreiro.");
    }
  };
  const openEditor = (worker?: WorkerItem) => {
    setSelected(worker ?? null);
    setAvailabilityMode(worker?.availabilityMode ?? "ALL");
    setAvailableDates(worker?.availableDates ?? []);
    setPreferredDates(worker?.preferredDates ?? []);
    setNewDate("");
    setNewPreferredDate("");
    setPositions(
      stations
        .filter((station) => station.active)
        .map((station) => {
          const saved = worker?.positions.find(
            (position) => position.stationId === station.id,
          );
          return {
            stationId: station.id,
            name: station.name,
            enabled: saved?.enabled ?? true,
            preferred: saved?.preferred ?? false,
          };
        }),
    );
    setFormOpen(true);
  };
  const weekdayOptions = [
    [0, "Dom"],
    [1, "Seg"],
    [2, "Ter"],
    [3, "Qua"],
    [4, "Qui"],
    [5, "Sex"],
    [6, "Sáb"],
  ] as const;
  return (
    <div className="page">
      <div className="section-toolbar">
        <div className="search-box">
          <Search />
          <input
            aria-label="Pesquisar obreiros"
            placeholder="Pesquisar por nome ou função"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
        <button className="primary" onClick={() => openEditor()}>
          <UserPlus size={18} /> Novo obreiro
        </button>
      </div>
      <div className="summary-strip">
        <span>
          <strong>
            {
              workers.filter((w) => w.active && !w.temporarilyUnavailable)
                .length
            }
          </strong>{" "}
          disponíveis
        </span>
        <span>
          <strong>
            {workers.filter((w) => w.temporarilyUnavailable).length}
          </strong>{" "}
          indisponíveis temporariamente
        </span>
        <span>
          <strong>
            {workers.reduce((total, w) => total + w.assignments, 0)}
          </strong>{" "}
          designações no mês
        </span>
      </div>
      <section className="table-card">
        <div className="table-head">
          <span>Obreiro</span>
          <span>Função</span>
          <span>Telefone</span>
          <span>Escalas</span>
          <span>Status</span>
        </div>
        {filtered.map((worker) => (
          <button
            className="worker-row"
            key={worker.id}
            onClick={() => openEditor(worker)}
          >
            <div className="worker-name">
              <div className="avatar small">
                {worker.name
                  .split(" ")
                  .map((part) => part[0])
                  .slice(0, 2)
                  .join("")}
              </div>
              <strong>{worker.name}</strong>
            </div>
            <span>{worker.role}</span>
            <span>{worker.phone}</span>
            <strong>{worker.assignments}</strong>
            <span
              className={
                worker.temporarilyUnavailable
                  ? "status warning"
                  : worker.active
                    ? "status success"
                    : "status muted"
              }
            >
              {worker.temporarilyUnavailable
                ? "Indisponível"
                : worker.active
                  ? "Ativo"
                  : "Inativo"}
            </span>
          </button>
        ))}
        {filtered.length === 0 && (
          <div className="empty-state">Nenhum obreiro encontrado.</div>
        )}
      </section>
      {formOpen && (
        <div className="modal-backdrop">
          <form className="form-modal worker-form" onSubmit={saveWorker}>
            <div className="modal-head">
              <div>
                <span className="eyebrow">CADASTRO</span>
                <h2>{selected ? "Editar obreiro" : "Novo obreiro"}</h2>
              </div>
              <button
                type="button"
                className="icon-button"
                onClick={() => setFormOpen(false)}
              >
                <X />
              </button>
            </div>
            <label>
              Nome de exibição
              <input
                name="name"
                defaultValue={selected?.name}
                placeholder="Nome usado na escala"
                autoFocus
              />
            </label>
            <div className="form-grid">
              <label>
                Função
                <select name="role" defaultValue={selected?.role ?? "Auxiliar"}>
                  <option>Auxiliar</option>
                  <option>Diácono</option>
                  <option>Presbítero</option>
                </select>
              </label>
              <label>
                Telefone
                <input
                  name="phone"
                  defaultValue={selected?.phone}
                  placeholder="(61) 99999-9999"
                />
              </label>
            </div>
            <div className="availability-box">
              <div>
                <span className="eyebrow">DISPONIBILIDADE</span>
                <h3>Quando pode entrar na escala?</h3>
              </div>
              <label>
                Forma de disponibilidade
                <select
                  value={availabilityMode}
                  onChange={(event) =>
                    setAvailabilityMode(event.target.value as AvailabilityMode)
                  }
                >
                  <option value="ALL">Todos os dias</option>
                  <option value="WEEKDAYS">
                    Somente em dias da semana escolhidos
                  </option>
                  <option value="DATES">Somente em datas específicas</option>
                </select>
              </label>
              {availabilityMode === "WEEKDAYS" && (
                <div className="weekday-picker">
                  {weekdayOptions.map(([value, label]) => (
                    <label key={value}>
                      <input
                        type="checkbox"
                        name="weekdays"
                        value={value}
                        defaultChecked={selected?.availableWeekdays.includes(
                          value,
                        )}
                      />
                      <span>{label}</span>
                    </label>
                  ))}
                </div>
              )}
              {availabilityMode === "DATES" && (
                <div>
                  <div className="date-adder">
                    <input
                      type="date"
                      value={newDate}
                      onChange={(event) => setNewDate(event.target.value)}
                    />
                    <button
                      type="button"
                      className="secondary"
                      onClick={() => {
                        if (newDate && !availableDates.includes(newDate))
                          setAvailableDates((current) =>
                            [...current, newDate].sort(),
                          );
                        setNewDate("");
                      }}
                    >
                      <Plus size={16} /> Adicionar
                    </button>
                  </div>
                  <div className="date-chips">
                    {availableDates.map((date) => (
                      <button
                        type="button"
                        key={date}
                        onClick={() =>
                          setAvailableDates((current) =>
                            current.filter((item) => item !== date),
                          )
                        }
                      >
                        {new Intl.DateTimeFormat("pt-BR", {
                          timeZone: "UTC",
                        }).format(new Date(`${date}T12:00:00Z`))}
                        <X size={13} />
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <label className="temporary-toggle">
                <input
                  type="checkbox"
                  name="temporarilyUnavailable"
                  defaultChecked={selected?.temporarilyUnavailable}
                />
                <span>
                  <strong>Temporariamente indisponível</strong>
                  <small>
                    Não será incluído em nenhuma geração até esta opção ser
                    desmarcada.
                  </small>
                </span>
              </label>
            </div>
            <div className="availability-box preference-box">
              <div>
                <span className="eyebrow">PREFERÊNCIAS</span>
                <h3>Em quais dias prefere servir?</h3>
                <p className="form-help">
                  O gerador tentará usar estes dias primeiro. Se necessário, o
                  obreiro ainda poderá ser escalado nos demais dias em que
                  estiver disponível.
                </p>
              </div>
              <span className="preference-label">Dias da semana preferidos</span>
              <div className="weekday-picker">
                {weekdayOptions.map(([value, label]) => (
                  <label key={`preferred-${value}`}>
                    <input
                      type="checkbox"
                      name="preferredWeekdays"
                      value={value}
                      defaultChecked={selected?.preferredWeekdays.includes(value)}
                    />
                    <span>{label}</span>
                  </label>
                ))}
              </div>
              <span className="preference-label">Datas específicas preferidas</span>
              <div className="date-adder">
                <input type="date" value={newPreferredDate} onChange={(event) => setNewPreferredDate(event.target.value)} />
                <button
                  type="button"
                  className="secondary"
                  onClick={() => {
                    if (newPreferredDate && !preferredDates.includes(newPreferredDate))
                      setPreferredDates((current) => [...current, newPreferredDate].sort());
                    setNewPreferredDate("");
                  }}
                >
                  <Plus size={16} /> Adicionar
                </button>
              </div>
              <div className="date-chips">
                {preferredDates.map((date) => (
                  <button type="button" key={`preferred-date-${date}`} onClick={() => setPreferredDates((current) => current.filter((item) => item !== date))}>
                    {new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC" }).format(new Date(`${date}T12:00:00Z`))}
                    <X size={13} />
                  </button>
                ))}
              </div>
            </div>
            <div className="availability-box position-box">
              <div>
                <span className="eyebrow">POSIÇÕES</span>
                <h3>Onde este obreiro pode servir?</h3>
                <p className="form-help">
                  Desmarque uma posição para impedir a alocação. Marque como
                  preferida para o gerador priorizá-la.
                </p>
              </div>
              <div className="position-list">
                {positions.map((position) => (
                  <div className="position-option" key={position.stationId}>
                    <label>
                      <input
                        type="checkbox"
                        checked={position.enabled}
                        onChange={(event) =>
                          setPositions((current) =>
                            current.map((item) =>
                              item.stationId === position.stationId
                                ? {
                                    ...item,
                                    enabled: event.target.checked,
                                    preferred: event.target.checked
                                      ? item.preferred
                                      : false,
                                  }
                                : item,
                            ),
                          )
                        }
                      />
                      <strong>{position.name}</strong>
                    </label>
                    <label className="position-preference">
                      <input
                        type="checkbox"
                        checked={position.preferred}
                        disabled={!position.enabled}
                        onChange={(event) =>
                          setPositions((current) =>
                            current.map((item) =>
                              item.stationId === position.stationId
                                ? { ...item, preferred: event.target.checked }
                                : item,
                            ),
                          )
                        }
                      />
                      Preferida
                    </label>
                  </div>
                ))}
              </div>
            </div>
            <div className="modal-actions">
              {selected && (
                <button
                  type="button"
                  className="ghost"
                  onClick={async () => {
                    try {
                      const response = await fetch(
                        `/api/workers/${selected.id}`,
                        {
                          method: "PATCH",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ active: !selected.active }),
                        },
                      );
                      if (!response.ok) throw new Error();
                      const worker = mapWorker(await response.json());
                      setWorkers((current) =>
                        current.map((item) =>
                          item.id === selected.id ? worker : item,
                        ),
                      );
                      setFormOpen(false);
                      announce(
                        selected.active
                          ? "Obreiro inativado no banco."
                          : "Obreiro reativado no banco.",
                      );
                    } catch {
                      announce("Não foi possível alterar o status.");
                    }
                  }}
                >
                  {selected.active ? "Inativar" : "Reativar"}
                </button>
              )}
              <button className="primary" type="submit">
                <Save size={17} /> Salvar
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

function SubstitutionsPage({ announce }: { announce: (m: string) => void }) {
  const [requests, setRequests] = useState([
    {
      id: 1,
      from: "Davi Oiticica",
      to: "Pedro",
      date: "14/08/2026",
      station: "Lateral esquerdo",
      status: "Pendente",
    },
  ]);
  return (
    <div className="page">
      <section className="simple-hero">
        <div className="stat-icon amber">
          <RefreshCw />
        </div>
        <div>
          <span className="eyebrow">TROCAS E IMPREVISTOS</span>
          <h2>Pedidos de substituição</h2>
          <p>Aprove as trocas antes que elas alterem a escala publicada.</p>
        </div>
      </section>
      <section className="table-card substitutions">
        <div className="table-head">
          <span>Solicitante</span>
          <span>Substituto</span>
          <span>Data e posto</span>
          <span>Status</span>
          <span>Ações</span>
        </div>
        {requests.map((request) => (
          <div className="substitution-row" key={request.id}>
            <strong>{request.from}</strong>
            <span>{request.to}</span>
            <span>
              {request.date}
              <small>{request.station}</small>
            </span>
            <span className="status warning">{request.status}</span>
            <div>
              <button
                className="ghost"
                onClick={() => {
                  setRequests((current) =>
                    current.filter((item) => item.id !== request.id),
                  );
                  announce("Substituição recusada.");
                }}
              >
                Recusar
              </button>
              <button
                className="secondary"
                onClick={() => {
                  setRequests((current) =>
                    current.map((item) =>
                      item.id === request.id
                        ? { ...item, status: "Aprovada" }
                        : item,
                    ),
                  );
                  announce("Substituição aprovada e registrada.");
                }}
              >
                Aprovar
              </button>
            </div>
          </div>
        ))}
        {requests.length === 0 && (
          <div className="empty-state">Não existem solicitações pendentes.</div>
        )}
      </section>
    </div>
  );
}

function SettingsPage({
  settings,
  setSettings,
  scheduleId,
  selectedMonth,
  services,
  setServices,
  stations,
  setStations,
  eventTypes,
  setEventTypes,
  announce,
}: {
  settings: { name: string; timezone: string };
  setSettings: React.Dispatch<
    React.SetStateAction<{ name: string; timezone: string }>
  >;
  scheduleId: string | null;
  selectedMonth: string;
  services: Service[];
  setServices: React.Dispatch<React.SetStateAction<Service[]>>;
  stations: StationItem[];
  setStations: React.Dispatch<React.SetStateAction<StationItem[]>>;
  eventTypes: EventTypeItem[];
  setEventTypes: React.Dispatch<React.SetStateAction<EventTypeItem[]>>;
  announce: (m: string) => void;
}) {
  const [tab, setTab] = useState("geral");
  const [stationEditor, setStationEditor] = useState<
    StationItem | "new" | null
  >(null);
  const supperService = services.find((service) => service.color === "purple");
  const refreshEventTypes = async () => {
    const response = await fetch("/api/event-types");
    if (response.ok) setEventTypes(await response.json());
  };
  const saveStation = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      const editing = stationEditor === "new" ? null : stationEditor;
      const response = await fetch(
        editing ? `/api/stations/${editing.id}` : "/api/stations",
        {
          method: editing ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: String(form.get("name")),
            defaultQuantity: Number(form.get("quantity")),
            active: editing?.active ?? true,
          }),
        },
      );
      if (!response.ok) throw new Error();
      const saved = await response.json();
      setStations((current) =>
        editing
          ? current.map((item) => (item.id === saved.id ? saved : item))
          : [...current, saved],
      );
      await refreshEventTypes();
      setStationEditor(null);
      announce(
        editing ? "Posição atualizada." : "Posição cadastrada para os cultos.",
      );
    } catch {
      announce("Não foi possível salvar a posição.");
    }
  };
  const saveSupperDate = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!scheduleId) return;
    const form = new FormData(event.currentTarget);
    const date = String(form.get("supperDate"));
    const time = String(form.get("supperTime"));
    try {
      const response = await fetch(`/api/schedules/${scheduleId}/santa-ceia`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ startsAt: `${date}T${time}:00-03:00` }),
      });
      if (!response.ok) {
        const body = await response.json();
        throw new Error(body.message);
      }
      const dashboardResponse = await fetch(`/api/dashboard?month=${selectedMonth}`);
      const dashboard = await dashboardResponse.json();
      setServices(
        mapSchedule(dashboard.events, dashboard.schedule.assignments),
      );
      announce(
        "Data da Santa Ceia atualizada. Gere novamente a escala para preencher os cultos alterados.",
      );
    } catch (error) {
      announce(
        error instanceof Error && error.message
          ? error.message
          : "Não foi possível alterar a data da Santa Ceia.",
      );
    }
  };
  return (
    <div className="page settings-page">
      <div className="settings-tabs">
        <button
          className={tab === "geral" ? "active" : ""}
          onClick={() => setTab("geral")}
        >
          Geral
        </button>
        <button
          className={tab === "cultos" ? "active" : ""}
          onClick={() => setTab("cultos")}
        >
          Cultos e posições
        </button>
        <button
          className={tab === "compartilhar" ? "active" : ""}
          onClick={() => setTab("compartilhar")}
        >
          Compartilhamento
        </button>
      </div>
      {tab === "geral" && (
        <form
          className="settings-card"
          onSubmit={async (event) => {
            event.preventDefault();
            const form = new FormData(event.currentTarget);
            try {
              const response = await fetch("/api/church", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  name: String(form.get("name")),
                  timezone: String(form.get("timezone")),
                }),
              });
              if (!response.ok) throw new Error();
              const saved = await response.json();
              setSettings({ name: saved.name, timezone: saved.timezone });
              announce("Configurações salvas no PostgreSQL.");
            } catch {
              announce("Não foi possível salvar as configurações.");
            }
          }}
        >
          <div className="settings-title">
            <Building2 />
            <div>
              <h3>Dados da congregação</h3>
              <p>Informações exibidas nas escalas e comunicações.</p>
            </div>
          </div>
          <label>
            Nome da congregação
            <input name="name" defaultValue={settings.name} />
          </label>
          <div className="form-grid">
            <label>
              Fuso horário
              <select name="timezone" defaultValue={settings.timezone}>
                <option value="America/Sao_Paulo">
                  Brasília — America/Sao_Paulo
                </option>
              </select>
            </label>
            <label>
              Telefone
              <input placeholder="Telefone institucional" />
            </label>
          </div>
          <button className="primary save-button">
            <Save /> Salvar alterações
          </button>
        </form>
      )}
      {tab === "cultos" && (
        <div className="cult-settings">
          <form
            className="settings-card supper-date-card"
            onSubmit={saveSupperDate}
          >
            <div className="settings-title">
              <Sparkles />
              <div>
                <h3>Data da Santa Ceia</h3>
                <p>
                  Escolha em qual dia do mês o culto especial será realizado.
                </p>
              </div>
            </div>
            <div className="supper-date-fields">
              <label>
                Data
                <input
                  name="supperDate"
                  type="date"
                  defaultValue={(supperService?.isoDate ?? `${selectedMonth}-01`).slice(
                    0,
                    10,
                  )}
                  required
                />
              </label>
              <label>
                Horário
                <input
                  name="supperTime"
                  type="time"
                  defaultValue={supperService?.time ?? "18:00"}
                  required
                />
              </label>
              <button className="primary">
                <Save size={17} /> Salvar data
              </button>
            </div>
            <div className="supper-date-note">
              <AlertTriangle size={17} />
              <span>
                Se a nova data for um domingo, a Santa Ceia substituirá
                automaticamente o culto normal daquele dia.
              </span>
            </div>
          </form>
          <section className="settings-card">
            <div className="settings-title settings-title-action">
              <div className="settings-title-copy">
                <Scale />
                <div>
                  <h3>Cadastro de posições</h3>
                  <p>
                    Defina os postos disponíveis e a quantidade padrão de
                    obreiros.
                  </p>
                </div>
              </div>
              <button
                className="primary"
                onClick={() => setStationEditor("new")}
              >
                <Plus size={17} /> Nova posição
              </button>
            </div>
            <div className="station-cards">
              {stations
                .filter((station) => station.active)
                .map((station) => (
                  <button
                    key={station.id}
                    onClick={() => setStationEditor(station)}
                  >
                    <div>
                      <strong>{station.name}</strong>
                      <span>
                        {station.defaultQuantity}{" "}
                        {station.defaultQuantity === 1 ? "obreiro" : "obreiros"}{" "}
                        por padrão
                      </span>
                    </div>
                    <ChevronRight />
                  </button>
                ))}
            </div>
          </section>
          <section className="settings-card">
            <div className="settings-title">
              <CalendarDays />
              <div>
                <h3>Posições por tipo de culto</h3>
                <p>
                  Marque os postos utilizados e ajuste a quantidade para cada
                  culto.
                </p>
              </div>
            </div>
            <div className="event-type-configs">
              {eventTypes.map((eventType) => (
                <EventTypePositions
                  key={eventType.id}
                  eventType={eventType}
                  stations={stations.filter((station) => station.active)}
                  onSaved={(saved) =>
                    setEventTypes((current) =>
                      current.map((item) =>
                        item.id === saved.id ? saved : item,
                      ),
                    )
                  }
                  announce={announce}
                />
              ))}
            </div>
          </section>
        </div>
      )}
      {tab === "compartilhar" && (
        <form
          className="settings-card"
          onSubmit={(event) => {
            event.preventDefault();
            announce(
              "Preferências de compartilhamento salvas neste navegador.",
            );
          }}
        >
          <div className="settings-title">
            <Share2 />
            <div>
              <h3>Arte para WhatsApp</h3>
              <p>Escolha como a escala será apresentada ao grupo.</p>
            </div>
          </div>
          <label>
            Divisão da imagem
            <select defaultValue="mensal">
              <option value="mensal">Mês completo</option>
              <option value="quinzenal">Por quinzena</option>
              <option value="semanal">Por semana</option>
            </select>
          </label>
          <label className="check-line">
            <input type="checkbox" defaultChecked /> Exibir número da versão e
            data de publicação
          </label>
          <button className="primary save-button">
            <Save /> Salvar preferências
          </button>
        </form>
      )}
      {stationEditor && (
        <div className="modal-backdrop">
          <form className="form-modal" onSubmit={saveStation}>
            <div className="modal-head">
              <div>
                <span className="eyebrow">POSIÇÃO DO CULTO</span>
                <h2>
                  {stationEditor === "new" ? "Nova posição" : "Editar posição"}
                </h2>
              </div>
              <button
                type="button"
                className="icon-button"
                onClick={() => setStationEditor(null)}
              >
                <X />
              </button>
            </div>
            <label>
              Nome da posição
              <input
                name="name"
                defaultValue={stationEditor === "new" ? "" : stationEditor.name}
                placeholder="Ex.: Portaria"
                required
              />
            </label>
            <label>
              Quantidade padrão de obreiros
              <input
                name="quantity"
                type="number"
                min="1"
                max="10"
                defaultValue={
                  stationEditor === "new" ? 1 : stationEditor.defaultQuantity
                }
                required
              />
            </label>
            <div className="modal-actions">
              <button
                type="button"
                className="ghost"
                onClick={() => setStationEditor(null)}
              >
                Cancelar
              </button>
              <button className="primary">
                <Save size={17} /> Salvar posição
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

function EventTypePositions({
  eventType,
  stations,
  onSaved,
  announce,
}: {
  eventType: EventTypeItem;
  stations: StationItem[];
  onSaved: (eventType: EventTypeItem) => void;
  announce: (message: string) => void;
}) {
  const initial = () =>
    stations.map((station) => {
      const configured = eventType.stations.find(
        (item) => item.stationId === station.id,
      );
      return {
        stationId: station.id,
        name: station.name,
        enabled: configured?.enabled ?? false,
        quantity: configured?.quantity ?? station.defaultQuantity,
      };
    });
  const [positions, setPositions] = useState(initial);
  useEffect(() => setPositions(initial()), [eventType, stations]);
  const save = async () => {
    try {
      const response = await fetch(
        `/api/event-types/${eventType.id}/stations`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ positions }),
        },
      );
      if (!response.ok) throw new Error();
      onSaved(await response.json());
      announce(
        `Posições de ${eventType.name} salvas. Gere novamente a escala para redistribuir.`,
      );
    } catch {
      announce("Não foi possível salvar as posições do culto.");
    }
  };
  return (
    <article
      className={
        eventType.code === "SANTA_CEIA"
          ? "event-type-config supper"
          : "event-type-config"
      }
    >
      <div className="event-type-head">
        <div>
          <strong>{eventType.name}</strong>
          <span>{eventType.defaultTime ?? "Horário variável"}</span>
        </div>
        <div>
          <button
            className="text-button"
            onClick={() =>
              setPositions((current) =>
                current.map((item) => ({ ...item, enabled: true })),
              )
            }
          >
            Marcar todas
          </button>
          <button
            className="text-button muted-text"
            onClick={() =>
              setPositions((current) =>
                current.map((item) => ({ ...item, enabled: false })),
              )
            }
          >
            Limpar
          </button>
        </div>
      </div>
      <div className="position-options">
        {positions.map((position) => (
          <div
            className={
              position.enabled ? "position-option selected" : "position-option"
            }
            key={position.stationId}
          >
            <label>
              <input
                type="checkbox"
                checked={position.enabled}
                onChange={(event) =>
                  setPositions((current) =>
                    current.map((item) =>
                      item.stationId === position.stationId
                        ? { ...item, enabled: event.target.checked }
                        : item,
                    ),
                  )
                }
              />
              <span>{position.name}</span>
            </label>
            <input
              aria-label={`Quantidade em ${position.name}`}
              type="number"
              min="1"
              max="10"
              disabled={!position.enabled}
              value={position.quantity}
              onChange={(event) =>
                setPositions((current) =>
                  current.map((item) =>
                    item.stationId === position.stationId
                      ? {
                          ...item,
                          quantity: Math.max(1, Number(event.target.value)),
                        }
                      : item,
                  ),
                )
              }
            />
          </div>
        ))}
      </div>
      <button className="secondary save-type-positions" onClick={save}>
        <Save size={15} /> Salvar posições deste culto
      </button>
    </article>
  );
}

function ShareModal({
  services,
  selectedMonth,
  shareRef,
  onClose,
  onShare,
  announce,
}: {
  services: Service[];
  selectedMonth: string;
  shareRef: React.RefObject<HTMLDivElement | null>;
  onClose: () => void;
  onShare: () => void;
  announce: (m: string) => void;
}) {
  const [shareFormat, setShareFormat] = useState<"month" | "week" | "worker">(
    "month",
  );
  const [selectedWeek, setSelectedWeek] = useState(0);
  const workerNames = [
    ...new Set(
      services.flatMap((service) =>
        service.assignments.flatMap((assignment) => assignment.names),
      ),
    ),
  ].sort((a, b) => a.localeCompare(b));
  const [selectedWorker, setSelectedWorker] = useState(workerNames[0] ?? "");
  const referenceDate = services[0]?.isoDate
    ? new Date(services[0].isoDate)
    : new Date(`${selectedMonth}-01T12:00:00Z`);
  const month =
    Number(
      new Intl.DateTimeFormat("en-US", {
        month: "numeric",
        timeZone: "America/Sao_Paulo",
      }).format(referenceDate),
    ) - 1;
  const year = Number(
    new Intl.DateTimeFormat("en-US", {
      year: "numeric",
      timeZone: "America/Sao_Paulo",
    }).format(referenceDate),
  );
  const firstWeekday = new Date(Date.UTC(year, month, 1, 12)).getUTCDay();
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0, 12)).getUTCDate();
  const servicesByWeek = new Map<number, Service[]>();
  services.forEach((service) => {
    const day = Number(service.date.split(" ")[0]);
    const week = Math.floor((firstWeekday + day - 1) / 7);
    servicesByWeek.set(week, [...(servicesByWeek.get(week) ?? []), service]);
  });
  const calendarWeeks = [...servicesByWeek.entries()]
    .sort(([a], [b]) => a - b)
    .map(([week, weekServices]) => ({
      week,
      start: Math.max(1, week * 7 - firstWeekday + 1),
      end: Math.min(daysInMonth, week * 7 - firstWeekday + 7),
      services: weekServices.sort(
        (a, b) => Number(a.date.split(" ")[0]) - Number(b.date.split(" ")[0]),
      ),
    }));
  const displayedWeeks =
    shareFormat === "week"
      ? calendarWeeks.filter((_, index) => index === selectedWeek)
      : calendarWeeks;
  const displayedServices =
    shareFormat === "worker"
      ? services.filter((service) =>
          service.assignments.some((assignment) =>
            assignment.names.includes(selectedWorker),
          ),
        )
      : displayedWeeks.flatMap((week) => week.services);
  const posterWeeks =
    shareFormat === "worker"
      ? [{ week: 0, start: 1, end: daysInMonth, services: displayedServices }]
      : displayedWeeks;
  const monthLabel = new Intl.DateTimeFormat("pt-BR", {
    month: "long",
    year: "numeric",
    timeZone: "America/Sao_Paulo",
  })
    .format(referenceDate)
    .toUpperCase();
  return (
    <div className="modal-backdrop">
      <section className="share-modal calendar-share-modal">
        <div className="modal-head">
          <div>
            <span className="eyebrow">PRÉVIA PARA WHATSAPP</span>
            <h2>
              {shareFormat === "month"
                ? "Calendário mensal"
                : shareFormat === "week"
                  ? "Escala semanal"
                  : `Escala de ${selectedWorker}`}
            </h2>
          </div>
          <button
            className="icon-button"
            onClick={onClose}
            aria-label="Fechar compartilhamento"
          >
            <X />
          </button>
        </div>
        <div className="share-format-tabs">
          <button
            className={shareFormat === "month" ? "active" : ""}
            onClick={() => setShareFormat("month")}
          >
            Mês completo
          </button>
          <button
            className={shareFormat === "week" ? "active" : ""}
            onClick={() => setShareFormat("week")}
          >
            Por semana
          </button>
          <button
            className={shareFormat === "worker" ? "active" : ""}
            onClick={() => setShareFormat("worker")}
          >
            Por obreiro
          </button>
        </div>
        {shareFormat === "week" && (
          <label className="share-filter">
            Semana
            <select
              value={selectedWeek}
              onChange={(event) => setSelectedWeek(Number(event.target.value))}
            >
              {calendarWeeks.map((week, index) => (
                <option value={index} key={week.week}>
                  Semana {index + 1} · dias {week.start} a {week.end}
                </option>
              ))}
            </select>
          </label>
        )}
        {shareFormat === "worker" && (
          <label className="share-filter">
            Obreiro
            <select
              value={selectedWorker}
              onChange={(event) => setSelectedWorker(event.target.value)}
            >
              {workerNames.map((name) => (
                <option key={name}>{name}</option>
              ))}
            </select>
          </label>
        )}
        <div className="share-layout calendar-share-layout">
          <div className="poster-wrap calendar-poster-wrap">
            <div
              className={`poster calendar-poster editorial-poster format-${shareFormat}`}
              ref={shareRef}
            >
              <div className="calendar-poster-top editorial-masthead">
                <div className="poster-logo">
                  <ClipboardList />
                </div>
                <div>
                  <span>IGREJA DE BRASÍLIA</span>
                  <h2>
                    {shareFormat === "worker"
                      ? `Escala de ${selectedWorker}`
                      : "Escala de Obreiros"}
                  </h2>
                </div>
                <strong>{monthLabel.replace(" DE ", " · ")}</strong>
              </div>
              <div className="editorial-subline">
                <div className="editorial-legend">
                  <span>
                    <i className="legend-dot sunday" />
                    Domingo
                  </span>
                  <span>
                    <i className="legend-dot tuesday" />
                    Terça-feira
                  </span>
                  <span>
                    <i className="legend-dot friday" />
                    Sexta-feira
                  </span>
                  <span>
                    <i className="legend-dot supper" />
                    Santa Ceia
                  </span>
                </div>
                <strong>{displayedServices.length} cultos</strong>
              </div>
              <div className="calendar-weeks">
                {posterWeeks.map((week, index) => (
                  <section
                    className="calendar-week"
                    key={`${week.week}-${shareFormat}`}
                  >
                    <div className="calendar-week-head">
                      <strong>
                        {shareFormat === "worker"
                          ? "MINHAS DESIGNAÇÕES"
                          : `SEMANA ${shareFormat === "week" ? selectedWeek + 1 : index + 1}`}
                      </strong>
                      <span>
                        {shareFormat === "worker"
                          ? monthLabel
                          : `${String(week.start).padStart(2, "0")} a ${String(week.end).padStart(2, "0")} de ${new Intl.DateTimeFormat("pt-BR", { month: "long", timeZone: "UTC" }).format(referenceDate)}`}
                      </span>
                    </div>
                    <div className="calendar-cult-days">
                      {week.services.map((service) => (
                        <article
                          className={`calendar-cult-day ${service.color} ${service.eventCode?.toLowerCase() ?? ""} ${service.color === "purple" ? "santa-ceia-featured" : ""}`}
                          key={service.id}
                        >
                          {service.color === "purple" && (
                            <div className="supper-ribbon">
                              <Sparkles size={10} /> SANTA CEIA
                            </div>
                          )}
                          <div className="calendar-cult-date">
                            <strong>{service.date.split(" ")[0]}</strong>
                            <span>
                              {service.weekday === "DOM"
                                ? "DOMINGO"
                                : service.weekday === "TER"
                                  ? "TERÇA"
                                  : "SEXTA"}
                            </span>
                          </div>
                          <div className="calendar-service-title">
                            <strong>{service.title}</strong>
                            <span>{service.time}</span>
                          </div>
                          <div className="calendar-assignments">
                            {service.assignments
                              .filter(
                                (assignment) =>
                                  shareFormat !== "worker" ||
                                  assignment.names.includes(selectedWorker),
                              )
                              .map((assignment) => (
                                <div key={assignment.station}>
                                  <span>{assignment.station}</span>
                                  <strong className="calendar-worker-names">
                                    {shareFormat === "worker" ? (
                                      <b>{selectedWorker}</b>
                                    ) : assignment.names.length ? (
                                      assignment.names.map((name) => (
                                        <b key={name}>{name}</b>
                                      ))
                                    ) : (
                                      <b>A definir</b>
                                    )}
                                  </strong>
                                </div>
                              ))}
                          </div>
                        </article>
                      ))}
                    </div>
                  </section>
                ))}
              </div>
              <div className="poster-footer">
                Consulte sempre a versão atualizada antes de cada culto · Igreja
                de Brasília
              </div>
            </div>
          </div>
          <div className="share-options">
            <h3>Compartilhar imagem</h3>
            <p>
              Escolha mês, semana ou cartão individual antes de enviar ao
              WhatsApp.
            </p>
            <button className="whatsapp" onClick={onShare}>
              <MessageCircle /> Compartilhar imagem
            </button>
            <button className="ghost full" onClick={onShare}>
              <Download /> Baixar PNG
            </button>
            <button
              className="ghost full"
              onClick={() => announce("Link público copiado.")}
            >
              <Share2 /> Copiar link público
            </button>
            <div className="version-note">
              <Check />
              <div>
                <strong>
                  {shareFormat === "month"
                    ? "Mês completo"
                    : shareFormat === "week"
                      ? "Semana selecionada"
                      : "Cartão individual"}
                </strong>
                <span>{displayedServices.length} culto(s) nesta imagem.</span>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
