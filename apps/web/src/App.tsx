import { useRef, useState } from "react";
import { toBlob } from "html-to-image";
import { AlertTriangle, CalendarDays, Check, ChevronRight, ClipboardList, Download, FileText, LayoutDashboard, Menu, MessageCircle, Plus, RefreshCw, Scale, Settings, Share2, ShieldCheck, Sparkles, Users, X } from "lucide-react";
import { initialRules, services, type Service } from "./data";

type View = "dashboard" | "schedule" | "rules";
const nav = [
  { id: "dashboard" as View, label: "Visão geral", icon: LayoutDashboard },
  { id: "schedule" as View, label: "Escalas", icon: CalendarDays },
  { id: "rules" as View, label: "Regras", icon: ShieldCheck }
];

export default function App() {
  const [view, setView] = useState<View>("dashboard");
  const [rules, setRules] = useState(initialRules);
  const [mobileMenu, setMobileMenu] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [notice, setNotice] = useState("");
  const shareRef = useRef<HTMLDivElement>(null);

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
        <button className="nav-item"><Users size={19}/><span>Obreiros</span></button><button className="nav-item"><RefreshCw size={19}/><span>Substituições</span></button>
      </nav>
      <div className="sidebar-bottom"><button className="nav-item"><Settings size={19}/><span>Configurações</span></button><div className="profile"><div className="avatar">NS</div><div><strong>Natanael</strong><small>Administrador</small></div></div></div>
    </aside>
    {mobileMenu && <button className="scrim" onClick={() => setMobileMenu(false)} aria-label="Fechar menu"/>}

    <main>
      <header className="topbar"><button className="menu-button" onClick={() => setMobileMenu(true)} aria-label="Abrir menu"><Menu/></button><div><span className="eyebrow">AGOSTO DE 2026</span><h1>{view === "dashboard" ? "Olá, Natanael" : view === "schedule" ? "Escala mensal" : "Regras de distribuição"}</h1></div><button className="primary desktop-action" onClick={() => setShareOpen(true)}><Share2 size={18}/> Compartilhar</button></header>
      {view === "dashboard" && <Dashboard onNavigate={navigate} onShare={() => setShareOpen(true)}/>}
      {view === "schedule" && <SchedulePage onShare={() => setShareOpen(true)} announce={announce}/>}
      {view === "rules" && <RulesPage rules={rules} setRules={setRules} announce={announce}/>}
    </main>

    <nav className="bottom-nav">{nav.map(({ id, label, icon: Icon }) => <button key={id} className={view === id ? "active" : ""} onClick={() => navigate(id)}><Icon/><span>{label}</span></button>)}<button onClick={() => setShareOpen(true)}><Share2/><span>Compartilhar</span></button></nav>
    {shareOpen && <ShareModal shareRef={shareRef} onClose={() => setShareOpen(false)} onShare={shareImage} announce={announce}/>} 
    {notice && <div className="toast"><Check size={18}/>{notice}</div>}
  </div>;
}

function Dashboard({ onNavigate, onShare }: { onNavigate: (v: View) => void; onShare: () => void }) {
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

function SchedulePage({ onShare, announce }: { onShare: () => void; announce: (m: string) => void }) {
  return <div className="page"><div className="page-toolbar"><div className="month-switch"><button>‹</button><strong>Agosto de 2026</strong><button>›</button></div><div><button className="ghost"><Sparkles size={18}/> Gerar novamente</button><button className="primary" onClick={onShare}><MessageCircle size={18}/> Compartilhar</button></div></div><div className="schedule-grid">{services.map(service => <article className="service-card" key={service.id}><div className="service-head"><div className={`large-date ${service.color}`}><strong>{service.date.split(" ")[0]}</strong><span>{service.date.split(" ")[1]}</span></div><div><span className="eyebrow">{service.weekday} · {service.time}</span><h3>{service.title}</h3></div><button className="icon-button">•••</button></div><div className="assignment-list">{service.assignments.map(a => <button key={a.station} className={a.status === "open" ? "assignment open-slot" : "assignment"} onClick={() => a.status === "open" && announce("Seleção de obreiro aberta.")}><span>{a.station}</span><strong>{a.names.length ? a.names.join(" · ") : "+ Preencher vaga"}</strong>{a.status === "confirmed" ? <Check className="ok"/> : a.status === "pending" ? <span className="pending-dot"/> : <Plus/>}</button>)}</div></article>)}</div></div>;
}

function RulesPage({ rules, setRules, announce }: { rules: typeof initialRules; setRules: React.Dispatch<React.SetStateAction<typeof initialRules>>; announce: (m: string) => void }) {
  return <div className="page"><section className="rules-intro"><div><span className="pill"><ShieldCheck size={15}/> Motor de regras</span><h2>As regras trabalham por você.</h2><p>Critérios obrigatórios bloqueiam conflitos. Preferências orientam o gerador quando existem várias opções válidas.</p></div><button className="primary" onClick={() => announce("Editor de nova regra pronto para a próxima etapa.")}><Plus size={18}/> Nova regra</button></section><div className="rule-list">{rules.map(rule => <article className="rule-card" key={rule.id}><div className={`rule-symbol ${rule.kind === "Obrigatória" ? "required" : "preferred"}`}>{rule.icon === "shield" ? <ShieldCheck/> : rule.icon === "balance" ? <Scale/> : rule.icon === "repeat" ? <RefreshCw/> : <CalendarDays/>}</div><div className="rule-copy"><div><h3>{rule.name}</h3><span className={rule.kind === "Obrigatória" ? "tag required" : "tag preferred"}>{rule.kind}</span></div><p>{rule.description}</p></div><label className="switch"><input type="checkbox" checked={rule.active} onChange={() => setRules(current => current.map(item => item.id === rule.id ? { ...item, active: !item.active } : item))}/><span/></label><button className="icon-button"><ChevronRight/></button></article>)}</div></div>;
}

function ShareModal({ shareRef, onClose, onShare, announce }: { shareRef: React.RefObject<HTMLDivElement | null>; onClose: () => void; onShare: () => void; announce: (m: string) => void }) {
  return <div className="modal-backdrop"><section className="share-modal"><div className="modal-head"><div><span className="eyebrow">PRÉVIA PARA WHATSAPP</span><h2>Escala pronta para compartilhar</h2></div><button className="icon-button" onClick={onClose}><X/></button></div><div className="share-layout"><div className="poster-wrap"><div className="poster" ref={shareRef}><div className="poster-top"><div className="poster-logo"><ClipboardList/></div><span>IGREJA DE BRASÍLIA</span><h2>Escala de Obreiros</h2><strong>AGOSTO · 2026</strong></div><div className="poster-services">{services.map(service => <div className="poster-service" key={service.id}><div><strong>{service.date}</strong><span>{service.title} · {service.time}</span></div><dl>{service.assignments.map(a => <div key={a.station}><dt>{a.station}</dt><dd>{a.names.length ? a.names.join(" · ") : "A definir"}</dd></div>)}</dl></div>)}</div><div className="poster-footer">Versão 1 · Consulte sempre a versão atualizada</div></div></div><div className="share-options"><h3>Compartilhar escala</h3><p>A imagem foi otimizada para leitura no celular. Informações pessoais não são incluídas.</p><button className="whatsapp" onClick={onShare}><MessageCircle/> Compartilhar imagem</button><button className="ghost full" onClick={onShare}><Download/> Baixar PNG</button><button className="ghost full" onClick={() => announce("Link público copiado.")}><Share2/> Copiar link público</button><button className="ghost full" onClick={() => announce("Exportação em PDF será adicionada na próxima versão.")}><FileText/> Exportar PDF</button><div className="version-note"><Check/><div><strong>Versão identificada</strong><span>Alterações futuras gerarão uma nova versão.</span></div></div></div></div></section></div>;
}
