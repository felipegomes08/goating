import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { CalendarPlus, Crown, Shuffle, Star, Trophy, Users } from "lucide-react";
import { GoatingLogo } from "@/components/goating/logo";
import { Button } from "@/components/ui/button";

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
