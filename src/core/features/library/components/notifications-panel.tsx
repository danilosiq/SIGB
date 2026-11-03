"use client";
import { Bell, Check, CheckCheck } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { Notification } from "@/core/@types";
import { PageTitle, Empty } from "./library-shared";
import { notificationService } from "../services/notification-service";
const titles: Record<string, string> = {
  PRAZO_PROXIMO: "Devolução próxima",
  BLOQUEIO_POR_ATRASO: "Bloqueio por atraso",
  EMPRESTIMO_CONFIRMADO: "Empréstimo confirmado",
  EMPRESTIMO_REALIZADO: "Empréstimo confirmado",
};
export function NotificationsPanel({
  notifications,
  pending,
  staff,
  run,
}: {
  notifications: Notification[];
  pending: boolean;
  staff: boolean;
  run: (fn: () => Promise<unknown>) => Promise<boolean>;
}) {
  const unread = notifications.filter((n) => !n.readAt).length;
  return (
    <>
      <PageTitle
        kicker="SUA BIBLIOTECA, EM DIA"
        title="Notificações"
        text="Acompanhe seus empréstimos e lembretes de devolução."
      />
      <div className="notifications-toolbar">
        <p role="status">
          {unread
            ? `${unread} ${unread === 1 ? "notificação não lida" : "notificações não lidas"}`
            : "Você está em dia"}
        </p>
        <button
          className="button secondary"
          disabled={pending || !unread}
          onClick={() => void run(notificationService.markAllRead)}
        >
          <CheckCheck size={16} />
          Marcar todas como lidas
        </button>
      </div>
      <div className="notification-list">
        {notifications.map((n) => (
          <article
            className={`notification-card ${n.readAt ? "is-read" : "is-unread"}`}
            key={n.id}
          >
            <span className="notification-symbol">
              <Bell size={21} />
            </span>
            <div>
              <div className="notification-title">
                <h3>
                  {titles[n.type] ?? n.type.replaceAll("_", " ").toLowerCase()}
                </h3>
                {!n.readAt && <span className="pill success">Nova</span>}
              </div>
              <p>{n.message}</p>
              <div className="notification-meta">
                <small>
                  {format(new Date(n.createdAt), "dd MMM yyyy 'às' HH:mm", {
                    locale: ptBR,
                  })}
                </small>
                {!n.readAt ? (
                  <button
                    className="notification-read-action"
                    disabled={pending}
                    onClick={() =>
                      void run(() => notificationService.markRead(n.id))
                    }
                  >
                    <Check size={14} />
                    Marcar como lida
                  </button>
                ) : (
                  <span className="notification-read-label">
                    <CheckCheck size={14} />
                    Lida
                  </span>
                )}
              </div>
              {staff && (
                <details className="notification-delivery">
                  <summary>
                    Detalhes do envio externo ·{" "}
                    {n.status === "ENVIADA"
                      ? "Enviado"
                      : n.status === "FALHA"
                        ? "Falha"
                        : "Processando"}
                  </summary>
                  {n.deliveries.length ? (
                    n.deliveries.map((d) => (
                      <p key={d.id}>
                        {d.channel} · {d.attempts}/3 tentativas · {d.status}
                        {d.lastError && (
                          <span className="delivery-error">
                            {" "}
                            · {d.lastError}
                          </span>
                        )}
                      </p>
                    ))
                  ) : (
                    <p>Notificação disponível dentro da biblioteca.</p>
                  )}
                </details>
              )}
            </div>
          </article>
        ))}
      </div>
      {!notifications.length && (
        <Empty
          icon={Bell}
          title="Tudo tranquilo por aqui"
          text="Seus lembretes e atualizações aparecerão nesta página."
        />
      )}
    </>
  );
}
