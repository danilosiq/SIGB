"use client";
import {
  BookOpen,
  ArrowDownLeft,
  RefreshCw,
  Clock,
  CalendarDays,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { Loan } from "@/core/@types";
const date = (v: string) =>
  format(new Date(v), "dd MMM yyyy", { locale: ptBR });
const money = (cents: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
    cents / 100,
  );
export function PageTitle({
  kicker,
  title,
  text,
  action,
}: {
  kicker: string;
  title: string;
  text: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="page-heading">
      <div>
        <span className="eyebrow">{kicker}</span>
        <h1>{title}</h1>
        <p>{text}</p>
      </div>
      {action}
    </div>
  );
}
export function Stat({
  icon: Icon,
  value,
  label,
  detail,
}: {
  icon: typeof BookOpen;
  value: string;
  label: string;
  detail: string;
}) {
  return (
    <article className="stat">
      <span className="stat-icon">
        <Icon size={21} />
      </span>
      <div>
        <div className="stat-value">
          {value}
          <span>{label}</span>
        </div>
        <p>{detail}</p>
      </div>
    </article>
  );
}
export function Empty({
  icon: Icon,
  title,
  text,
}: {
  icon: typeof BookOpen;
  title: string;
  text: string;
}) {
  return (
    <div className="empty">
      <Icon size={36} />
      <h3>{title}</h3>
      <p>{text}</p>
    </div>
  );
}
export function LoanTable({
  loans,
  staff,
  pending,
  onAction,
  onDeadline,
  onSchedule,
}: {
  loans: Loan[];
  staff: boolean;
  pending: boolean;
  onAction: (loan: Loan, action: string) => void;
  onDeadline: (loan: Loan) => void;
  onSchedule: (loan: Loan) => void;
}) {
  return loans.length ? (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Livro{staff ? " / Aluno" : ""}</th>
            <th>Retirada</th>
            <th>Devolução prevista</th>
            <th>Status</th>
            <th>Multa</th>
            <th>Ações</th>
          </tr>
        </thead>
        <tbody>
          {loans.map((l) => {
            const late = !l.returnedAt && new Date(l.dueAt) < new Date();
            return (
              <tr key={l.id}>
                <td>
                  <strong>{l.book.title}</strong>
                  <small>{staff ? l.user.name : l.book.author}</small>
                  {l.pickupAt && (
                    <small>
                      Retirada: {format(new Date(l.pickupAt), "dd/MM · HH:mm")}
                    </small>
                  )}
                </td>
                <td>{date(l.borrowedAt)}</td>
                <td>{date(l.dueAt)}</td>
                <td>
                  <span
                    className={
                      "pill " +
                      (l.returnedAt ? "neutral" : late ? "warning" : "success")
                    }
                  >
                    {l.returnedAt
                      ? "Devolvido"
                      : !l.pickupConfirmedAt
                        ? "Aguardando retirada"
                        : late
                          ? "Em atraso"
                          : "Em andamento"}
                  </span>
                  {l.returnedAt && <small>{date(l.returnedAt)}</small>}
                </td>
                <td>{money(l.fineCents)}</td>
                <td>
                  {!l.returnedAt && (
                    <div className="inline-actions">
                      {staff ? (
                        <>
                          <button
                            className="table-action"
                            disabled={pending}
                            onClick={() =>
                              onAction(
                                l,
                                l.pickupConfirmedAt ? "return" : "confirm",
                              )
                            }
                          >
                            <ArrowDownLeft size={15} />
                            {l.pickupConfirmedAt
                              ? "Devolver"
                              : "Confirmar retirada"}
                          </button>
                          {!l.pickupConfirmedAt && (
                            <button
                              className="icon-button"
                              aria-label={"Agendar retirada de " + l.book.title}
                              onClick={() => onSchedule(l)}
                            >
                              <Clock size={16} />
                            </button>
                          )}
                          <button
                            className="icon-button"
                            aria-label={"Definir prazo de " + l.book.title}
                            onClick={() => onDeadline(l)}
                          >
                            <CalendarDays size={16} />
                          </button>
                        </>
                      ) : (
                        <button
                          className="table-action"
                          disabled={
                            pending ||
                            late ||
                            l.renewals >= 1 ||
                            !l.pickupConfirmedAt
                          }
                          onClick={() => onAction(l, "renew")}
                        >
                          <RefreshCw size={14} />
                          {l.renewals ? "Renovado" : "Renovar"}
                        </button>
                      )}
                    </div>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  ) : (
    <Empty
      icon={BookOpen}
      title="Nenhum empréstimo por aqui"
      text="O acervo está cheio de possibilidades para a sua próxima leitura."
    />
  );
}
