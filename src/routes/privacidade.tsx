import type { ReactNode } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { useVoltar } from "@/hooks/use-voltar";

/** E-mail de contato sobre dados pessoais (provisório: trocar quando existir um do Goating). Vazio esconde o trecho. */
const CONTATO: string = "felipecgomes02@gmail.com";
const ATUALIZADA_EM = "8 de outubro de 2026";

export const Route = createFileRoute("/privacidade")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Política de privacidade · Goating" },
      {
        name: "description",
        content: "Quais dados o Goating guarda, pra que usa e como excluir sua conta.",
      },
    ],
  }),
  component: Privacidade,
});

function Privacidade() {
  const navigate = useNavigate();
  const voltar = useVoltar(() => void navigate({ to: "/" }));

  return (
    <div className="app-shell flex min-h-screen flex-col">
      <header className="rounded-b-3xl bg-primary px-4 pt-4 pb-5">
        <button type="button" aria-label="Voltar" onClick={voltar}>
          <ArrowLeft className="size-5 text-primary-foreground" />
        </button>
        <h1 className="mt-3 text-2xl font-extrabold text-primary-foreground">
          Política de privacidade
        </h1>
        <p className="mt-1 text-sm text-mint">Atualizada em {ATUALIZADA_EM}</p>
      </header>

      <main className="space-y-5 p-4 pb-10 text-sm leading-relaxed text-foreground">
        <p>
          O Goating é um aplicativo pra organizar peladas de futebol: marcar jogos, sortear times,
          registrar placar e acompanhar o ranking da turma. Esta página explica, sem juridiquês, que
          dados o app guarda e o que faz com eles.
        </p>

        <Secao titulo="O que guardamos">
          <ul className="list-disc space-y-1.5 pl-5">
            <li>
              <strong>Conta:</strong> seu e-mail e sua senha (a senha fica protegida, nós não
              conseguimos lê-la).
            </li>
            <li>
              <strong>Perfil:</strong> nome de exibição, nick, cidade, posição, bio e foto, se você
              preencher.
            </li>
            <li>
              <strong>Uso do app:</strong> peladas que você cria ou confirma presença, turmas de que
              participa, gols, vitórias e demais números dos jogos.
            </li>
            <li>
              <strong>Avaliações:</strong> as notas que você dá e as que recebe de quem jogou com
              você.
            </li>
            <li>
              <strong>Rede:</strong> quem você segue e quem segue você.
            </li>
          </ul>
        </Secao>

        <Secao titulo="O que não guardamos">
          <ul className="list-disc space-y-1.5 pl-5">
            <li>
              A foto que você tira pra montar o pôster da pelada não é enviada pra nós: a imagem é
              montada no seu aparelho e só sai dele quando você compartilha.
            </li>
            <li>Não coletamos sua localização nem seus contatos.</li>
            <li>Não temos anúncios e não vendemos dados pra ninguém.</li>
          </ul>
        </Secao>

        <Secao titulo="Quem vê o quê">
          <ul className="list-disc space-y-1.5 pl-5">
            <li>
              Outros usuários logados veem seu nome, nick, cidade, posição, foto, cartinha,
              estatísticas e as peladas e turmas de que você participa.
            </li>
            <li>Seu e-mail não aparece pra outros usuários.</li>
            <li>
              Quem organiza uma pelada pode colocar seu nome na lista do jogo, mesmo que você não
              tenha conta. Nesse caso guardamos só o nome digitado.
            </li>
          </ul>
        </Secao>

        <Secao titulo="Pra que usamos">
          <p>
            Só pra fazer o app funcionar: mostrar suas peladas e turmas, calcular rankings e a sua
            cartinha, e permitir que você entre na sua conta.
          </p>
        </Secao>

        <Secao titulo="Onde ficam os dados">
          <p>
            Num banco de dados da Supabase, empresa de infraestrutura que hospeda o Goating, em
            servidores em São Paulo.
          </p>
        </Secao>

        <Secao titulo="Como excluir sua conta">
          <p>
            No app, vá em <strong>Perfil</strong> e toque em <strong>Excluir minha conta</strong>,
            no fim da tela. A exclusão é imediata e apaga perfil, foto, avaliações e seguidores. Nas
            turmas em que você jogou, os gols e vitórias continuam no ranking apenas com o nome, sem
            ligação com você.
          </p>
        </Secao>

        {CONTATO && (
          <Secao titulo="Contato">
            <p>
              Dúvidas ou pedidos sobre seus dados:{" "}
              <a href={`mailto:${CONTATO}`} className="font-semibold text-primary underline">
                {CONTATO}
              </a>
              .
            </p>
          </Secao>
        )}
      </main>
    </div>
  );
}

function Secao({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="text-base font-extrabold text-foreground">{titulo}</h2>
      {children}
    </section>
  );
}
