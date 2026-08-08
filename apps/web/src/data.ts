export type AssignmentSlot = { id: string; workerId: string; name: string };
export type Assignment = { station: string; names: string[]; slots?: AssignmentSlot[]; status?: "confirmed" | "pending" | "open" };
export type Service = { id: number | string; weekday: string; date: string; isoDate?: string; time: string; title: string; color: string; eventCode?: string; visible?: boolean; assignments: Assignment[] };

export const services: Service[] = [
  { id: 1, weekday: "DOM", date: "09 AGO", time: "18:00", title: "Santa Ceia", color: "purple", assignments: [
    { station: "Portaria", names: ["Alexandre (Gelo)", "Alexandro Correia"], status: "confirmed" },
    { station: "Recepção", names: ["Amaro"], status: "confirmed" },
    { station: "Lateral esquerdo", names: ["Davi Oiticica"], status: "pending" },
    { station: "Lateral direito", names: ["Fernando"], status: "confirmed" },
    { station: "Galeria", names: ["Danilo Oiticica"], status: "confirmed" },
    { station: "Escadaria", names: ["Raniery", "Naldo"], status: "pending" }
  ]},
  { id: 2, weekday: "TER", date: "11 AGO", time: "19:30", title: "Culto de terça-feira", color: "teal", assignments: [
    { station: "Portaria", names: ["José Erinaldo", "Josival (Vava)"], status: "confirmed" },
    { station: "Recepção", names: ["Juliano"], status: "confirmed" },
    { station: "Lateral esquerdo", names: ["Júnior"], status: "pending" },
    { station: "Lateral direito", names: ["Manoel Carvalho"], status: "confirmed" },
    { station: "Galeria", names: ["Manoel Tenório"], status: "confirmed" },
    { station: "Escadaria", names: ["Rafael", "Marcos André"], status: "confirmed" }
  ]},
  { id: 3, weekday: "SEX", date: "14 AGO", time: "19:30", title: "Culto de sexta-feira", color: "gold", assignments: [
    { station: "Portaria", names: ["Pedro", "Reinaldo"], status: "confirmed" },
    { station: "Recepção", names: ["Ailson"], status: "pending" },
    { station: "Lateral esquerdo", names: ["Dionísio"], status: "confirmed" },
    { station: "Lateral direito", names: ["Edvanio Souza"], status: "confirmed" },
    { station: "Galeria", names: [], status: "open" },
    { station: "Escadaria", names: ["Jonathan", "Leandro"], status: "confirmed" }
  ]}
];

export const initialRules = [
  { id: 1, name: "Uma sexta-feira livre", description: "Cada obreiro terá ao menos uma sexta-feira livre por mês.", kind: "Obrigatória", active: true, icon: "calendar" },
  { id: 2, name: "Santa Ceia somente com auxiliares", description: "Somente auxiliares podem ser escalados em cultos de Santa Ceia.", kind: "Obrigatória", active: true, icon: "shield" },
  { id: 3, name: "Equilibrar carga mensal", description: "Priorizar quem serviu menos vezes no período.", kind: "Preferencial", active: true, icon: "balance" },
  { id: 4, name: "Alternar postos", description: "Evitar repetir o mesmo posto em escalas consecutivas.", kind: "Preferencial", active: true, icon: "repeat" }
];
