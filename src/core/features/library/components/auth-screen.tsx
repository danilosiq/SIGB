"use client";
import { ArrowLeft, ArrowRight, LoaderCircle } from "lucide-react";
import { Brand } from "@/core/components/brand";
import { useAuthForm } from "../hooks/use-auth-form";
import { errorMessage } from "@/core/services/api-service";
import styles from "./auth-screen.module.css";

function duration(seconds: number) {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}
export function AuthScreen({ error }: { error: unknown }) {
  const auth = useAuthForm();
  const message = auth.error || (error ? errorMessage(error) : "");
  const verifying = !!auth.challenge;
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
          {verifying
            ? "SÓ FALTA CONFIRMAR SEU E-MAIL"
            : auth.registering
              ? "SEU PRÓXIMO CAPÍTULO COMEÇA AQUI"
              : "BEM-VINDO À BIBLIOTECA"}
        </span>
        <h2 id="auth-title">
          {verifying
            ? "Confira seu e-mail."
            : auth.registering
              ? "Crie sua conta."
              : "Bom ter você por aqui."}
        </h2>
        <p>
          {verifying
            ? "Digite o código de seis dígitos para concluir seu cadastro."
            : auth.registering
              ? auth.otpEnabled
                ? "Preencha seus dados para receber um código de confirmação."
                : "Preencha seus dados para descobrir suas próximas leituras."
              : "Entre com sua conta para continuar a sua leitura."}
        </p>
        {auth.challenge && (
          <div className={styles.otpIntroduction}>
            Código enviado para<strong>{auth.challenge.email}</strong>
          </div>
        )}
        <form
          key={
            auth.challenge
              ? `${auth.challenge.challengeId}-${auth.challenge.revision}`
              : auth.registering
                ? "register"
                : "login"
          }
          className="form auth-form"
          onSubmit={auth.submit}
          aria-busy={auth.pending}
        >
          {verifying ? (
            <>
              <label>
                Código de confirmação
                <input
                  className={styles.codeInput}
                  name="code"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  pattern="[0-9]{6}"
                  minLength={6}
                  maxLength={6}
                  placeholder="000000"
                  aria-describedby="otp-help otp-expiration"
                  required
                  disabled={auth.pending || auth.remaining === 0}
                  autoFocus
                />
                <small id="otp-help" className={styles.codeHelp}>
                  Use o código mais recente recebido por e-mail.
                </small>
              </label>
              {auth.remaining > 0 ? (
                <p id="otp-expiration" className={styles.expiration}>
                  O código expira em {duration(auth.remaining)}.
                </p>
              ) : (
                <p id="otp-expiration" className={styles.expired} role="status">
                  Este código expirou. Solicite um novo código ou volte para
                  conferir seus dados.
                </p>
              )}
            </>
          ) : (
            <>
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
                      defaultValue={auth.draft.name}
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
                      defaultValue={auth.draft.phone}
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
                  defaultValue={auth.draft.email}
                  required
                  disabled={auth.pending}
                />
              </label>
              <label>
                Senha
                <input
                  name="password"
                  type="password"
                  placeholder={
                    auth.registering ? "Crie sua senha" : "Sua senha"
                  }
                  autoComplete={
                    auth.registering ? "new-password" : "current-password"
                  }
                  minLength={auth.registering ? 10 : 1}
                  maxLength={128}
                  aria-describedby={
                    auth.registering ? "password-help" : undefined
                  }
                  required
                  disabled={auth.pending}
                />
                {auth.registering && (
                  <small id="password-help">
                    Use pelo menos 10 caracteres.
                  </small>
                )}
              </label>
            </>
          )}
          {message && (
            <p className="form-error" role="alert">
              {message}
            </p>
          )}
          <button
            type="submit"
            className="button primary"
            disabled={auth.pending || (verifying && auth.remaining === 0)}
          >
            {auth.pending ? (
              <>
                <LoaderCircle size={17} className="spin" />
                {verifying
                  ? auth.resending
                    ? "Reenviando…"
                    : "Confirmando…"
                  : auth.registering
                    ? auth.otpEnabled
                      ? "Enviando código…"
                      : "Criando sua conta…"
                    : "Entrando…"}
              </>
            ) : (
              <>
                {verifying
                  ? "Confirmar e criar conta"
                  : auth.registering
                    ? auth.otpEnabled
                      ? "Receber código por e-mail"
                      : "Criar conta"
                    : "Entrar na biblioteca"}
                <ArrowRight size={17} />
              </>
            )}
          </button>
        </form>
        {verifying ? (
          <>
            <div className={styles.otpActions}>
              <button
                type="button"
                className={styles.resendButton}
                onClick={auth.resendCode}
                disabled={auth.pending || auth.resendIn > 0}
              >
                {auth.resending
                  ? "Reenviando código…"
                  : auth.resendIn > 0
                    ? `Reenviar código em ${duration(auth.resendIn)}`
                    : "Reenviar código"}
              </button>
              <button
                type="button"
                className={styles.backButton}
                onClick={auth.editDetails}
                disabled={auth.pending}
              >
                <ArrowLeft size={14} />
                Alterar meus dados
              </button>
            </div>
            <p className={styles.tip}>
              Não encontrou o e-mail? Confira também a pasta de spam.
            </p>
          </>
        ) : (
          <>
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
                {auth.otpEnabled
                  ? "Sua conta será criada após a confirmação do e-mail."
                  : "Seu cadastro dá acesso ao acervo e aos seus empréstimos."}
              </p>
            )}
          </>
        )}
      </section>
    </main>
  );
}
