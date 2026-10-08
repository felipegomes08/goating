import { createFileRoute, redirect } from "@tanstack/react-router";

// "Partidas" foi incorporada ao feed (abas Próximas e Finalizadas).
// A rota continua existindo só pra não quebrar link antigo ou favorito.
export const Route = createFileRoute("/minhas-partidas")({
  ssr: false,
  validateSearch: (search: Record<string, unknown>): { aba?: string | undefined } => ({
    aba: typeof search["aba"] === "string" ? search["aba"] : undefined,
  }),
  beforeLoad: ({ search }) => {
    throw redirect({
      to: "/",
      search: search.aba === "passadas" ? { aba: "finalizadas" } : {},
      replace: true,
    });
  },
});
