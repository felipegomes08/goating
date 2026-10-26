import { createFileRoute } from "@tanstack/react-router";
import { Apresentacao } from "@/components/goating/apresentacao";

// renderizada no servidor (sem ssr: false): o Google e quem abre o link leem o texto sem login
export const Route = createFileRoute("/sobre")({
  head: () => ({
    meta: [
      { title: "Goating · A rede social do futebol amador" },
      {
        name: "description",
        content:
          "Organize peladas, sorteie times, registre o placar e evolua sua cartinha de jogador.",
      },
    ],
  }),
  component: Apresentacao,
});
