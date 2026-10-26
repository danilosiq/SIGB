import type { Metadata } from "next";
import { Providers } from "./providers";
import "@/core/styles/globals.css";
export const metadata: Metadata = {
  title: "SIGB · Sua próxima descoberta",
  icons: { icon: "/favicon.svg" },
  description:
    "Biblioteca digital: descubra livros, acompanhe empréstimos e conecte-se ao conhecimento.",
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
