import { createFileRoute, redirect } from "@tanstack/react-router";

// A busca por jogador migrou pra dentro do Ranking (campo de busca no topo).
// Rota mantida só pra não quebrar link antigo/favorito de alguém.
export const Route = createFileRoute("/buscar")({
  beforeLoad: () => {
    throw redirect({ to: "/ranking" });
  },
});
