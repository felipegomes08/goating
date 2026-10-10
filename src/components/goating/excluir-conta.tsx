import { useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const PALAVRA = "EXCLUIR";

/** Rodapé do perfil: política de privacidade e exclusão da conta (exigida pelas lojas de app). */
export function ExcluirConta({ userId }: { userId: string }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [aberto, setAberto] = useState(false);
  const [texto, setTexto] = useState("");
  const [excluindo, setExcluindo] = useState(false);

  async function excluir() {
    setExcluindo(true);
    try {
      // As fotos ficam em arquivos, fora do banco: saem primeiro, senão ficariam órfãs.
      const { data: fotos } = await supabase.storage.from("avatars").list(userId);
      if (fotos && fotos.length > 0) {
        await supabase.storage.from("avatars").remove(fotos.map((f) => `${userId}/${f.name}`));
      }
      const { error } = await supabase.rpc("excluir_minha_conta");
      if (error) throw error;

      await queryClient.cancelQueries();
      queryClient.clear();
      // a conta já não existe no servidor: basta esquecer a sessão neste aparelho
      await supabase.auth.signOut({ scope: "local" });
      toast.success("Conta excluída.");
      await navigate({ to: "/auth", replace: true });
    } catch {
      toast.error("Não deu pra excluir a conta agora. Tenta de novo com internet.");
      setExcluindo(false);
    }
  }

  return (
    <>
      <div className="flex items-center justify-between px-1 pt-2 text-xs">
        <Link to="/privacidade" className="font-medium text-muted-foreground underline">
          Política de privacidade
        </Link>
        <button
          type="button"
          onClick={() => setAberto(true)}
          className="font-medium text-destructive underline"
        >
          Excluir minha conta
        </button>
      </div>

      {aberto && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/55"
          onClick={(e) => {
            if (e.target === e.currentTarget && !excluindo) setAberto(false);
          }}
        >
          <div
            role="dialog"
            aria-label="Excluir minha conta"
            className="max-h-[90dvh] w-full max-w-[480px] space-y-3 overflow-auto rounded-t-3xl bg-card p-4 pb-6"
          >
            <h2 className="text-lg font-extrabold text-foreground">Excluir sua conta?</h2>
            <p className="text-sm text-muted-foreground">Isso não tem volta. Ao excluir:</p>
            <ul className="list-disc space-y-1.5 pl-5 text-sm text-foreground">
              <li>seu perfil, foto, cartinha, avaliações e seguidores são apagados;</li>
              <li>
                nas turmas em que você joga, seus gols e vitórias continuam no ranking só com o seu
                nome, sem ligação com você;
              </li>
              <li>
                turmas que você criou passam pra um administrador ou outro jogador com conta; se não
                houver ninguém, são apagadas com as peladas delas.
              </li>
            </ul>
            <p className="text-sm text-foreground">
              Pra confirmar, digite <strong>{PALAVRA}</strong>:
            </p>
            <Input
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              autoCapitalize="characters"
              autoCorrect="off"
              spellCheck={false}
              placeholder={PALAVRA}
            />
            <Button
              variant="destructive"
              className="w-full"
              disabled={excluindo || texto.trim().toUpperCase() !== PALAVRA}
              onClick={excluir}
            >
              {excluindo ? "Excluindo…" : "Excluir minha conta pra sempre"}
            </Button>
            <Button
              variant="outline"
              className="w-full"
              disabled={excluindo}
              onClick={() => {
                setAberto(false);
                setTexto("");
              }}
            >
              Manter minha conta
            </Button>
          </div>
        </div>
      )}
    </>
  );
}
