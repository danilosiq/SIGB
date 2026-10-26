import type { NextConfig } from "next";
const config: NextConfig = {
  serverExternalPackages: ["@prisma/client"],
  async rewrites() {
    return [
      { source: "/notificacoes/:id", destination: "/api/notificacoes/:id" },
      {
        source: "/webhooks/notificacoes",
        destination: "/api/webhooks/notificacoes",
      },
    ];
  },
};
export default config;
