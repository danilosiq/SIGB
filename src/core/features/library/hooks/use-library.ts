"use client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import type { Role } from "@/core/@types";
import { libraryService as service } from "../services/library-service";
import {
  demoBooks,
  demoUsers,
  demoUser,
  demoLoans,
  demoNotifications,
} from "../data/demo";
import { errorMessage } from "@/core/services/api-service";
export function useLibrary() {
  const client = useQueryClient();
  const [demoRole, setDemoRole] = useState<Role>("ALUNO");
  const [notice, setNotice] = useState("");
  const config = useQuery({
    queryKey: ["config"],
    queryFn: service.config,
    retry: false,
  });
  const demo = config.data?.demo === true;
  const session = useQuery({
    queryKey: ["me"],
    queryFn: service.me,
    enabled: config.data?.demo === false,
    retry: false,
  });
  const user = demo ? { ...demoUser, role: demoRole } : session.data;
  const enabled = !!user && !demo;
  const books = useQuery({
    queryKey: ["books"],
    queryFn: service.books,
    enabled,
  });
  const loans = useQuery({
    queryKey: ["loans", user?.id],
    queryFn: service.loans,
    enabled,
  });
  const users = useQuery({
    queryKey: ["users"],
    queryFn: service.users,
    enabled: enabled && user?.role === "ADMIN",
  });
  const notifications = useQuery({
    queryKey: ["notifications", user?.id],
    queryFn: service.notifications,
    enabled,
    refetchInterval: enabled ? 30000 : false,
  });
  const mutation = useMutation({
    mutationFn: async (task: () => Promise<unknown>) => {
      if (demo)
        throw new Error(
          "Esta é uma demonstração. Conecte o Neon para salvar alterações e realizar empréstimos.",
        );
      return task();
    },
    onSuccess: () => {
      void client.invalidateQueries();
      setNotice("Operação realizada com sucesso.");
    },
    onError: (e) => setNotice(errorMessage(e)),
  });
  async function run(task: () => Promise<unknown>) {
    try {
      await mutation.mutateAsync(task);
      return true;
    } catch {
      return false;
    }
  }
  return {
    demo,
    demoRole,
    setDemoRole,
    user,
    config,
    session,
    books: demo ? demoBooks : (books.data ?? []),
    loans: demo ? demoLoans() : (loans.data ?? []),
    users: demo ? demoUsers : (users.data ?? []),
    notifications: demo ? demoNotifications() : (notifications.data ?? []),
    loading:
      config.isLoading || (!demo && (session.isLoading || books.isLoading)),
    error:
      config.error ||
      session.error ||
      books.error ||
      loans.error ||
      users.error ||
      notifications.error,
    notice,
    setNotice,
    run,
    pending: mutation.isPending,
    client,
  };
}
