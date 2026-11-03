import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { CalendarPlus, Crown, Shuffle, Star, Trophy, Users } from "lucide-react";
import { GoatingLogo } from "@/components/goating/logo";
import { Button } from "@/components/ui/button";
import { noApp } from "@/lib/nativo";
import { LOJAS } from "@/lib/site";

/**
 * Apresentação do Goating pra quem ainda não entrou: o que é o app, o que dá pra fazer e os
 * links de entrar e da política de privacidade. É a página inicial que o Google confere na
 * verificação do login com Google, então precisa explicar o app sem pedir login.
 */
export function Apresentacao() {
  return (
    <div className="app-shell flex min-h-dvh flex-col bg-background">
      <header className="rounded-b-3xl bg-primary px-5 pt-6 pb-8">
        <GoatingLogo withWordmark iconTone="light" wordmarkTone="dark" />
        <h1 className="mt-6 text-3xl leading-tight font-extrabold text-primary-foreground">
          Goating: a rede social do futebol amador
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-mint">
          O Goating é um app gratuito pra organizar peladas de futebol. Marque o jogo, confirme quem
          vai, sorteie os times, registre o placar e avalie quem jogou com você. A cada pelada, sua
          cartinha de jogador evolui.
        </p>
        <div className="mt-6 flex flex-col gap-2">
          <Button asChild size="lg" className="bg-white text-primary hover:bg-white/90">
            <Link to="/auth">Entrar ou criar conta</Link>
          </Button>
        </div>
        <BaixarOApp />
      </header>

      <main className="flex-1 space-y-3 px-4 py-6">
        <h2 className="px-1 text-lg font-extrabold text-foreground">O que dá pra fazer</h2>
        <Recurso icone={<CalendarPlus />} titulo="Organizar peladas">
          Crie a pelada com dia, hora e local, mande o link pra galera e acompanhe quem confirmou.
        </Recurso>
        <Recurso icone={<Shuffle />} titulo="Sortear times equilibrados">
          O sorteio usa o nível de cada jogador pra montar times parelhos.
        </Recurso>
        <Recurso icone={<Star />} titulo="Avaliar e evoluir a cartinha">
          Depois do jogo, quem jogou avalia quem jogou. As notas viram a sua cartinha de jogador.
        </Recurso>
        <Recurso icone={<Users />} titulo="Turmas">
          Reúna a turma fixa, com escudo, lista de jogadores e histórico de jogos.
        </Recurso>
        <Recurso icone={<Trophy />} titulo="Rankings e conquistas">
          Artilharia, vitórias e MVPs da turma e da cidade, além de medalhas por conquistas.
        </Recurso>
        <Recurso icone={<Crown />} titulo="Goating Premium (opcional)">
          Assinatura pra quem quer mais: molduras e capas pra carta, notas detalhadas e o raio-X do
          jogador. O uso básico do app é gratuito.
        </Recurso>
      </main>

      <footer className="space-y-2 px-5 pb-10 text-center text-xs text-muted-foreground">
        <p>
          <Link to="/privacidade" className="font-semibold text-primary underline">
            Política de privacidade
          </Link>
        </p>
        <p>Goating · goating.com.br</p>
      </footer>
    </div>
  );
}

/**
 * No site, os botões pra baixar o app do celular (cada um só aparece quando a loja já tem o app).
 * Dentro do app não aparecem.
 */
function BaixarOApp() {
  if (noApp() || (!LOJAS.appStore && !LOJAS.playStore)) return null;
  return (
    <div className="mt-4">
      <p className="text-center text-xs font-semibold text-mint">Tem app também:</p>
      <div className="mt-2 grid grid-cols-2 gap-2">
        {LOJAS.appStore && (
          <a
            href={LOJAS.appStore}
            target="_blank"
            rel="noreferrer"
            className="flex items-center justify-center gap-2 rounded-xl bg-black px-3 py-2.5 text-white"
          >
            <svg viewBox="0 0 24 24" className="size-5 shrink-0 fill-current" aria-hidden>
              <path d="M16.37 12.6c-.02-2.2 1.8-3.26 1.88-3.31-1.02-1.5-2.62-1.7-3.19-1.72-1.36-.14-2.65.8-3.34.8-.69 0-1.75-.78-2.88-.76-1.48.02-2.85.86-3.61 2.19-1.54 2.67-.39 6.63 1.11 8.8.73 1.06 1.6 2.25 2.75 2.21 1.1-.05 1.52-.71 2.85-.71s1.71.71 2.88.69c1.19-.02 1.94-1.08 2.67-2.15.84-1.23 1.19-2.42 1.21-2.48-.03-.01-2.32-.89-2.33-3.56zM14.18 6.13c.61-.74 1.02-1.76.91-2.78-.88.04-1.94.59-2.57 1.32-.56.65-1.06 1.69-.92 2.69.98.08 1.98-.5 2.58-1.23z" />
            </svg>
            <span className="text-left leading-tight">
              <span className="block text-[10px] opacity-80">Baixar para</span>
              <span className="block text-sm font-bold">iPhone</span>
            </span>
          </a>
        )}
        {LOJAS.playStore && (
          <a
            href={LOJAS.playStore}
            target="_blank"
            rel="noreferrer"
            className="flex items-center justify-center gap-2 rounded-xl bg-black px-3 py-2.5 text-white"
          >
            <svg viewBox="0 0 24 24" className="size-5 shrink-0" aria-hidden>
              <path
                fill="#34A853"
                d="M3.6 2.3 13.4 12l-9.8 9.7c-.4-.2-.6-.6-.6-1.1V3.4c0-.5.2-.9.6-1.1z"
              />
              <path fill="#FBBC04" d="m16.8 8.6-3.4 3.4 3.4 3.4 3.9-2.2c.8-.5.8-1.7 0-2.2z" />
              <path fill="#4285F4" d="M3.6 2.3c.3-.2.8-.2 1.2 0l12 6.3-3.4 3.4z" />
              <path fill="#EA4335" d="m13.4 12 3.4 3.4-12 6.3c-.4.2-.9.2-1.2 0z" />
            </svg>
            <span className="text-left leading-tight">
              <span className="block text-[10px] opacity-80">Baixar para</span>
              <span className="block text-sm font-bold">Android</span>
            </span>
          </a>
        )}
      </div>
    </div>
  );
}

function Recurso({
  icone,
  titulo,
  children,
}: {
  icone: ReactNode;
  titulo: string;
  children: ReactNode;
}) {
  return (
    <section className="flex gap-3 rounded-3xl bg-card p-4 shadow-sm">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-mint-soft text-primary [&>svg]:size-5">
        {icone}
      </span>
      <div>
        <h3 className="text-sm font-extrabold text-foreground">{titulo}</h3>
        <p className="mt-0.5 text-sm text-muted-foreground">{children}</p>
      </div>
    </section>
  );
}
