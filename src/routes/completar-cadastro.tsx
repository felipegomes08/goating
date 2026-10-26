import { useEffect, useState } from "react";
import { createFileRoute, useNavigate, useRouter } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { esquecerPushNoApp } from "@/lib/nativo";
import { useSession, usePerfil } from "@/hooks/use-session";
import { salvarCelular, useCelular } from "@/hooks/use-celular";
import { GoatingLogo } from "@/components/goating/logo";
import { CidadeCombobox } from "@/components/goating/cidade-combobox";
import { CampoCelular } from "@/components/goating/campo-celular";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { POSICOES, cadastroCompleto } from "@/lib/cadastro";
import { problemaDoCelular } from "@/lib/celular";

/** Só caminhos do próprio app ("/turma/..."), nunca outro site ("//site.com"). */
function destinoSeguro(voltar: unknown) {
  return typeof voltar === "string" && voltar.startsWith("/") && !voltar.startsWith("//")
    ? voltar
    : "/";
}

export const Route = createFileRoute("/completar-cadastro")({
  ssr: false,
  validateSearch: (search: Record<string, unknown>): { voltar?: string | undefined } => ({
    voltar: typeof search["voltar"] === "string" ? search["voltar"] : undefined,
  }),
  head: () => ({ meta: [{ title: "Complete seu cadastro · Goating" }] }),
  component: CompletarCadastro,
});

/**
 * Tela obrigatória pra quem ainda não tem nome, cidade e posição: o app fica travado nela
 * (veja CadastroObrigatorio) até salvar. O celular é opcional.
 */
function CompletarCadastro() {
  const navigate = useNavigate();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { voltar } = Route.useSearch();
  const { userId, carregando } = useSession();
  const { data: perfil } = usePerfil(userId);
  const celularSalvo = useCelular(userId);

  const [nome, setNome] = useState("");
  const [cidade, setCidade] = useState("");
  const [posicao, setPosicao] = useState<string | null>(null);
  const [celular, setCelular] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [preenchido, setPreenchido] = useState(false);

  useEffect(() => {
    if (!carregando && !userId) void navigate({ to: "/auth", replace: true });
  }, [carregando, userId, navigate]);

  // preenche uma vez com o que já existe (o nome vem do cadastro ou do Google)
  useEffect(() => {
    if (preenchido || !perfil || celularSalvo.isLoading) return;
    setNome(perfil.nome_exibicao);
    setCidade(perfil.cidade ?? "");
    setPosicao(perfil.posicao_preferida);
    setCelular(celularSalvo.data ?? "");
    setPreenchido(true);
  }, [perfil, celularSalvo.isLoading, celularSalvo.data, preenchido]);

  const problemaCelular = problemaDoCelular(celular);
  const falta = !nome.trim()
    ? "Coloque seu nome."
    : !cidade
      ? "Escolha sua cidade."
      : !posicao
        ? "Escolha sua posição."
        : null;

  async function salvar() {
    if (!userId || falta || problemaCelular) return;
    setSalvando(true);
    const [perfilSalvo, celularGravado] = await Promise.all([
      supabase
        .from("profiles")
        .update({
          nome_exibicao: nome.trim(),
          cidade,
          posicao_preferida: posicao,
          perfil_completo: true,
        })
        .eq("id", userId),
      celular || celularSalvo.data ? salvarCelular(userId, celular) : null,
    ]);
    setSalvando(false);
    if (perfilSalvo.error || celularGravado?.error) {
      toast.error("Não consegui salvar. Tenta de novo.");
      return;
    }
    await queryClient.invalidateQueries({ queryKey: ["perfil", userId] });
    await queryClient.invalidateQueries({ queryKey: ["celular", userId] });
    toast.success("Cadastro completo! Bora pro jogo.");
    router.history.replace(destinoSeguro(voltar));
  }

  async function sair() {
    await esquecerPushNoApp();
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    void navigate({ to: "/auth", replace: true });
  }

  // já completo (abriu a tela direto): segue pro destino
  useEffect(() => {
    if (perfil && cadastroCompleto(perfil) && !salvando) {
      router.history.replace(destinoSeguro(voltar));
    }
  }, [perfil, salvando, router, voltar]);

  return (
    <div className="app-shell flex flex-col bg-primary px-6 py-8">
      <div className="mb-6 text-center">
        <div className="flex justify-center">
          <GoatingLogo withWordmark iconTone="light" wordmarkTone="dark" />
        </div>
        <h1 className="mt-5 text-2xl font-extrabold text-primary-foreground">
          Complete seu cadastro
        </h1>
        <p className="mt-1 text-sm text-mint">
          Falta pouco. Com a sua cidade a gente mostra as peladas e os rankings perto de você.
        </p>
      </div>

      {!preenchido ? (
        <Skeleton className="h-96 w-full rounded-2xl" />
      ) : (
        <form
          className="space-y-4 rounded-2xl bg-card p-5 shadow-[var(--shadow-card)]"
          onSubmit={(e) => {
            e.preventDefault();
            void salvar();
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor="nome">Nome de exibição</Label>
            <Input
              id="nome"
              value={nome}
              maxLength={40}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Como a galera te chama"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Cidade</Label>
            <CidadeCombobox value={cidade || null} onChange={setCidade} />
          </div>
          <div className="space-y-1.5">
            <Label>Posição preferida</Label>
            <div className="flex flex-wrap gap-2">
              {POSICOES.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPosicao(p)}
                  className={
                    posicao === p
                      ? "rounded-full bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground"
                      : "rounded-full bg-muted px-3 py-1.5 text-xs font-semibold text-muted-foreground"
                  }
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
          <CampoCelular value={celular} onChange={setCelular} />

          <Button
            type="submit"
            className="w-full"
            disabled={salvando || !!falta || !!problemaCelular}
          >
            {salvando ? "Salvando..." : "Salvar e continuar"}
          </Button>
          {falta && <p className="text-center text-xs text-muted-foreground">{falta}</p>}
        </form>
      )}

      <button
        type="button"
        onClick={() => void sair()}
        className="mt-6 text-center text-xs font-semibold text-mint underline"
      >
        Sair desta conta
      </button>
    </div>
  );
}
