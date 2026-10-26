import type { ReactNode } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { useVoltar } from "@/hooks/use-voltar";

/** E-mail de contato sobre dados pessoais (provisório: trocar quando existir um do Goating). Vazio esconde o trecho. */
const CONTATO: string = "felipecgomes02@gmail.com";
const ATUALIZADA_EM = "26 de outubro de 2026";

// renderizada no servidor (sem ssr: false): o Google confere este texto na verificação do login
export const Route = createFileRoute("/privacidade")({
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
    <div className="app-shell flex min-h-dvh flex-col">
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
              <strong>Entrar com Google:</strong> se você entrar com a sua conta Google, recebemos
              do Google só o seu nome, e-mail e foto de perfil. Usamos isso pra criar sua conta e
              preencher o perfil (a foto do Google vira a foto do perfil, se você ainda não tiver
              uma; dá pra trocar quando quiser). Não temos acesso à sua senha do Google, nem aos
              seus contatos, e-mails ou arquivos.
            </li>
            <li>
              <strong>Assinatura Premium:</strong> se você assinar, guardamos o plano, a situação da
              assinatura e até quando ela vale. Os dados do cartão vão direto pro Stripe, que
              processa o pagamento: o Goating não vê nem guarda o número do cartão.
            </li>
            <li>
              <strong>Avisos no celular:</strong> se você permitir as notificações no app, guardamos
              o código do aparelho que serve pra entregar os avisos (convites, conquistas, peladas).
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
              você. Ninguém vê a nota que cada pessoa deu: aparece só a média.
            </li>
            <li>
              <strong>Comentários:</strong> o texto que você escrever ao avaliar alguém ou uma
              turma, e as denúncias de comentário que você fizer.
            </li>
            <li>
              <strong>Avaliações de turma e pedidos de entrada:</strong> as notas que você der a uma
              turma e os pedidos que fizer pra entrar em alguma.
            </li>
            <li>
              <strong>Turmas:</strong> nome, escudo e capa que o organizador colocar, e o nome dos
              jogadores da lista.
            </li>
            <li>
              <strong>Local da pelada:</strong> o endereço ou o ponto no mapa que o organizador
              marcar pro campo.
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
            <li>
              Não guardamos a sua localização. O botão “Onde estou”, ao marcar o campo no mapa, usa
              a posição do aparelho só naquele momento, pra centralizar o mapa.
            </li>
            <li>Não acessamos seus contatos.</li>
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
              Quando você pede pra entrar numa turma, o dono e os administradores dela veem o seu
              pedido e o seu perfil.
            </li>
            <li>
              Os comentários das avaliações são públicos pra quem está logado, mas anônimos: os
              outros usuários não veem quem escreveu, nem de qual pelada veio. Eles aparecem no
              perfil de quem foi avaliado, ou na página da turma avaliada. O Goating guarda quem
              escreveu, pra poder tratar denúncias. Quem escreveu pode apagar o seu, e qualquer
              pessoa pode denunciar um comentário; a denúncia também é anônima.
            </li>
            <li>
              O escudo e a capa de uma turma são imagens públicas: quem tiver o endereço da imagem
              consegue abri-la sem estar logado. Sua foto de perfil não é pública.
            </li>
            <li>
              Quem organiza uma pelada pode colocar seu nome na lista do jogo, mesmo que você não
              tenha conta. Nesse caso guardamos só o nome digitado.
            </li>
          </ul>
        </Secao>

        <Secao titulo="Pra que usamos">
          <p>
            Só pra fazer o app funcionar: mostrar suas peladas e turmas, calcular rankings, a sua
            cartinha e as suas conquistas, permitir que você entre na sua conta, mandar os e-mails
            da conta (confirmação e troca de senha), mandar os avisos que você permitiu e liberar os
            recursos do Premium pra quem assina. Não usamos seus dados pra anúncios.
          </p>
        </Secao>

        <Secao titulo="Onde ficam os dados">
          <p>
            Num banco de dados da Supabase, empresa de infraestrutura que hospeda o Goating, em
            servidores em São Paulo. O site fica na Vercel.
          </p>
        </Secao>

        <Secao titulo="Serviços de terceiros">
          <ul className="list-disc space-y-1.5 pl-5">
            <li>
              <strong>Cloudflare Turnstile:</strong> a verificação “não sou um robô” do login e do
              cadastro. Ela analisa sinais do seu navegador pra barrar acessos automáticos.
            </li>
            <li>
              <strong>Google:</strong> o login com a conta Google, se você escolher entrar assim.
            </li>
            <li>
              <strong>Stripe:</strong> o pagamento da assinatura Premium.
            </li>
            <li>
              <strong>Firebase (Google):</strong> a entrega dos avisos no celular Android.
            </li>
            <li>
              <strong>Resend:</strong> o envio dos e-mails da conta.
            </li>
            <li>
              <strong>OpenStreetMap:</strong> as imagens do mapa, quando alguém abre “Marcar no
              mapa”.
            </li>
            <li>
              <strong>Google Maps e Waze:</strong> só se você tocar em “Como chegar”; aí o app abre
              o endereço da pelada neles.
            </li>
          </ul>
        </Secao>

        <Secao titulo="Como excluir sua conta">
          <p>
            No app, vá em <strong>Perfil</strong> e toque em <strong>Excluir minha conta</strong>,
            no fim da tela. A exclusão é imediata e apaga perfil, foto, avaliações e seguidores. Nas
            turmas em que você jogou, os gols e vitórias continuam no ranking apenas com o nome, sem
            ligação com você. Se você tiver uma assinatura Premium, cancele antes no próprio app
            (tela do Premium). Se entrou com Google, também pode tirar o acesso do Goating em
            myaccount.google.com, na parte de apps conectados.
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
