"use client";
import { useState, type FormEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { libraryService } from "../services/library-service";
import { errorMessage } from "@/core/services/api-service";
export function useAuthForm() {
  const [mode, setMode] = useState<"login" | "register">("login");
  const client = useQueryClient();
  const mutation = useMutation({
    mutationFn: async (input: {
      name: string;
      phone: string;
      email: string;
      password: string;
    }) =>
      mode === "register"
        ? libraryService.register(input)
        : libraryService.login({
            email: input.email,
            password: input.password,
          }),
    onSuccess: async (user) => {
      client.setQueryData(["me"], user);
      await client.invalidateQueries();
    },
  });
  function switchMode() {
    setMode((m) => (m === "login" ? "register" : "login"));
    mutation.reset();
  }
  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    mutation.mutate({
      name: String(data.get("name") ?? ""),
      phone: String(data.get("phone") ?? ""),
      email: String(data.get("email") ?? ""),
      password: String(data.get("password") ?? ""),
    });
  }
  return {
    registering: mode === "register",
    switchMode,
    submit,
    pending: mutation.isPending,
    error: mutation.error ? errorMessage(mutation.error) : "",
  };
}
