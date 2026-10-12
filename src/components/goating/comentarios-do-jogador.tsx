import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Flag, MessageSquareText, Trash2, User } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAvatarUrl } from "@/hooks/use-avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

type Comentario = {
  id: string;
  autor_id: string;
  autor_nome: string;
  autor_foto: string | null;
  comentario: string;
  criado_em: string;
  pelada: string;
  meu: boolean;
  denunciei: boolean;
  oculto: boolean;
};

/** As mensagens das funções do banco já vêm em português e explicam o motivo. */
const mensagem = (erro: { message: string }, reserva: string) =>
  /[áéíóúãõç]/i.test(erro.message) ? erro.message : reserva;

/**
 * O que escreveram sobre um jogador nas avaliações pós-pelada. Cada comentário é
 * assinado; as notas de quem comentou não aparecem. Quem escreveu pode apagar o seu,
 * e qualquer outro pode denunciar.
 */
export function ComentariosDoJogador({ userId, proprio }: { userId: string; proprio: boolean }) {
  const queryClient = useQueryClient();
  const [denunciando, setDenunciando] = useState<Comentario | null>(null);
  const [motivo, setMotivo] = useState("");
  const [ocupado, setOcupado] = useState(false);

  const consulta = useQuery({
    queryKey: ["comentarios", userId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("comentarios_do_jogador", { p_user_id: userId });
      if (error) throw error;
      return data as Comentario[];
    },
  });
  const comentarios = consulta.data ?? [];

  async function apagar(c: Comentario) {
    setOcupado(true);
    const { error } = await supabase.rpc("apagar_meu_comentario", { p_evaluation_id: c.id });
    setOcupado(false);
    if (error) {
      toast.error(mensagem(error, "Não deu pra apagar o comentário."));
      return;
    }
    toast.success("Comentário apagado.");
    await queryClient.invalidateQueries({ queryKey: ["comentarios", userId] });
  }

  async function denunciar() {
    if (!denunciando) return;
    setOcupado(true);
    const { error } = await supabase.rpc("denunciar_comentario", {
      p_tipo: "comentario_jogador",
      p_alvo_id: denunciando.id,
      ...(motivo.trim() ? { p_motivo: motivo.trim() } : {}),
    });
    setOcupado(false);
    if (error) {
      toast.error(mensagem(error, "Não deu pra enviar a denúncia."));
      return;
    }
    toast.success("Denúncia enviada. Obrigado por avisar.");
    setDenunciando(null);
    setMotivo("");
    await queryClient.invalidateQueries({ queryKey: ["comentarios", userId] });
  }

  // sem comentário nenhum a seção nem aparece: perfil novo não precisa de um quadro vazio
  if (consulta.isLoading || comentarios.length === 0) return null;

  return (
    <section className="rounded-2xl bg-card p-4 shadow-[var(--shadow-card)]">
      <h2 className="flex items-center gap-2 text-sm font-bold text-foreground">
        <MessageSquareText className="size-4 text-primary" />
        {proprio ? "O que falam de você" : "O que falam desse jogador"}
      </h2>
      <p className="mt-0.5 text-xs text-muted-foreground">
        Comentários de quem jogou junto, deixados na avaliação pós-pelada.
      </p>

      <ul className="mt-2 divide-y divide-border">
        {comentarios.map((c) => (
          <li key={c.id} className="py-3">
            <div className="flex items-center gap-2">
              <FotoDoAutor foto={c.autor_foto} />
              <div className="min-w-0 flex-1">
                <Link
                  to="/jogador/$id"
                  params={{ id: c.autor_id }}
                  className="block truncate text-sm font-bold text-foreground"
                >
                  {c.meu ? "Você" : c.autor_nome}
                </Link>
                <p className="truncate text-[11px] text-muted-foreground">
                  {c.pelada} ·{" "}
                  {new Date(c.criado_em).toLocaleDateString("pt-BR", {
                    day: "2-digit",
                    month: "short",
                    year: "numeric",
                  })}
                </p>
              </div>
              {c.meu ? (
                <button
                  type="button"
                  aria-label="Apagar meu comentário"
                  disabled={ocupado}
                  onClick={() => void apagar(c)}
                  className="flex size-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground"
                >
                  <Trash2 className="size-4" />
                </button>
              ) : c.denunciei ? (
                <span className="shrink-0 text-[11px] font-semibold text-muted-foreground">
                  Denunciado
                </span>
              ) : (
                <button
                  type="button"
                  aria-label={`Denunciar o comentário de ${c.autor_nome}`}
                  onClick={() => setDenunciando(c)}
                  className="flex size-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground"
                >
                  <Flag className="size-4" />
                </button>
              )}
            </div>
            <p className="mt-1.5 text-sm break-words whitespace-pre-line text-foreground">
              {c.comentario}
            </p>
            {c.oculto && (
              <p className="mt-1 text-[11px] font-medium text-destructive">
                Escondido dos outros por denúncias. Só você está vendo.
              </p>
            )}
          </li>
        ))}
      </ul>

      {denunciando && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/55"
          onClick={(e) => {
            if (e.target === e.currentTarget && !ocupado) setDenunciando(null);
          }}
        >
          <div
            role="dialog"
            aria-label="Denunciar comentário"
            className="w-full max-w-[480px] space-y-3 rounded-t-3xl bg-card p-4 pb-6"
          >
            <h2 className="text-lg font-extrabold text-foreground">Denunciar comentário</h2>
            <p className="rounded-xl bg-secondary/60 p-3 text-sm text-foreground">
              “{denunciando.comentario}”
            </p>
            <p className="text-sm text-muted-foreground">
              Use pra ofensa, mentira grave ou exposição de alguém. A denúncia é anônima: quem
              escreveu não fica sabendo que foi você.
            </p>
            <Textarea
              value={motivo}
              maxLength={200}
              rows={2}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="O que tem de errado? (opcional)"
            />
            <Button
              variant="destructive"
              className="w-full"
              disabled={ocupado}
              onClick={() => void denunciar()}
            >
              Enviar denúncia
            </Button>
            <Button
              variant="outline"
              className="w-full"
              disabled={ocupado}
              onClick={() => setDenunciando(null)}
            >
              Cancelar
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}

/** O caminho da foto é de um bucket privado: sem URL assinada a imagem aparece quebrada. */
function FotoDoAutor({ foto }: { foto: string | null }) {
  const url = useAvatarUrl(foto);
  return (
    <span className="flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted">
      {url ? (
        <img src={url} alt="" className="size-full object-cover" />
      ) : (
        <User className="size-4 text-muted-foreground" />
      )}
    </span>
  );
}
