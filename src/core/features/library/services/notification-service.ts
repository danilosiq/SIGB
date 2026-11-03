import { api } from "@/core/services/api-service";
export const notificationService = {
  markRead: async (id: string) =>
    (await api.patch(`/notificacoes/${id}/read`)).data,
  markAllRead: async () => (await api.post("/notificacoes/read-all")).data,
};
