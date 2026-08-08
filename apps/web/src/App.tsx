import { useEffect, useRef, useState } from "react";
import { toBlob } from "html-to-image";
import { AlertTriangle, Building2, CalendarDays, Check, ChevronRight, ClipboardList, Download, FileText, LayoutDashboard, Menu, MessageCircle, Plus, RefreshCw, Save, Scale, Search, Settings, Share2, ShieldCheck, Sparkles, UserPlus, Users, X } from "lucide-react";
import { initialRules, services, type Service } from "./data";

type View = "dashboard" | "schedule" | "rules" | "workers" | "substitutions" | "settings";
const nav = [
  { id: "dashboard" as View, label: "Visão geral", icon: LayoutDashboard },
  { id: "schedule" as View, label: "Escalas", icon: CalendarDays },
  { id: "rules" as View, label: "Regras", icon: ShieldCheck }
];
type AvailabilityMode = "ALL" | "WEEKDAYS" | "DATES";
type WorkerItem = { id: number | string; name: string; role: string; phone: string; active: boolean; assignments: number; availabilityMode: AvailabilityMode; availableWeekdays: number[]; availableDates: string[]; temporarilyUnavailable: boolean };
const initialWorkers: WorkerItem[] = [
  { id: 1, name: "Alexandre (Gelo)", role: "Auxiliar", phone: "(61) 99911-2040", active: true, assignments: 3, availabilityMode: "ALL", availableWeekdays: [], availableDates: [], temporarilyUnavailable: false }
];
const titles: Record<View, string> = { dashboard: "Olá, Natanael", schedule: "Escala mensal", rules: "Regras de distribuição", workers: "Obreiros", substitutions: "Substituições", settings: "Configurações" };

type ApiAssignment = { id: string; eventId: string; stationId: string; event: { id: string; title: string; startsAt: string; eventType: { code: string; color: string } }; station: { id: string; name: string; sortOrder: number }; workerId: string; worker: { displayName: string }; status: string };
type ApiEvent = { id: string; title: string; startsAt: string; eventType: { code: string; color: string }; requirements: Array<{ quantity: number; station: { id: string; name: string; sortOrder: number } }> };
type ApiWorker = { id: string; displayName: string; phone?: string | null; active: boolean; availabilityMode: AvailabilityMode; availableWeekdays: number[]; availableDates: string[]; temporarilyUnavailable: boolean; role: { name: string }; _count: { assignments: number } };
const mapWorker = (worker: ApiWorker): WorkerItem => ({ id: worker.id, name: worker.displayName, role: worker.role.name, phone: worker.phone ?? "", active: worker.active, assignments: worker._count.assignments, availabilityMode: worker.availabilityMode, availableWeekdays: worker.availableWeekdays, availableDates: worker.availableDates.map(date => date.slice(0, 10)), temporarilyUnavailable: worker.temporarilyUnavailable });
const mapSchedule = (events: ApiEvent[], assignments: ApiAssignment[]): Service[] => {
  const assignmentsByEvent = new Map<string, ApiAssignment[]>();
  assignments.forEach(item => assignmentsByEvent.set(item.eventId, [...(assignmentsByEvent.get(item.eventId) ?? []), item]));
  return events.map(event => {
    const items = assignmentsByEvent.get(event.id) ?? [];
    const startsAt = new Date(event.startsAt);
    return {
      id: event.id,
      title: event.title,
      isoDate: event.startsAt,
      weekday: new Intl.DateTimeFormat("pt-BR", { weekday: "short", timeZone: "America/Sao_Paulo" }).format(startsAt).slice(0, 3).toUpperCase(),
      date: new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", timeZone: "America/Sao_Paulo" }).format(startsAt).replace(" de ", " ").replace(".", "").toUpperCase(),
      time: new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "America/Sao_Paulo" }).format(startsAt),
      color: event.eventType.code === "SANTA_CEIA" ? "purple" : event.eventType.code === "TERCA" ? "teal" : "gold",
      assignments: event.requirements.map(requirement => {
        const group = items.filter(item => item.stationId === requirement.station.id);
        return { station: requirement.station.name, names: group.map(item => item.worker.displayName), slots: group.map(item => ({ id: item.id, workerId: item.workerId, name: item.worker.displayName })), status: (group.length < requirement.quantity ? "open" : group.some(item => item.status === "PENDING") ? "pending" : "confirmed") as "open" | "pending" | "confirmed" };
      })
    };
  }).sort((a, b) => new Date(a.isoDate!).getTime() - new Date(b.isoDate!).getTime());
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
  const [churchSettings, setChurchSettings] = useState({ name: "Igreja de Brasília", timezone: "America/Sao_Paulo" });
  const shareRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    Promise.all([fetch("/api/dashboard"), fetch("/api/workers")]).then(async ([dashboardResponse, workersResponse]) => {
      if (!dashboardResponse.ok || !workersResponse.ok) throw new Error("Falha ao carregar dados");
      const dashboard = await dashboardResponse.json();
      const apiWorkers = await workersResponse.json();
      setChurchSettings({ name: dashboard.church.name, timezone: dashboard.church.timezone });
      setScheduleId(dashboard.schedule?.id ?? null);
      if (dashboard.schedule) setScheduleServices(mapSchedule(dashboard.events ?? [], dashboard.schedule.assignments ?? []));
      setWorkers(apiWorkers.map(mapWorker));
    }).catch(() => announce("Não foi possível sincronizar com o servidor; exibindo dados locais."));
  }, []);

  const navigate = (target: View) => { setView(target); setMobileMenu(false); };
  const announce = (message: string) => { setNotice(message); window.setTimeout(() => setNotice(""), 2600); };

  async function shareImage() {
    if (!shareRef.current) return;
    const blob = await toBlob(shareRef.current, { pixelRatio: 2, backgroundColor: "#f8f5ed" });
    if (!blob) return;
    const file = new File([blob], "escala-agosto-2026.png", { type: "image/png" });
    if (navigator.canShare?.({ files: [file] })) await navigator.share({ title: "Escala de agosto", text: "Escala de Obreiros — Agosto de 2026", files: [file] });
    else {
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a"); link.href = url; link.download = file.name; link.click(); URL.revokeObjectURL(url);
      announce("Imagem baixada com sucesso.");
    }
  }

  return <div className="app-shell">
    <aside className={mobileMenu ? "sidebar open" : "sidebar"}>
      <div className="brand"><div className="brand-mark"><ClipboardList size={22}/></div><div><strong>EscalaFácil</strong><small>Igreja de Brasília</small></div><button className="close-menu" onClick={() => setMobileMenu(false)} aria-label="Fechar menu"><X/></button></div>
      <nav>{nav.map(({ id, label, icon: Icon }) => <button key={id} className={view === id ? "nav-item active" : "nav-item"} onClick={() => navigate(id)}><Icon size={19}/><span>{label}</span></button>)}
        <button className={view === "workers" ? "nav-item active" : "nav-item"} onClick={() => navigate("workers")}><Users size={19}/><span>Obreiros</span></button><button className={view === "substitutions" ? "nav-item active" : "nav-item"} onClick={() => navigate("substitutions")}><RefreshCw size={19}/><span>Substituições</span></button>
      </nav>
      <div className="sidebar-bottom"><button className={view === "settings" ? "nav-item active" : "nav-item"} onClick={() => navigate("settings")}><Settings size={19}/><span>Configurações</span></button><div className="profile"><div className="avatar">NS</div><div><strong>Natanael</strong><small>Administrador</small></div></div></div>
    </aside>
    {mobileMenu && <button className="scrim" onClick={() => setMobileMenu(false)} aria-label="Fechar menu"/>}

    <main>
      <header className="topbar"><button className="menu-button" onClick={() => setMobileMenu(true)} aria-label="Abrir menu"><Menu/></button><div><span className="eyebrow">IGREJA DE BRASÍLIA</span><h1>{titles[view]}</h1></div><button className="primary desktop-action" onClick={() => setShareOpen(true)}><Share2 size={18}/> Compartilhar</button></header>
      {view === "dashboard" && <Dashboard services={scheduleServices} onNavigate={navigate} onShare={() => setShareOpen(true)}/>}
      {view === "schedule" && <SchedulePage scheduleId={scheduleId} services={scheduleServices} setServices={setScheduleServices} workers={workers} onShare={() => setShareOpen(true)} announce={announce}/>}
      {view === "rules" && <RulesPage rules={rules} setRules={setRules} announce={announce}/>}
      {view === "workers" && <WorkersPage workers={workers} setWorkers={setWorkers} announce={announce}/>}
      {view === "substitutions" && <SubstitutionsPage announce={announce}/>}
      {view === "settings" && <SettingsPage settings={churchSettings} setSettings={setChurchSettings} announce={announce}/>}
    </main>

    <nav className="bottom-nav">{nav.map(({ id, label, icon: Icon }) => <button key={id} className={view === id ? "active" : ""} onClick={() => navigate(id)}><Icon/><span>{label}</span></button>)}<button onClick={() => setShareOpen(true)}><Share2/><span>Compartilhar</span></button></nav>
    {shareOpen && <ShareModal services={scheduleServices} shareRef={shareRef} onClose={() => setShareOpen(false)} onShare={shareImage} announce={announce}/>}
    {notice && <div className="toast"><Check size={18}/>{notice}</div>}
  </div>;
}

function Dashboard({ services, onNavigate, onShare }: { services: Service[]; onNavigate: (v: View) => void; onShare: () => void }) {
  return <div className="page"><section className="hero"><div><span className="pill"><Sparkles size={15}/> Escala em revisão</span><h2>Organize o mês com tranquilidade.</h2><p>Agosto está quase pronto. Resolva uma vaga e três confirmações antes de publicar.</p><div className="hero-actions"><button className="primary" onClick={() => onNavigate("schedule")}>Revisar escala <ChevronRight size={18}/></button><button className="ghost" onClick={onShare}><Share2 size={18}/> Prévia</button></div></div><div className="progress-ring"><strong>92%</strong><span>preenchida</span></div></section>
    <section className="stats"><article><div className="stat-icon blue"><Users/></div><div><strong>28</strong><span>Obreiros ativos</span></div><small>+2 este mês</small></article><article><div className="stat-icon green"><Check/></div><div><strong>19</strong><span>Confirmações</span></div><small>76% respondidas</small></article><article><div className="stat-icon amber"><AlertTriangle/></div><div><strong>4</strong><span>Pendências</span></div><small>Requer atenção</small></article><article><div className="stat-icon purple"><Scale/></div><div><strong>4</strong><span>Regras ativas</span></div><small>Todas validadas</small></article></section>
    <div className="content-grid"><section className="panel"><div className="panel-head"><div><span className="eyebrow">PRÓXIMOS CULTOS</span><h3>Agenda da escala</h3></div><button className="text-button" onClick={() => onNavigate("schedule")}>Ver todos <ChevronRight size={16}/></button></div><div className="event-list">{services.map(service => <ServiceRow key={service.id} service={service}/>)}</div></section>
      <aside className="panel attention"><div className="panel-head"><div><span className="eyebrow">ATENÇÃO</span><h3>Antes de publicar</h3></div></div><ul><li><span className="alert-dot red"/><div><strong>Vaga na galeria</strong><small>Sexta, 14 de agosto</small></div><ChevronRight/></li><li><span className="alert-dot amber"/><div><strong>3 confirmações pendentes</strong><small>Lembre os obreiros</small></div><ChevronRight/></li><li><span className="alert-dot green"/><div><strong>Regras atendidas</strong><small>Distribuição equilibrada</small></div><Check/></li></ul><button className="secondary full" onClick={() => onNavigate("schedule")}>Resolver pendências</button></aside>
    </div>
  </div>;
}

function ServiceRow({ service }: { service: Service }) {
  const filled = service.assignments.reduce((sum, a) => sum + a.names.length, 0);
  return <article className="event-row"><div className={`date-card ${service.color}`}><strong>{service.date.split(" ")[0]}</strong><span>{service.date.split(" ")[1]}</span></div><div className="event-copy"><strong>{service.title}</strong><span>{service.weekday === "DOM" ? "Domingo" : service.weekday === "TER" ? "Terça-feira" : "Sexta-feira"} · {service.time}</span></div><div className="mini-avatars">{service.assignments.flatMap(a => a.names).slice(0, 4).map((name, i) => <span key={name}>{name.split(" ").map(p=>p[0]).slice(0,2).join("")}</span>)}<small>+{Math.max(0, filled - 4)}</small></div><span className={service.assignments.some(a => a.status === "open") ? "status warning" : "status success"}>{service.assignments.some(a => a.status === "open") ? "1 vaga" : "Completo"}</span><ChevronRight className="row-arrow"/></article>;
}

function SchedulePage({ scheduleId, services, setServices, workers, onShare, announce }: { scheduleId: string | null; services: Service[]; setServices: React.Dispatch<React.SetStateAction<Service[]>>; workers: WorkerItem[]; onShare: () => void; announce: (m: string) => void }) {
  const [editing, setEditing] = useState<Service | null>(null);
  const [editingAssignment, setEditingAssignment] = useState<{ serviceId: string | number; assignmentId: string; workerId: string; station: string; currentName: string } | null>(null);
  const [confirmGenerate, setConfirmGenerate] = useState(false);
  const regenerate = async () => {
    if (!scheduleId) return announce("A escala ainda não foi carregada do servidor.");
    try {
      const response = await fetch(`/api/schedules/${scheduleId}/regenerate`, { method: "POST" });
      if (!response.ok) throw new Error();
      const result = await response.json();
      setServices(mapSchedule(result.events, result.schedule.assignments));
      setConfirmGenerate(false); announce("Nova sugestão salva no banco. Revise antes de publicar.");
    } catch { announce("Não foi possível gerar a escala. Tente novamente."); }
  };
  const saveAssignment = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault(); if (!editingAssignment) return;
    const workerId = String(new FormData(event.currentTarget).get("workerId"));
    try {
      const response = await fetch(`/api/assignments/${editingAssignment.assignmentId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ workerId }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.message);
      setServices(current => current.map(service => service.id !== editingAssignment.serviceId ? service : { ...service, assignments: service.assignments.map(assignment => {
        if (!assignment.slots?.some(slot => slot.id === editingAssignment.assignmentId)) return assignment;
        const slots = assignment.slots.map(slot => slot.id === editingAssignment.assignmentId ? { ...slot, workerId: body.workerId, name: body.worker.displayName } : slot);
        return { ...assignment, slots, names: slots.map(slot => slot.name), status: "pending" };
      }) }));
      setEditingAssignment(null); announce("Alocação manual salva.");
    } catch (error) { announce(error instanceof Error && error.message ? error.message : "Não foi possível alterar a alocação."); }
  };
  const saveService = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault(); if (!editing) return;
    const form = new FormData(event.currentTarget);
    const title = String(form.get("title")); const date = String(form.get("date")); const time = String(form.get("time"));
    try {
      const response = await fetch(`/api/events/${editing.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title, startsAt: `${date}T${time}:00-03:00` }) });
      if (!response.ok) throw new Error();
      const updated = await response.json();
      const updatedDate = new Date(updated.startsAt);
      setServices(current => current.map(service => service.id === editing.id ? { ...service, title: updated.title, isoDate: updated.startsAt, weekday: new Intl.DateTimeFormat("pt-BR", { weekday: "short", timeZone: "America/Sao_Paulo" }).format(updatedDate).slice(0,3).toUpperCase(), date: new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", timeZone: "America/Sao_Paulo" }).format(updatedDate).replace(" de ", " ").replace(".", "").toUpperCase(), time: new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "America/Sao_Paulo" }).format(updatedDate) } : service));
      setEditing(null); announce("Culto salvo no PostgreSQL.");
    } catch { announce("Não foi possível salvar o culto."); }
  };
  return <div className="page"><div className="page-toolbar"><div className="month-switch"><button onClick={() => announce("Julho de 2026 não possui escala neste MVP.")}>‹</button><strong>Agosto de 2026</strong><button onClick={() => announce("Setembro de 2026 ainda não foi criado.")}>›</button></div><div><button className="ghost" onClick={() => setConfirmGenerate(true)}><Sparkles size={18}/> Gerar novamente</button><button className="primary" onClick={onShare}><MessageCircle size={18}/> Compartilhar</button></div></div><div className="month-summary"><CalendarDays/><strong>{services.length} cultos no mês</strong><span>Todos os cultos de agosto estão visíveis abaixo.</span></div><div className="schedule-grid">{services.map(service => <article className="service-card" key={service.id}><div className="service-head"><div className={`large-date ${service.color}`}><strong>{service.date.split(" ")[0]}</strong><span>{service.date.split(" ")[1]}</span></div><div><span className="eyebrow">{service.weekday} · {service.time}</span><h3>{service.title}</h3></div><button className="icon-button edit-service" aria-label={`Editar ${service.title}`} onClick={() => setEditing(service)}>•••</button></div><div className="assignment-list">{service.assignments.map(a => <div key={a.station} className={a.status === "open" ? "assignment open-slot" : "assignment"}><span>{a.station}</span><div className="assignment-workers">{a.slots?.map(slot => <button key={slot.id} onClick={() => setEditingAssignment({ serviceId: service.id, assignmentId: slot.id, workerId: slot.workerId, station: a.station, currentName: slot.name })}>{slot.name}<span>Editar</span></button>)}{!a.slots?.length && <strong>+ Preencher vaga</strong>}</div>{a.status === "confirmed" ? <Check className="ok"/> : a.status === "pending" ? <span className="pending-dot"/> : <Plus/>}</div>)}</div></article>)}</div>
    {confirmGenerate && <div className="modal-backdrop"><section className="confirm-modal"><div className="stat-icon purple"><Sparkles/></div><h2>Gerar uma nova distribuição?</h2><p>Os nomes atuais serão reorganizados e todas as confirmações voltarão para pendentes. A alteração permanece em revisão.</p><div className="modal-actions"><button className="ghost" onClick={() => setConfirmGenerate(false)}>Cancelar</button><button className="primary" onClick={regenerate}>Gerar nova sugestão</button></div></section></div>}
    {editing && <div className="modal-backdrop"><form className="form-modal" onSubmit={saveService}><div className="modal-head"><div><span className="eyebrow">EDITAR CULTO</span><h2>{editing.title}</h2></div><button type="button" className="icon-button" onClick={() => setEditing(null)}><X/></button></div><label>Nome do culto<input name="title" defaultValue={editing.title} required/></label><div className="form-grid"><label>Data<input name="date" type="date" defaultValue={(editing.isoDate ?? "2026-08-09").slice(0,10)} required/></label><label>Horário<input name="time" type="time" defaultValue={editing.time} required/></label></div><div className="modal-actions"><button type="button" className="ghost" onClick={() => setEditing(null)}>Cancelar</button><button type="submit" className="primary"><Save size={17}/> Salvar culto</button></div></form></div>}
    {editingAssignment && <div className="modal-backdrop"><form className="form-modal" onSubmit={saveAssignment}><div className="modal-head"><div><span className="eyebrow">ALOCAÇÃO MANUAL</span><h2>{editingAssignment.station}</h2></div><button type="button" className="icon-button" onClick={() => setEditingAssignment(null)}><X/></button></div><p className="form-help">Substitua {editingAssignment.currentName} por outro obreiro. As regras e a disponibilidade serão validadas.</p><label>Obreiro<select name="workerId" defaultValue={editingAssignment.workerId}>{workers.filter(worker => worker.active && !worker.temporarilyUnavailable).map(worker => <option key={worker.id} value={worker.id}>{worker.name} · {worker.role}</option>)}</select></label><div className="modal-actions"><button type="button" className="ghost" onClick={() => setEditingAssignment(null)}>Cancelar</button><button type="submit" className="primary"><Save size={17}/> Salvar alocação</button></div></form></div>}
  </div>;
}

function RulesPage({ rules, setRules, announce }: { rules: typeof initialRules; setRules: React.Dispatch<React.SetStateAction<typeof initialRules>>; announce: (m: string) => void }) {
  return <div className="page"><section className="rules-intro"><div><span className="pill"><ShieldCheck size={15}/> Motor de regras</span><h2>As regras trabalham por você.</h2><p>Critérios obrigatórios bloqueiam conflitos. Preferências orientam o gerador quando existem várias opções válidas.</p></div><button className="primary" onClick={() => announce("Editor de nova regra pronto para a próxima etapa.")}><Plus size={18}/> Nova regra</button></section><div className="rule-list">{rules.map(rule => <article className="rule-card" key={rule.id}><div className={`rule-symbol ${rule.kind === "Obrigatória" ? "required" : "preferred"}`}>{rule.icon === "shield" ? <ShieldCheck/> : rule.icon === "balance" ? <Scale/> : rule.icon === "repeat" ? <RefreshCw/> : <CalendarDays/>}</div><div className="rule-copy"><div><h3>{rule.name}</h3><span className={rule.kind === "Obrigatória" ? "tag required" : "tag preferred"}>{rule.kind}</span></div><p>{rule.description}</p></div><label className="switch"><input type="checkbox" checked={rule.active} onChange={() => setRules(current => current.map(item => item.id === rule.id ? { ...item, active: !item.active } : item))}/><span/></label><button className="icon-button"><ChevronRight/></button></article>)}</div></div>;
}

function WorkersPage({ workers, setWorkers, announce }: { workers: WorkerItem[]; setWorkers: React.Dispatch<React.SetStateAction<WorkerItem[]>>; announce: (m: string) => void }) {
  const [query, setQuery] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [selected, setSelected] = useState<WorkerItem | null>(null);
  const [availabilityMode, setAvailabilityMode] = useState<AvailabilityMode>("ALL");
  const [availableDates, setAvailableDates] = useState<string[]>([]);
  const [newDate, setNewDate] = useState("");
  const filtered = workers.filter(worker => `${worker.name} ${worker.role}`.toLowerCase().includes(query.toLowerCase()));
  const saveWorker = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const name = String(form.get("name") || "").trim();
    if (!name) return;
    try {
      const response = await fetch(selected ? `/api/workers/${selected.id}` : "/api/workers", { method: selected ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ displayName: name, roleName: String(form.get("role")), phone: String(form.get("phone")), active: selected?.active ?? true, availabilityMode, availableWeekdays: form.getAll("weekdays").map(Number), availableDates: availableDates.map(date => `${date}T12:00:00.000Z`), temporarilyUnavailable: form.get("temporarilyUnavailable") === "on" }) });
      if (!response.ok) throw new Error();
      const worker = mapWorker(await response.json());
      setWorkers(current => selected ? current.map(item => item.id === selected.id ? worker : item) : [...current, worker].sort((a,b) => a.name.localeCompare(b.name)));
      setFormOpen(false); setSelected(null); announce(selected ? "Cadastro salvo no PostgreSQL." : "Obreiro salvo no PostgreSQL.");
    } catch { announce("Não foi possível salvar o obreiro."); }
  };
  const openEditor = (worker?: WorkerItem) => { setSelected(worker ?? null); setAvailabilityMode(worker?.availabilityMode ?? "ALL"); setAvailableDates(worker?.availableDates ?? []); setNewDate(""); setFormOpen(true); };
  const weekdayOptions = [[0,"Dom"],[1,"Seg"],[2,"Ter"],[3,"Qua"],[4,"Qui"],[5,"Sex"],[6,"Sáb"]] as const;
  return <div className="page"><div className="section-toolbar"><div className="search-box"><Search/><input aria-label="Pesquisar obreiros" placeholder="Pesquisar por nome ou função" value={query} onChange={event => setQuery(event.target.value)}/></div><button className="primary" onClick={() => openEditor()}><UserPlus size={18}/> Novo obreiro</button></div><div className="summary-strip"><span><strong>{workers.filter(w => w.active && !w.temporarilyUnavailable).length}</strong> disponíveis</span><span><strong>{workers.filter(w => w.temporarilyUnavailable).length}</strong> indisponíveis temporariamente</span><span><strong>{workers.reduce((total,w) => total + w.assignments, 0)}</strong> designações no mês</span></div><section className="table-card"><div className="table-head"><span>Obreiro</span><span>Função</span><span>Telefone</span><span>Escalas</span><span>Status</span></div>{filtered.map(worker => <button className="worker-row" key={worker.id} onClick={() => openEditor(worker)}><div className="worker-name"><div className="avatar small">{worker.name.split(" ").map(part=>part[0]).slice(0,2).join("")}</div><strong>{worker.name}</strong></div><span>{worker.role}</span><span>{worker.phone}</span><strong>{worker.assignments}</strong><span className={worker.temporarilyUnavailable ? "status warning" : worker.active ? "status success" : "status muted"}>{worker.temporarilyUnavailable ? "Indisponível" : worker.active ? "Ativo" : "Inativo"}</span></button>)}{filtered.length === 0 && <div className="empty-state">Nenhum obreiro encontrado.</div>}</section>
    {formOpen && <div className="modal-backdrop"><form className="form-modal worker-form" onSubmit={saveWorker}><div className="modal-head"><div><span className="eyebrow">CADASTRO</span><h2>{selected ? "Editar obreiro" : "Novo obreiro"}</h2></div><button type="button" className="icon-button" onClick={() => setFormOpen(false)}><X/></button></div><label>Nome de exibição<input name="name" defaultValue={selected?.name} placeholder="Nome usado na escala" autoFocus/></label><div className="form-grid"><label>Função<select name="role" defaultValue={selected?.role ?? "Auxiliar"}><option>Auxiliar</option><option>Diácono</option><option>Presbítero</option></select></label><label>Telefone<input name="phone" defaultValue={selected?.phone} placeholder="(61) 99999-9999"/></label></div><div className="availability-box"><div><span className="eyebrow">DISPONIBILIDADE</span><h3>Quando pode entrar na escala?</h3></div><label>Forma de disponibilidade<select value={availabilityMode} onChange={event => setAvailabilityMode(event.target.value as AvailabilityMode)}><option value="ALL">Todos os dias</option><option value="WEEKDAYS">Somente em dias da semana escolhidos</option><option value="DATES">Somente em datas específicas</option></select></label>{availabilityMode === "WEEKDAYS" && <div className="weekday-picker">{weekdayOptions.map(([value,label]) => <label key={value}><input type="checkbox" name="weekdays" value={value} defaultChecked={selected?.availableWeekdays.includes(value)}/><span>{label}</span></label>)}</div>}{availabilityMode === "DATES" && <div><div className="date-adder"><input type="date" value={newDate} onChange={event => setNewDate(event.target.value)}/><button type="button" className="secondary" onClick={() => { if (newDate && !availableDates.includes(newDate)) setAvailableDates(current => [...current, newDate].sort()); setNewDate(""); }}><Plus size={16}/> Adicionar</button></div><div className="date-chips">{availableDates.map(date => <button type="button" key={date} onClick={() => setAvailableDates(current => current.filter(item => item !== date))}>{new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC" }).format(new Date(`${date}T12:00:00Z`))}<X size={13}/></button>)}</div></div>}<label className="temporary-toggle"><input type="checkbox" name="temporarilyUnavailable" defaultChecked={selected?.temporarilyUnavailable}/><span><strong>Temporariamente indisponível</strong><small>Não será incluído em nenhuma geração até esta opção ser desmarcada.</small></span></label></div><div className="modal-actions">{selected && <button type="button" className="ghost" onClick={async () => { try { const response = await fetch(`/api/workers/${selected.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ active: !selected.active }) }); if (!response.ok) throw new Error(); const worker = mapWorker(await response.json()); setWorkers(current => current.map(item => item.id === selected.id ? worker : item)); setFormOpen(false); announce(selected.active ? "Obreiro inativado no banco." : "Obreiro reativado no banco."); } catch { announce("Não foi possível alterar o status."); } }}>{selected.active ? "Inativar" : "Reativar"}</button>}<button className="primary" type="submit"><Save size={17}/> Salvar</button></div></form></div>}
  </div>;
}

function SubstitutionsPage({ announce }: { announce: (m: string) => void }) {
  const [requests, setRequests] = useState([{ id: 1, from: "Davi Oiticica", to: "Pedro", date: "14/08/2026", station: "Lateral esquerdo", status: "Pendente" }]);
  return <div className="page"><section className="simple-hero"><div className="stat-icon amber"><RefreshCw/></div><div><span className="eyebrow">TROCAS E IMPREVISTOS</span><h2>Pedidos de substituição</h2><p>Aprove as trocas antes que elas alterem a escala publicada.</p></div></section><section className="table-card substitutions"><div className="table-head"><span>Solicitante</span><span>Substituto</span><span>Data e posto</span><span>Status</span><span>Ações</span></div>{requests.map(request => <div className="substitution-row" key={request.id}><strong>{request.from}</strong><span>{request.to}</span><span>{request.date}<small>{request.station}</small></span><span className="status warning">{request.status}</span><div><button className="ghost" onClick={() => { setRequests(current => current.filter(item => item.id !== request.id)); announce("Substituição recusada."); }}>Recusar</button><button className="secondary" onClick={() => { setRequests(current => current.map(item => item.id === request.id ? {...item,status:"Aprovada"} : item)); announce("Substituição aprovada e registrada."); }}>Aprovar</button></div></div>)}{requests.length === 0 && <div className="empty-state">Não existem solicitações pendentes.</div>}</section></div>;
}

function SettingsPage({ settings, setSettings, announce }: { settings: { name: string; timezone: string }; setSettings: React.Dispatch<React.SetStateAction<{ name: string; timezone: string }>>; announce: (m: string) => void }) {
  const [tab, setTab] = useState("geral");
  return <div className="page settings-page"><div className="settings-tabs"><button className={tab === "geral" ? "active" : ""} onClick={() => setTab("geral")}>Geral</button><button className={tab === "cultos" ? "active" : ""} onClick={() => setTab("cultos")}>Cultos e postos</button><button className={tab === "compartilhar" ? "active" : ""} onClick={() => setTab("compartilhar")}>Compartilhamento</button></div>{tab === "geral" && <form className="settings-card" onSubmit={async event => { event.preventDefault(); const form = new FormData(event.currentTarget); try { const response = await fetch("/api/church", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: String(form.get("name")), timezone: String(form.get("timezone")) }) }); if (!response.ok) throw new Error(); const saved = await response.json(); setSettings({ name: saved.name, timezone: saved.timezone }); announce("Configurações salvas no PostgreSQL."); } catch { announce("Não foi possível salvar as configurações."); } }}><div className="settings-title"><Building2/><div><h3>Dados da congregação</h3><p>Informações exibidas nas escalas e comunicações.</p></div></div><label>Nome da congregação<input name="name" defaultValue={settings.name}/></label><div className="form-grid"><label>Fuso horário<select name="timezone" defaultValue={settings.timezone}><option value="America/Sao_Paulo">Brasília — America/Sao_Paulo</option></select></label><label>Telefone<input placeholder="Telefone institucional"/></label></div><button className="primary save-button"><Save/> Salvar alterações</button></form>}{tab === "cultos" && <section className="settings-card"><div className="settings-title"><CalendarDays/><div><h3>Cultos e postos</h3><p>Defina os horários e a quantidade padrão de vagas.</p></div></div>{[["Domingo","18:00"],["Terça-feira","19:30"],["Sexta-feira","19:30"]].map(item => <div className="config-row" key={item[0]}><strong>{item[0]}</strong><span>{item[1]}</span><button className="ghost" onClick={() => announce(`Use a tela Escalas para editar cada ocorrência de ${item[0]}.`)}>Editar</button></div>)}</section>}{tab === "compartilhar" && <form className="settings-card" onSubmit={event => { event.preventDefault(); announce("Preferências de compartilhamento salvas neste navegador."); }}><div className="settings-title"><Share2/><div><h3>Arte para WhatsApp</h3><p>Escolha como a escala será apresentada ao grupo.</p></div></div><label>Divisão da imagem<select defaultValue="quinzenal"><option value="mensal">Mês completo</option><option value="quinzenal">Por quinzena</option><option value="semanal">Por semana</option></select></label><label className="check-line"><input type="checkbox" defaultChecked/> Exibir QR Code para a versão atualizada</label><label className="check-line"><input type="checkbox" defaultChecked/> Exibir número da versão e data de publicação</label><button className="primary save-button"><Save/> Salvar preferências</button></form>}</div>;
}

function ShareModal({ services, shareRef, onClose, onShare, announce }: { services: Service[]; shareRef: React.RefObject<HTMLDivElement | null>; onClose: () => void; onShare: () => void; announce: (m: string) => void }) {
  const referenceDate = services[0]?.isoDate ? new Date(services[0].isoDate) : new Date("2026-08-01T12:00:00Z");
  const month = Number(new Intl.DateTimeFormat("en-US", { month: "numeric", timeZone: "America/Sao_Paulo" }).format(referenceDate)) - 1;
  const year = Number(new Intl.DateTimeFormat("en-US", { year: "numeric", timeZone: "America/Sao_Paulo" }).format(referenceDate));
  const firstWeekday = new Date(Date.UTC(year, month, 1, 12)).getUTCDay();
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0, 12)).getUTCDate();
  const servicesByWeek = new Map<number, Service[]>();
  services.forEach(service => {
    const day = Number(service.date.split(" ")[0]);
    const week = Math.floor((firstWeekday + day - 1) / 7);
    servicesByWeek.set(week, [...(servicesByWeek.get(week) ?? []), service]);
  });
  const calendarWeeks = [...servicesByWeek.entries()].sort(([a], [b]) => a - b).map(([week, weekServices]) => ({
    week,
    start: Math.max(1, week * 7 - firstWeekday + 1),
    end: Math.min(daysInMonth, week * 7 - firstWeekday + 7),
    services: weekServices.sort((a, b) => Number(a.date.split(" ")[0]) - Number(b.date.split(" ")[0]))
  }));
  const monthLabel = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric", timeZone: "America/Sao_Paulo" }).format(referenceDate).toUpperCase();
  return <div className="modal-backdrop"><section className="share-modal calendar-share-modal"><div className="modal-head"><div><span className="eyebrow">PRÉVIA PARA WHATSAPP</span><h2>Calendário mensal da escala</h2></div><button className="icon-button" onClick={onClose} aria-label="Fechar compartilhamento"><X/></button></div><div className="share-layout calendar-share-layout"><div className="poster-wrap calendar-poster-wrap"><div className="poster calendar-poster" ref={shareRef}><div className="calendar-poster-top"><div className="poster-logo"><ClipboardList/></div><div><span>IGREJA DE BRASÍLIA</span><h2>Escala de Obreiros</h2></div><strong>{monthLabel}</strong></div><div className="calendar-weeks">{calendarWeeks.map((week, index) => <section className="calendar-week" key={week.week}><div className="calendar-week-head"><strong>SEMANA {index + 1}</strong><span>{String(week.start).padStart(2,"0")} A {String(week.end).padStart(2,"0")} · AGO</span></div><div className="calendar-cult-days">{week.services.map(service => <article className={`calendar-cult-day ${service.color}`} key={service.id}><div className="calendar-cult-date"><strong>{service.date.split(" ")[0]}</strong><span>{service.weekday}</span></div><div className="calendar-service-title"><strong>{service.title}</strong><span>{service.time}</span></div><div className="calendar-assignments">{service.assignments.map(assignment => <div key={assignment.station}><span>{assignment.station}</span><strong>{assignment.names.length ? assignment.names.join(" · ") : "A definir"}</strong></div>)}</div></article>)}</div></section>)}</div><div className="poster-footer">Versão 1 · Consulte sempre a versão atualizada antes de cada culto</div></div></div><div className="share-options"><h3>Compartilhar calendário</h3><p>A escala mostra somente os dias com culto, agrupados por semana, deixando os nomes maiores e mais fáceis de localizar.</p><button className="whatsapp" onClick={onShare}><MessageCircle/> Compartilhar imagem</button><button className="ghost full" onClick={onShare}><Download/> Baixar PNG</button><button className="ghost full" onClick={() => announce("Link público copiado.")}><Share2/> Copiar link público</button><button className="ghost full" onClick={() => announce("Exportação em PDF será adicionada na próxima versão.")}><FileText/> Exportar PDF</button><div className="version-note"><Check/><div><strong>Mês completo</strong><span>Somente os dias com culto são exibidos.</span></div></div></div></div></section></div>;
}
