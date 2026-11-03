"use client";
import { useEffect, useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  authService,
  type OtpChallenge,
  type SignupInput,
} from "../services/auth-service";
import { errorMessage } from "@/core/services/api-service";
import { libraryService } from "../services/library-service";
import type { User } from "@/core/@types";

type PendingChallenge = OtpChallenge & {
  expiresAt: number;
  resendAt: number;
  revision: number;
};
const emptyDraft = { name: "", phone: "", email: "" };

export function useAuthForm() {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [challenge, setChallenge] = useState<PendingChallenge | null>(null);
  const [draft, setDraft] = useState(emptyDraft);
  const [now, setNow] = useState(0);
  const client = useQueryClient();
  const config = useQuery({
    queryKey: ["config"],
    queryFn: libraryService.config,
  });
  const otpEnabled = config.data?.signupOtpEnabled === true;

  useEffect(() => {
    if (!challenge) return;
    const interval = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, [challenge]);

  async function authenticated(user: User) {
    client.setQueryData(["me"], user);
    await client.invalidateQueries();
  }
  function acceptChallenge(result: OtpChallenge) {
    const timestamp = Date.now();
    setNow(timestamp);
    setChallenge((previous) => ({
      ...result,
      expiresAt: timestamp + result.expiresIn * 1000,
      resendAt: timestamp + result.retryAfter * 1000,
      revision: (previous?.revision ?? 0) + 1,
    }));
  }

  const login = useMutation({
    mutationFn: authService.login,
    onSuccess: authenticated,
  });
  const register = useMutation({
    mutationFn: authService.registerDirect,
    onSuccess: authenticated,
  });
  const request = useMutation({
    mutationFn: authService.requestOtp,
    onSuccess: acceptChallenge,
  });
  const verify = useMutation({
    mutationFn: authService.verifyOtp,
    onSuccess: authenticated,
  });
  const resend = useMutation({
    mutationFn: authService.resendOtp,
    onSuccess: (result) => {
      verify.reset();
      acceptChallenge(result);
    },
  });
  const pending =
    login.isPending ||
    register.isPending ||
    request.isPending ||
    verify.isPending ||
    resend.isPending;
  const remaining = challenge
    ? Math.max(0, Math.ceil((challenge.expiresAt - now) / 1000))
    : 0;
  const resendIn = challenge
    ? Math.max(0, Math.ceil((challenge.resendAt - now) / 1000))
    : 0;

  function resetMessages() {
    login.reset();
    register.reset();
    request.reset();
    verify.reset();
    resend.reset();
  }
  function switchMode() {
    if (pending) return;
    setMode((previous) => (previous === "login" ? "register" : "login"));
    setChallenge(null);
    resetMessages();
  }
  function editDetails() {
    if (pending) return;
    setChallenge(null);
    resetMessages();
  }
  function resendCode() {
    if (!challenge || pending || resendIn > 0) return;
    verify.reset();
    resend.mutate(challenge.challengeId);
  }
  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (pending) return;
    const data = new FormData(e.currentTarget);
    if (challenge) {
      if (remaining === 0) return;
      resend.reset();
      verify.mutate({
        challengeId: challenge.challengeId,
        code: String(data.get("code") ?? "").trim(),
      });
      return;
    }
    const email = String(data.get("email") ?? "").trim();
    const password = String(data.get("password") ?? "");
    if (mode === "login") {
      login.mutate({ email, password });
      return;
    }
    const input: SignupInput = {
      name: String(data.get("name") ?? "").trim(),
      phone: String(data.get("phone") ?? "").trim(),
      email,
      password,
    };
    setDraft({ name: input.name, phone: input.phone, email });
    if (otpEnabled) request.mutate(input);
    else register.mutate(input);
  }

  const error =
    verify.error ||
    resend.error ||
    request.error ||
    register.error ||
    login.error;
  return {
    registering: mode === "register",
    otpEnabled,
    challenge,
    draft,
    remaining,
    resendIn,
    switchMode,
    editDetails,
    resendCode,
    submit,
    pending,
    resending: resend.isPending,
    error: error ? errorMessage(error) : "",
  };
}
