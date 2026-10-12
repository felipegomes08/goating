import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Star } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { ListaDeComentarios } from "@/components/goating/comentarios-do-jogador";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";

/** Os cinco critérios da avaliação de uma turma (colunas de `crew_reviews`). */
export const CRITERIOS_DA_TURMA = [
  { chave: "organizacao", nome: "Organização", dica: "A pelada acontece como combinado." },
  { chave: "pontualidade", nome: "Pontualidade", dica: "Começa e termina na hora." },
  { chave: "nivel", nome: "Nível do jogo", dica: "Futebol disputado e equilibrado." },
  { chave: "ambiente", nome: "Ambiente", dica: "Respeito e resenha, sem briga." },
  { chave: "estrutura", nome: "Estrutura", dica: "Campo, bola, coletes, iluminação." },
] as const;

type ChaveCriterio = (typeof CRITERIOS_DA_TURMA)[number]["chave"];
type Notas = Record<ChaveCriterio, number>;

/** Mínimo de avaliações pra turma entrar no ranking (mesma régua do overall dos jogadores). */
export const MIN_AVALIACOES_DA_TURMA = 3;

export type ResumoDaTurma = {
  total: number;
  nota: number | null;
  posso_avaliar: boolean;
  /** minha avaliação, se já fiz */
  minha: (Notas & { comentario: string | null }) | null;
} & Record<ChaveCriterio, number | null>;

const NOTA_PADRAO = 7;

/** Aba "Notas" da turma: médias por critério, comentários e o botão de avaliar. */
export function AvaliacoesDaTurma({
  crewId,
  resumo,
  onMudou,
}: {
  crewId: string;
  resumo: ResumoDaTurma;
  onMudou: () => Promise<void> | void;
}) {
  const queryClient = useQueryClient();
  const [avaliando, setAvaliando] = useState(false);
  const [notas, setNotas] = useState<Notas | null>(null);
  const [comentario, setComentario] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const atuais: Notas =
    notas ??
    (resumo.minha
      ? {
          organizacao: Number(resumo.minha.organizacao),
          pontualidade: Number(resumo.minha.pontualidade),
          nivel: Number(resumo.minha.nivel),
          ambiente: Number(resumo.minha.ambiente),
          estrutura: Number(resumo.minha.estrutura),
        }
      : {
          organizacao: NOTA_PADRAO,
          pontualidade: NOTA_PADRAO,
          nivel: NOTA_PADRAO,
          ambiente: NOTA_PADRAO,
          estrutura: NOTA_PADRAO,
        });
  const texto = comentario ?? resumo.minha?.comentario ?? "";
  const media =
    CRITERIOS_DA_TURMA.reduce((soma, c) => soma + atuais[c.chave], 0) / CRITERIOS_DA_TURMA.length;

  async function enviar() {
    setEnviando(true);
    const { error } = await supabase.rpc("avaliar_turma", {
      p_crew_id: crewId,
      p_organizacao: atuais.organizacao,
      p_pontualidade: atuais.pontualidade,
      p_nivel: atuais.nivel,
      p_ambiente: atuais.ambiente,
      p_estrutura: atuais.estrutura,
      ...(texto.trim() ? { p_comentario: texto.trim() } : {}),
    });
    setEnviando(false);
    if (error) {
      toast.error(
        /[áéíóúãõç]/i.test(error.message) ? error.message : "Não deu pra enviar a avaliação.",
      );
      return;
    }
    toast.success(resumo.minha ? "Avaliação atualizada." : "Avaliação enviada. Valeu!");
    setAvaliando(false);
    setNotas(null);
    setComentario(null);
    await queryClient.invalidateQueries({ queryKey: ["comentarios-turma", crewId] });
    await onMudou();
  }

  return (
    <>
      <section className="rounded-2xl bg-card p-4 shadow-[var(--shadow-card)]">
        <div className="flex items-center gap-3">
          <span className="flex size-14 shrink-0 flex-col items-center justify-center rounded-2xl bg-primary">
            <span className="text-xl leading-none font-black text-primary-foreground tabular-nums">
              {resumo.nota !== null ? Number(resumo.nota).toFixed(1).replace(".", ",") : "—"}
            </span>
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-foreground">
              {resumo.total === 0
                ? "Ninguém avaliou essa turma ainda"
                : `${resumo.total} ${resumo.total === 1 ? "avaliação" : "avaliações"}`}
            </p>
            <p className="text-xs text-muted-foreground">
              {resumo.total < MIN_AVALIACOES_DA_TURMA
                ? `Entra no ranking da cidade com ${MIN_AVALIACOES_DA_TURMA} avaliações.`
                : "Nota de 0 a 10, dada por quem jogou na turma."}
            </p>
          </div>
        </div>

        {resumo.total > 0 && (
          <ul className="mt-3 space-y-2">
            {CRITERIOS_DA_TURMA.map((c) => {
              const valor = Number(resumo[c.chave] ?? 0);
              return (
                <li key={c.chave} className="flex items-center gap-2 text-xs">
                  <span className="w-24 shrink-0 font-semibold text-foreground">{c.nome}</span>
                  <span className="h-2 flex-1 overflow-hidden rounded-full bg-secondary">
                    <span
                      className="block h-full rounded-full bg-mint"
                      style={{ width: `${valor * 10}%` }}
                    />
                  </span>
                  <span className="w-8 shrink-0 text-right font-extrabold text-foreground tabular-nums">
                    {valor.toFixed(1).replace(".", ",")}
                  </span>
                </li>
              );
            })}
          </ul>
        )}

        {resumo.posso_avaliar ? (
          <Button className="mt-4 w-full" onClick={() => setAvaliando(true)}>
            <Star className="mr-2 size-4" />
            {resumo.minha ? "Atualizar minha avaliação" : "Avaliar a turma"}
          </Button>
        ) : (
          <p className="mt-3 text-xs text-muted-foreground">
            Avalia quem já jogou uma pelada finalizada da turma. Dono e administradores não avaliam
            a própria turma.
          </p>
        )}
      </section>

      <ListaDeComentarios
        chave={["comentarios-turma", crewId]}
        tipo="comentario_turma"
        titulo="O que falam da turma"
        subtitulo="Comentários de quem jogou nela, com o nome de quem escreveu."
        carregar={async () => {
          const { data, error } = await supabase.rpc("comentarios_da_turma", {
            p_crew_id: crewId,
          });
          if (error) throw error;
          return data;
        }}
        apagar={async (id) => {
          const resposta = await supabase.rpc("apagar_meu_comentario_de_turma", {
            p_review_id: id,
          });
          if (!resposta.error) await onMudou();
          return resposta;
        }}
      />

      {avaliando && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/55"
          onClick={(e) => {
            if (e.target === e.currentTarget && !enviando) setAvaliando(false);
          }}
        >
          <div
            role="dialog"
            aria-label="Avaliar a turma"
            className="max-h-[92dvh] w-full max-w-[480px] space-y-4 overflow-auto rounded-t-3xl bg-card p-4 pb-6"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-extrabold text-foreground">Avaliar a turma</h2>
              <span className="text-2xl font-extrabold text-primary tabular-nums">
                {media.toFixed(1).replace(".", ",")}
              </span>
            </div>

            {CRITERIOS_DA_TURMA.map((c) => (
              <div key={c.chave}>
                <div className="flex items-baseline justify-between gap-3 text-sm">
                  <span>
                    <span className="font-semibold text-foreground">{c.nome}</span>{" "}
                    <span className="text-xs text-muted-foreground">{c.dica}</span>
                  </span>
                  <span className="shrink-0 font-bold text-primary tabular-nums">
                    {atuais[c.chave].toFixed(1).replace(".", ",")}
                  </span>
                </div>
                <Slider
                  className="mt-2"
                  value={[atuais[c.chave]]}
                  min={0}
                  max={10}
                  step={0.5}
                  onValueChange={(v) => setNotas({ ...atuais, [c.chave]: v[0] ?? 0 })}
                />
              </div>
            ))}

            <div>
              <label htmlFor="comentario-turma" className="text-sm font-semibold text-foreground">
                Comentário (opcional)
              </label>
              <Textarea
                id="comentario-turma"
                className="mt-2"
                rows={3}
                maxLength={200}
                value={texto}
                onChange={(e) => setComentario(e.target.value)}
                placeholder="Como é jogar nessa turma?"
              />
              <p className="mt-1.5 flex justify-between gap-3 text-xs text-muted-foreground">
                <span>Aparece na página da turma com o seu nome. As notas ficam anônimas.</span>
                <span className="shrink-0 tabular-nums">{texto.length}/200</span>
              </p>
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                disabled={enviando}
                onClick={() => setAvaliando(false)}
              >
                Cancelar
              </Button>
              <Button className="flex-1" disabled={enviando} onClick={() => void enviar()}>
                {enviando ? "Enviando..." : "Enviar"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
