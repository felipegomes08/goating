import { useEffect, useState } from "react";
import { ArrowRightLeft, GripVertical, HelpCircle, MousePointerClick, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { usePremiums } from "@/hooks/use-premiums";
import { SeloPremium } from "@/components/goating/selo-premium";
import { vibrar } from "@/lib/placar/alarme";
import type { JogadorDoDia } from "@/lib/placar/dados";
import { corDoTime, nomeDoTime } from "@/lib/placar/estado";
import { forcaDoJogador, type BaseDoSorteio } from "@/lib/placar/sorteio";

type Zona = number | "sem";

/** Em qual time (ou na área "sem time") o dedo está agora. */
function zonaEm(x: number, y: number): Zona | null {
  const el = document.elementFromPoint(x, y)?.closest<HTMLElement>("[data-zona-time]");
  const valor = el?.dataset["zonaTime"];
  if (valor === undefined) return null;
  return valor === "sem" ? "sem" : Number(valor);
}

/** Em cima de qual jogador o dedo está, e se é na metade de cima ou de baixo do cartão dele. */
function alvoEm(x: number, y: number): { id: string; depois: boolean } | null {
  const el = document.elementFromPoint(x, y)?.closest<HTMLElement>("[data-jogador]");
  const id = el?.dataset["jogador"];
  if (!el || !id) return null;
  const caixa = el.getBoundingClientRect();
  return { id, depois: y > caixa.top + caixa.height / 2 };
}

function etiqueta(jogador: JogadorDoDia, base: BaseDoSorteio) {
  const forca =
    base === "overall"
      ? jogador.overall !== null
        ? String(jogador.overall)
        : `~${jogador.estrelas * 20}`
      : `${jogador.estrelas}★`;
  return jogador.posicao ? `${jogador.posicao} · ${forca}` : forca;
}

/**
 * Os times lado a lado. Arrastando pela alça (⋮⋮) dá pra mudar alguém de time ou de
 * posição dentro do próprio time (soltando em cima de outro jogador); tocando em dois
 * jogadores, eles trocam de lugar.
 */
export function QuadroTimes({
  jogadores,
  numTimes,
  nomes,
  cores,
  base,
  selecionado,
  onTocar,
  onMover,
}: {
  jogadores: JogadorDoDia[];
  numTimes: number;
  nomes: string[];
  /** cor do colete de cada time (id da paleta); vazio usa a padrão */
  cores: (string | null)[];
  base: BaseDoSorteio;
  selecionado: string | null;
  onTocar: (memberId: string) => void;
  /** `antesDe`: o jogador que fica logo abaixo de onde soltou; sem ele, vai pro fim do time */
  onMover: (memberId: string, time: number | null, antesDe?: string | null) => void;
}) {
  const premiums = usePremiums(jogadores.map((j) => j.userId));
  const [arraste, setArraste] = useState<{
    memberId: string;
    nome: string;
    x: number;
    y: number;
    zona: Zona | null;
    /** jogador embaixo do dedo: a linha de "vai entrar aqui" aparece nele */
    alvo: { id: string; depois: boolean } | null;
  } | null>(null);

  const times = Array.from({ length: numTimes }, (_, i) => jogadores.filter((j) => j.time === i));
  const semTime = jogadores.filter((j) => j.time === null || j.time >= numTimes);

  const resumo = (time: JogadorDoDia[]) => {
    if (time.length === 0) return "vazio";
    const total = time.reduce((s, j) => s + forcaDoJogador(j, base), 0);
    return base === "overall"
      ? `${time.length} jogadores · média ${Math.round((total * 20) / time.length)}`
      : `${time.length} jogadores · ${total}★`;
  };

  const zonaDe = (j: JogadorDoDia): Zona => (j.time !== null && j.time < numTimes ? j.time : "sem");

  /** Onde o jogador arrastado vai parar se soltar agora: quem fica logo abaixo dele. */
  function destinoDoArraste(memberId: string, x: number, y: number) {
    const zona = zonaEm(x, y);
    if (zona === null) return null;
    const alvo = alvoEm(x, y);
    if (!alvo || alvo.id === memberId) return { zona, antesDe: undefined };
    // a lista do time de destino, sem o próprio arrastado
    const lista = jogadores.filter((j) => zonaDe(j) === zona && j.memberId !== memberId);
    const i = lista.findIndex((j) => j.memberId === alvo.id);
    if (i === -1) return { zona, antesDe: undefined };
    return { zona, antesDe: alvo.depois ? (lista[i + 1]?.memberId ?? null) : alvo.id };
  }

  const cartao = (jogador: JogadorDoDia, classe: string) => (
    <div
      key={jogador.memberId}
      data-jogador={jogador.memberId}
      className={cn(
        "relative flex items-stretch rounded-xl border-2 text-sm font-semibold text-foreground",
        classe,
        selecionado === jogador.memberId && "ring-2 ring-primary ring-offset-2",
        arraste?.memberId === jogador.memberId && "opacity-40",
      )}
    >
      {/* linha mostrando onde o jogador arrastado entra: acima ou abaixo deste */}
      {arraste &&
        arraste.alvo?.id === jogador.memberId &&
        arraste.memberId !== jogador.memberId && (
          <span
            aria-hidden
            className={cn(
              "pointer-events-none absolute inset-x-0 h-1 rounded-full bg-primary",
              arraste.alvo.depois ? "-bottom-[7px]" : "-top-[7px]",
            )}
          />
        )}
      <button
        type="button"
        aria-pressed={selecionado === jogador.memberId}
        onClick={() => onTocar(jogador.memberId)}
        className="min-w-0 flex-1 py-2 pl-2.5 text-left"
      >
        <span className="flex min-w-0 items-center gap-1">
          <span className="truncate">{jogador.nome}</span>
          {jogador.userId && premiums.has(jogador.userId) && <SeloPremium className="size-3" />}
        </span>
        <span className="block text-[10px] font-bold text-muted-foreground">
          {etiqueta(jogador, base)}
        </span>
      </button>
      {/* alça de arrastar: só ela segura o toque, o resto do cartão deixa a tela rolar */}
      <span
        role="button"
        tabIndex={-1}
        aria-label={`Arrastar ${jogador.nome} pra outro time ou outra posição`}
        className="flex w-8 shrink-0 cursor-grab touch-none items-center justify-center text-muted-foreground active:cursor-grabbing"
        onPointerDown={(e) => {
          e.preventDefault();
          try {
            // mantém os eventos chegando na alça mesmo com o dedo já em cima de outro time
            e.currentTarget.setPointerCapture(e.pointerId);
          } catch {
            // ponteiro que o navegador não deixa capturar: segue sem captura
          }
          vibrar(10);
          setArraste({
            memberId: jogador.memberId,
            nome: jogador.nome,
            x: e.clientX,
            y: e.clientY,
            zona: null,
            alvo: null,
          });
        }}
        onPointerMove={(e) => {
          if (!arraste) return;
          // perto da borda da tela, rola junto pra alcançar os times de baixo ou de cima
          if (e.clientY < 90) window.scrollBy(0, -14);
          else if (e.clientY > window.innerHeight - 130) window.scrollBy(0, 14);
          setArraste({
            ...arraste,
            x: e.clientX,
            y: e.clientY,
            zona: zonaEm(e.clientX, e.clientY),
            alvo: alvoEm(e.clientX, e.clientY),
          });
        }}
        onPointerUp={(e) => {
          if (!arraste) return;
          const destino = destinoDoArraste(jogador.memberId, e.clientX, e.clientY);
          setArraste(null);
          if (!destino) return;
          const time = destino.zona === "sem" ? null : destino.zona;
          // soltou em cima de alguém: entra naquela posição. Soltou no vazio de outro time: vai pro fim dele.
          if (destino.antesDe !== undefined) onMover(jogador.memberId, time, destino.antesDe);
          else if (destino.zona !== zonaDe(jogador)) onMover(jogador.memberId, time);
        }}
        onPointerCancel={() => setArraste(null)}
      >
        <GripVertical className="size-4" />
      </span>
    </div>
  );

  return (
    <>
      {selecionado ? (
        <p className="rounded-xl bg-mint-soft px-3 py-2 text-xs font-semibold text-primary">
          Agora toque em outro jogador pra trocar os dois, ou em “Mover pra cá” num time.
        </p>
      ) : (
        <ComoMexer />
      )}

      <div className="grid grid-cols-2 gap-3">
        {times.map((time, i) => {
          const cor = corDoTime(i, cores);
          const naMira = arraste?.zona === i;
          return (
            <div
              key={i}
              data-zona-time={i}
              className={cn(
                "min-w-0 space-y-1.5 rounded-2xl p-1 transition-colors",
                naMira && cn(cor.fundo, "ring-2", cor.ring),
              )}
            >
              <div className={cn("border-b-4 pb-1", cor.borda)}>
                <p className={cn("truncate text-sm font-extrabold uppercase", cor.texto)}>
                  {nomeDoTime(nomes, i)}
                </p>
                <p className="text-[11px] text-muted-foreground">{resumo(time)}</p>
              </div>
              {time.map((j) => cartao(j, cn(cor.fundo, cor.borda)))}
              {selecionado && !time.some((j) => j.memberId === selecionado) && (
                <button
                  type="button"
                  onClick={() => onMover(selecionado, i)}
                  className={cn(
                    "w-full rounded-xl border border-dashed py-2 text-xs font-bold",
                    cor.borda,
                    cor.texto,
                  )}
                >
                  Mover pra cá
                </button>
              )}
              {/* time vazio ainda precisa de altura pra receber alguém arrastado */}
              {time.length === 0 && !selecionado && (
                <p className="rounded-xl border border-dashed border-border py-4 text-center text-[11px] text-muted-foreground">
                  Arraste alguém pra cá
                </p>
              )}
            </div>
          );
        })}
      </div>

      {(semTime.length > 0 || arraste) && (
        <div
          data-zona-time="sem"
          className={cn(
            "space-y-1.5 rounded-2xl p-1 transition-colors",
            arraste?.zona === "sem" && "bg-secondary ring-2 ring-border",
          )}
        >
          <p className="text-xs font-bold text-muted-foreground uppercase">
            Sem time ({semTime.length})
          </p>
          {semTime.length === 0 ? (
            <p className="rounded-xl border border-dashed border-border py-3 text-center text-[11px] text-muted-foreground">
              Solte aqui pra deixar de fora
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-1.5">
              {semTime.map((j) => cartao(j, "border-border bg-card"))}
            </div>
          )}
        </div>
      )}

      {arraste && (
        <div
          className="pointer-events-none fixed top-0 left-0 z-50 max-w-44 truncate rounded-xl bg-primary px-3 py-2 text-sm font-bold text-primary-foreground shadow-[var(--shadow-float)]"
          style={{ transform: `translate(${arraste.x + 12}px, ${arraste.y - 44}px)` }}
        >
          {arraste.nome}
        </div>
      )}
    </>
  );
}

const CHAVE_DICA = "goating-dica-times-vista";

/**
 * Como mexer nos times depois do sorteio. Aparece aberto na primeira vez; depois de fechado
 * vira só um botão "Como funciona?".
 */
function ComoMexer() {
  const [aberto, setAberto] = useState(true);
  // lido depois de montar: no servidor não existe localStorage
  useEffect(() => {
    try {
      if (localStorage.getItem(CHAVE_DICA) === "1") setAberto(false);
    } catch {
      // sem armazenamento: fica aberto
    }
  }, []);

  function fechar() {
    setAberto(false);
    try {
      localStorage.setItem(CHAVE_DICA, "1");
    } catch {
      // sem armazenamento: só fecha
    }
  }

  if (!aberto) {
    return (
      <button
        type="button"
        onClick={() => setAberto(true)}
        className="flex items-center gap-1.5 text-xs font-semibold text-primary"
      >
        <HelpCircle className="size-4" /> Como mexer nos times?
      </button>
    );
  }

  const dicas = [
    {
      icone: MousePointerClick,
      texto: "Toque em um jogador e depois em outro: os dois trocam de lugar.",
    },
    {
      icone: GripVertical,
      texto: "Segure a alça ⋮⋮ e arraste pra mudar de time ou de posição no time.",
    },
    {
      icone: ArrowRightLeft,
      texto: "Com um jogador marcado, toque em “Mover pra cá” pra levar ele pra outro time.",
    },
  ];

  return (
    <div className="relative space-y-2 rounded-2xl border border-mint/60 bg-mint-soft/60 p-3">
      <button
        type="button"
        aria-label="Fechar dicas"
        onClick={fechar}
        className="absolute top-2 right-2 p-1 text-muted-foreground"
      >
        <X className="size-4" />
      </button>
      <p className="text-sm font-bold text-foreground">Como mexer nos times</p>
      {dicas.map(({ icone: Icone, texto }) => (
        <div key={texto} className="flex items-start gap-2 pr-4 text-xs text-foreground">
          <Icone className="mt-0.5 size-4 shrink-0 text-primary" />
          <span>{texto}</span>
        </div>
      ))}
      <button type="button" onClick={fechar} className="text-xs font-semibold text-primary">
        Entendi
      </button>
    </div>
  );
}
