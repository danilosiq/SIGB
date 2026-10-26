import axios from "axios";
export const api = axios.create({ baseURL: "/api", timeout: 20000 });
export function errorMessage(error: unknown) {
  return axios.isAxiosError(error)
    ? (error.response?.data?.message ?? "Falha de conexão. Tente novamente.")
    : error instanceof Error
      ? error.message
      : "Ocorreu um erro.";
}
