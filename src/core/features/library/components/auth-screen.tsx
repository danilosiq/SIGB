"use client";
import { ArrowRight, LoaderCircle } from "lucide-react";
import { Brand } from "@/core/components/brand";
import { useAuthForm } from "../hooks/use-auth-form";
import { errorMessage } from "@/core/services/api-service";
export function AuthScreen({ error }: { error: unknown }) {
  const auth = useAuthForm();
  const message = auth.error || (error ? errorMessage(error) : "");
  return (
    <main className="login-page">
      <section className="login-story" aria-label="Biblioteca SIGB">
        <Brand />
        <h1>
          Um novo capítulo
          <br />
          começa por aqui.
        </h1>
        <p>
          Seu próximo livro, uma nova ideia e um mundo inteiro de
          possibilidades.
        </p>
        <div className="login-covers" aria-hidden="true">
          {["midnight", "habits", "casmurro"].map((c) => (
            <img key={c} src={"/covers/" + c + ".svg"} alt="" />
          ))}
        </div>
        <small>SISTEMA INTEGRADO DE GESTÃO BIBLIOTECÁRIA</small>
      </section>
      <section className="login-form" aria-labelledby="auth-title">
        <Brand className="auth-mobile-brand" />
        <span className="eyebrow">
          {auth.registering
            ? "SEU PRÓXIMO CAPÍTULO COMEÇA AQUI"
            : "BEM-VINDO À BIBLIOTECA"}
        </span>
        <h2 id="auth-title">
          {auth.registering ? "Crie sua conta." : "Bom ter você por aqui."}
        </h2>
        <p>
          {auth.registering
            ? "Preencha seus dados e entre para descobrir novas leituras."
            : "Entre com sua conta para continuar a sua leitura."}
        </p>
        <form
          key={auth.registering ? "register" : "login"}
          className="form auth-form"
          onSubmit={auth.submit}
          aria-busy={auth.pending}
        >
          {auth.registering && (
            <>
              <label>
                Nome completo
                <input
                  name="name"
                  placeholder="Seu nome e sobrenome"
                  autoComplete="name"
                  minLength={3}
                  maxLength={100}
                  required
                  disabled={auth.pending}
                />
              </label>
              <label>
                Telefone
                <input
                  name="phone"
                  type="tel"
                  inputMode="tel"
                  placeholder="(11) 99999-9999"
                  autoComplete="tel"
                  minLength={8}
                  maxLength={20}
                  required
                  disabled={auth.pending}
                />
              </label>
            </>
          )}
          <label>
            E-mail
            <input
              name="email"
              type="email"
              placeholder="voce@exemplo.com"
              autoComplete="email"
              maxLength={200}
              required
              disabled={auth.pending}
            />
          </label>
          <label>
            Senha
            <input
              name="password"
              type="password"
              placeholder={auth.registering ? "Crie sua senha" : "Sua senha"}
              autoComplete={
                auth.registering ? "new-password" : "current-password"
              }
              minLength={auth.registering ? 10 : 1}
              maxLength={128}
              aria-describedby={auth.registering ? "password-help" : undefined}
              required
              disabled={auth.pending}
            />
            {auth.registering && (
              <small id="password-help">Use pelo menos 10 caracteres.</small>
            )}
          </label>
          {message && (
            <p className="form-error" role="alert">
              {message}
            </p>
          )}
          <button
            type="submit"
            className="button primary"
            disabled={auth.pending}
          >
            {auth.pending ? (
              <>
                <LoaderCircle size={17} className="spin" />
                {auth.registering ? "Criando sua conta…" : "Entrando…"}
              </>
            ) : (
              <>
                {auth.registering ? "Criar conta" : "Entrar na biblioteca"}
                <ArrowRight size={17} />
              </>
            )}
          </button>
        </form>
        <div className="auth-mode-switch">
          <span>
            {auth.registering
              ? "Já tem uma conta?"
              : "Ainda não tem uma conta?"}
          </span>
          <button
            type="button"
            onClick={auth.switchMode}
            disabled={auth.pending}
          >
            {auth.registering ? "Entrar" : "Cadastre-se"}
          </button>
        </div>
        {auth.registering && (
          <p className="auth-student-note">
            Seu cadastro dá acesso ao acervo e aos seus empréstimos.
          </p>
        )}
      </section>
    </main>
  );
}
