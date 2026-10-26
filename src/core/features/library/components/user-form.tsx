"use client";
import type { FormEvent } from "react";
import type { User } from "@/core/@types";
import { libraryService as service } from "../services/library-service";
export function UserForm({
  user,
  profile,
  run,
  onDone,
  pending,
}: {
  user?: User;
  profile?: boolean;
  run: (fn: () => Promise<unknown>) => Promise<boolean>;
  onDone: () => void;
  pending: boolean;
}) {
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const raw = Object.fromEntries(new FormData(e.currentTarget));
    const input = {
      ...raw,
      phone: raw.phone || null,
      ...(!profile && user ? { blocked: raw.blocked === "true" } : {}),
    };
    if (
      await run(() =>
        profile ? service.profile(input) : service.saveUser(input, user?.id),
      )
    )
      onDone();
  }
  return (
    <form onSubmit={submit} className="form">
      <label>
        Nome completo
        <input
          name="name"
          defaultValue={user?.name}
          required
          minLength={2}
          maxLength={100}
        />
      </label>
      <label>
        E-mail
        <input name="email" type="email" defaultValue={user?.email} required />
      </label>
      <label>
        Telefone com DDI
        <input
          name="phone"
          type="tel"
          defaultValue={user?.phone ?? ""}
          placeholder="+55 11 99999-9999"
          pattern="[+0-9 ()\-]{8,20}"
        />
      </label>
      {!profile && (
        <>
          <label>
            Perfil de acesso
            <select name="role" defaultValue={user?.role ?? "ALUNO"}>
              <option value="ALUNO">Aluno</option>
              <option value="BIBLIOTECARIO">Bibliotecário</option>
              <option value="ADMIN">Administrador</option>
            </select>
          </label>
          {!user ? (
            <label>
              Senha inicial
              <input
                name="password"
                type="password"
                minLength={10}
                maxLength={128}
                required
                autoComplete="new-password"
              />
              <small>No mínimo 10 caracteres.</small>
            </label>
          ) : (
            <label>
              Situação
              <select name="blocked" defaultValue={String(user.blocked)}>
                <option value="false">Ativo</option>
                <option value="true">Bloqueado</option>
              </select>
            </label>
          )}
        </>
      )}
      <button className="button primary" disabled={pending}>
        {pending ? "Salvando…" : "Salvar alterações"}
      </button>
    </form>
  );
}
