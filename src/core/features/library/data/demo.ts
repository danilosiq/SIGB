import type { Book, Loan, User, Notification, Role } from "@/core/@types";
export const roles: Record<Role, string> = {
  ALUNO: "Aluno",
  ADMIN: "Administrador",
  BIBLIOTECARIO: "Bibliotecário",
};
export const demoUser: User = {
  id: "demo-aluno",
  name: "Marina Oliveira",
  email: "marina@universidade.edu.br",
  phone: "+55 11 99999-1234",
  role: "ALUNO",
  blocked: false,
};
export const demoBooks: Book[] = [
  {
    id: "1",
    title: "A biblioteca da meia-noite",
    author: "Matt Haig",
    isbn: "9786558380542",
    category: "Ficção",
    description:
      "Entre a vida e a morte existe uma biblioteca. Cada livro oferece uma chance de experimentar outra vida e descobrir o que realmente faz a nossa valer a pena.",
    publisher: "Bertrand Brasil",
    year: 2021,
    pages: 308,
    available: true,
    coverUrl: "/covers/midnight.svg",
  },
  {
    id: "2",
    title: "Hábitos atômicos",
    author: "James Clear",
    isbn: "9788550807560",
    category: "Desenvolvimento pessoal",
    description:
      "Pequenas mudanças, resultados extraordinários. Um guia prático sobre como construir bons hábitos e transformar pequenas escolhas em grandes conquistas.",
    publisher: "Alta Books",
    year: 2019,
    pages: 320,
    available: true,
    coverUrl: "/covers/habits.svg",
  },
  {
    id: "3",
    title: "O pequeno príncipe",
    author: "Antoine de Saint-Exupéry",
    isbn: "9788522031447",
    category: "Literatura",
    description:
      "Uma viagem delicada por planetas, amizades e descobertas. Um encontro com o essencial, que só pode ser visto com o coração.",
    publisher: "Agir",
    year: 2015,
    pages: 96,
    available: false,
    coverUrl: "/covers/prince.svg",
  },
  {
    id: "4",
    title: "Sapiens: uma breve história da humanidade",
    author: "Yuval Noah Harari",
    isbn: "9788525432186",
    category: "História",
    description:
      "Da Idade da Pedra à era digital, uma investigação sobre as ideias e revoluções que moldaram a humanidade e o mundo em que vivemos.",
    publisher: "L&PM",
    year: 2015,
    pages: 464,
    available: true,
    coverUrl: "/covers/sapiens.svg",
  },
  {
    id: "5",
    title: "Dom Casmurro",
    author: "Machado de Assis",
    isbn: "9788535914849",
    category: "Literatura",
    description:
      "Memória, ciúme e imaginação se encontram nas lembranças de Bentinho. Um dos romances mais marcantes da literatura brasileira.",
    publisher: "Companhia das Letras",
    year: 2016,
    pages: 256,
    available: true,
    coverUrl: "/covers/casmurro.svg",
  },
  {
    id: "6",
    title: "O design do dia a dia",
    author: "Don Norman",
    isbn: "9788532520838",
    category: "Design",
    description:
      "Como o design influencia nossas ações e por que alguns objetos são tão fáceis de usar. Um olhar sobre a relação entre pessoas e produtos.",
    publisher: "Rocco",
    year: 2006,
    pages: 272,
    available: true,
    coverUrl: "/covers/design.svg",
  },
  {
    id: "7",
    title: "O poder do hábito",
    author: "Charles Duhigg",
    isbn: "9788539004119",
    category: "Desenvolvimento pessoal",
    description:
      "O que fazemos, por que fazemos e como podemos mudar. Uma exploração dos padrões que influenciam as pessoas e as organizações.",
    publisher: "Objetiva",
    year: 2012,
    pages: 408,
    available: false,
    coverUrl: "/covers/power.svg",
  },
  {
    id: "8",
    title: "Uma breve história do tempo",
    author: "Stephen Hawking",
    isbn: "9788580576467",
    category: "Ciência",
    description:
      "Uma jornada pelo espaço e pelo tempo, dos buracos negros à origem do universo, apresentada com curiosidade e clareza.",
    publisher: "Intrínseca",
    year: 2015,
    pages: 256,
    available: true,
    coverUrl: "/covers/time.svg",
  },
];
export const demoUsers: User[] = [
  demoUser,
  {
    id: "demo-staff",
    name: "Rafael Santos",
    email: "rafael@sigb.edu.br",
    phone: null,
    role: "BIBLIOTECARIO",
    blocked: false,
  },
  {
    id: "demo-admin",
    name: "Beatriz Lima",
    email: "beatriz@sigb.edu.br",
    phone: null,
    role: "ADMIN",
    blocked: false,
  },
  {
    id: "demo-other",
    name: "Pedro Costa",
    email: "pedro@universidade.edu.br",
    phone: null,
    role: "ALUNO",
    blocked: true,
  },
];
export function demoLoans(): Loan[] {
  const now = Date.now();
  return [2, 6].map((index, i) => ({
    id: "loan-" + i,
    bookId: demoBooks[index].id,
    userId: demoUser.id,
    borrowedAt: new Date(now - 7 * 86400000).toISOString(),
    dueAt: new Date(now + (i ? 8 : 2) * 86400000).toISOString(),
    returnedAt: null,
    pickupAt: null,
    pickupConfirmedAt: new Date(now - 7 * 86400000).toISOString(),
    fineCents: 0,
    renewals: 0,
    book: { title: demoBooks[index].title, author: demoBooks[index].author },
    user: { name: demoUser.name, email: demoUser.email },
  }));
}
export function demoNotifications(): Notification[] {
  return [
    {
      id: "notification-demo",
      type: "PRAZO_PROXIMO",
      message:
        "Sua próxima aventura está esperando! O prazo de devolução de “O pequeno príncipe” termina em dois dias.",
      status: "ENVIADA",
      createdAt: new Date().toISOString(),
      deliveries: [
        {
          id: "delivery-demo",
          channel: "EMAIL",
          status: "ENVIADA",
          attempts: 1,
          lastError: null,
        },
      ],
    },
  ];
}
