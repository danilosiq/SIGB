export type Role = "ALUNO" | "ADMIN" | "BIBLIOTECARIO";
export type User = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: Role;
  blocked: boolean;
};
export type Book = {
  id: string;
  title: string;
  author: string;
  isbn: string;
  category: string;
  sector?: string | null;
  shelf?: string | null;
  description: string;
  publisher: string;
  year: number;
  pages: number;
  format?: string;
  readingUrl?: string | null;
  source?: string | null;
  available: boolean;
  coverUrl: string | null;
};
export type Loan = {
  id: string;
  bookId: string;
  userId: string;
  borrowedAt: string;
  dueAt: string;
  returnedAt: string | null;
  pickupAt: string | null;
  pickupConfirmedAt: string | null;
  fineCents: number;
  renewals: number;
  book: { title: string; author: string };
  user: { name: string; email: string };
};
export type Notification = {
  id: string;
  type: string;
  message: string;
  status: "PROCESSANDO" | "ENVIADA" | "FALHA";
  createdAt: string;
  readAt: string | null;
  deliveries: {
    id: string;
    channel: string;
    status: string;
    attempts: number;
    lastError: string | null;
  }[];
};
export type View =
  | "catalog"
  | "overview"
  | "loans"
  | "users"
  | "notifications"
  | "profile"
  | "open-library";
