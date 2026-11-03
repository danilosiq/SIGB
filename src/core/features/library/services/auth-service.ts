import { api } from "@/core/services/api-service";
import type { User } from "@/core/@types";

export type SignupInput = {
  name: string;
  phone: string;
  email: string;
  password: string;
};
export type OtpChallenge = {
  challengeId: string;
  email: string;
  expiresIn: number;
  retryAfter: number;
};

export const authService = {
  login: async (input: Pick<SignupInput, "email" | "password">) =>
    (await api.post<User>("/auth/login", input)).data,
  registerDirect: async (input: SignupInput) =>
    (await api.post<User>("/auth/register", input)).data,
  requestOtp: async (input: SignupInput) =>
    (await api.post<OtpChallenge>("/auth/otp", input)).data,
  verifyOtp: async (input: { challengeId: string; code: string }) =>
    (await api.post<User>("/auth/register", input)).data,
  resendOtp: async (challengeId: string) =>
    (await api.post<OtpChallenge>("/auth/otp/resend", { challengeId })).data,
};
