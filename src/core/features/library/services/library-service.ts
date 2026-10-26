import { api } from "@/core/services/api-service";
import type { Book, Loan, User, Notification } from "@/core/@types";
export const libraryService = {
  config: async () =>
    (
      await api.get<{
        demo: boolean;
        policy: { loanDays: number; dailyFineCents: number };
      }>("/config")
    ).data,
  me: async () => (await api.get<User | null>("/auth/me")).data,
  login: async (input: { email: string; password: string }) =>
    (await api.post<User>("/auth/login", input)).data,
  logout: async () => {
    await api.post("/auth/logout");
  },
  books: async () => (await api.get<Book[]>("/books")).data,
  loans: async () => (await api.get<Loan[]>("/loans")).data,
  users: async () => (await api.get<User[]>("/users")).data,
  notifications: async () =>
    (await api.get<Notification[]>("/notificacoes")).data,
  borrow: async (bookId: string) => {
    await api.post("/loans", { bookId });
  },
  changeLoan: async (id: string, action: string, dueAt?: string) => {
    await api.patch("/loans/" + id, { action, dueAt });
  },
  saveBook: async (input: Record<string, unknown>, id?: string) =>
    (id
      ? await api.patch<Book>("/books/" + id, input)
      : await api.post<Book>("/books", input)
    ).data,
  uploadCover: async (id: string, file: File) => {
    const body = new FormData();
    body.set("file", file);
    await api.post("/books/" + id + "/cover", body);
  },
  deleteBook: async (id: string) => {
    await api.delete("/books/" + id);
  },
  saveUser: async (input: Record<string, unknown>, id?: string) => {
    if (id) await api.patch("/users/" + id, input);
    else await api.post("/users", input);
  },
  deleteUser: async (id: string) => {
    await api.delete("/users/" + id);
  },
  profile: async (input: Record<string, unknown>) =>
    (await api.patch<User>("/profile", input)).data,
};
