"use client";
import { useState, type FormEvent } from "react";
import { api } from "@/core/services/api-service";
import { PageTitle } from "./library-shared";
export function DeveloperPanel({
  run,
  pending,
  onOpenNotifications,
}: {
  run: (task: () => Promise<unknown>) => Promise<boolean>;
  pending: boolean;
  onOpenNotifications: () => void;
}) {
  const [message, setMessage] = useState(
    "Esta é uma notificação simulada para testar a caixa de avisos do SIGB.",
  );
  const [created, setCreated] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await run(async () => {
      const result = await api.post<{ id: string }>(
        "/developer/notifications",
        { message: message.trim() },
      );
      setCreated(result.data.id);
    });
  }
  return (
    <>
      <PageTitle
        kicker="FERRAMENTAS DE TESTE"
        title="Área do desenvolvedor"
        text="Teste a aparição de um aviso na sua própria conta."
      />
      <section className="notification-card">
        <div>
          <h2>Simular notificação interna</h2>
          <p>
            O aviso será identificado como TESTE e aparecerá no sino e na aba
            Notificações. Não há envio para e-mail, SMS ou WhatsApp.
          </p>
          <form className="form" onSubmit={submit}>
            <label>
              Mensagem do teste
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                minLength={1}
                maxLength={1000}
                rows={4}
                required
                disabled={pending}
              />
            </label>
            <button
              className="button primary"
              disabled={pending || !message.trim()}
            >
              {pending ? "Criando aviso…" : "Disparar notificação de teste"}
            </button>
          </form>
          {created && (
            <div role="status">
              <p>Aviso de teste criado na sua caixa de notificações.</p>
              <button
                className="button secondary"
                onClick={onOpenNotifications}
              >
                Ver notificação
              </button>
            </div>
          )}
          <details>
            <summary>Contrato da chamada</summary>
            <p>
              POST /api/developer/notifications · sessão de administrador · até
              5 testes por minuto.
            </p>
            <pre>{JSON.stringify({ message: message.trim() }, null, 2)}</pre>
          </details>
        </div>
      </section>
    </>
  );
}
