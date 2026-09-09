import { useEffect, useState } from "react";
import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Camera, LogOut, Users } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useSession, usePerfil } from "@/hooks/use-session";
import { BottomNav } from "@/components/goating/bottom-nav";
import { PlayerCard } from "@/components/goating/player-card";
import { RadarAttrs } from "@/components/goating/radar-attrs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
  avaliacoesFaltando,
  overallLiberado,
  paraEscalaCard,
  proximoTier,
  tierDoJogador,
} from "@/lib/tiers";

export const Route = createFileRoute("/perfil")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Meu perfil · Goating" },
      {
        name: "description",
        content:
          "Sua cartinha de jogador: overall, tier, atributos e histórico de peladas no Goating.",
      },
      { property: "og:title", content: "Meu perfil no Goating" },
      {
        property: "og:description",
        content: "Veja seu overall, seu tier e seus atributos de jogador de pelada.",
      },
      { property: "og:type", content: "profile" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Perfil,
});

const POSICOES = ["GOL", "ZAG", "LAT", "VOL", "MEI", "ATA"];

function Perfil() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { userId, carregando } = useSession();
  const { data: perfil, isLoading } = usePerfil(userId);

  const [nome, setNome] = useState("");
  const [cidade, setCidade] = useState("");
  const [bio, setBio] = useState("");
  const [posicao, setPosicao] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [fotoUrl, setFotoUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!carregando && !userId) navigate({ to: "/auth", replace: true });
  }, [carregando, userId, navigate]);

  useEffect(() => {
    if (!perfil) return;
    setNome(perfil.nome_exibicao);
    setCidade(perfil.cidade ?? "");
    setBio(perfil.bio ?? "");
    setPosicao(perfil.posicao_preferida);
  }, [perfil]);

  useEffect(() => {
    let ativo = true;
    async function carregarFoto() {
      if (!perfil?.foto_url) {
        setFotoUrl(null);
        return;
      }
      const { data } = await supabase.storage
        .from("avatars")
        .createSignedUrl(perfil.foto_url, 3600);
      if (ativo) setFotoUrl(data?.signedUrl ?? null);
    }
    void carregarFoto();
    return () => {
      ativo = false;
    };
  }, [perfil?.foto_url]);

  const medias = useQuery({
    queryKey: ["medias", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("evaluations")
        .select("chute, drible, velocidade, toque, posicionamento, comportamento, pontualidade")
        .eq("avaliado_id", userId!);
      if (error) throw error;
      const linhas = data ?? [];
      const media = (chave: keyof (typeof linhas)[number]) => {
        const valores = linhas
          .map((l) => l[chave])
          .filter((v): v is number => v !== null && v !== undefined);
        if (valores.length === 0) return 0;
        return paraEscalaCard(valores.reduce((a, b) => a + Number(b), 0) / valores.length);
      };
      return {
        chute: media("chute"),
        drible: media("drible"),
        velocidade: media("velocidade"),
        toque: media("toque"),
        posicionamento: media("posicionamento"),
        comportamento: media("comportamento"),
        pontualidade: media("pontualidade"),
      };
    },
  });

  const seguidores = useQuery({
    queryKey: ["seguidores", userId],
    enabled: !!userId,
    queryFn: async () => {
      const [a, b] = await Promise.all([
        supabase
          .from("followers")
          .select("id", { count: "exact", head: true })
          .eq("seguido_id", userId!),
        supabase
          .from("followers")
          .select("id", { count: "exact", head: true })
          .eq("seguidor_id", userId!),
      ]);
      return { seguidores: a.count ?? 0, seguindo: b.count ?? 0 };
    },
  });

  async function salvar() {
    if (!userId) return;
    setSalvando(true);
    const { error } = await supabase
      .from("profiles")
      .update({
        nome_exibicao: nome.trim(),
        cidade: cidade.trim() || null,
        bio: bio.trim() || null,
        posicao_preferida: posicao,
        perfil_completo: !!(nome.trim() && cidade.trim() && posicao),
      })
      .eq("id", userId);
    setSalvando(false);
    if (error) {
      toast.error("Não consegui salvar suas informações.");
      return;
    }
    toast.success("Perfil atualizado!");
    await queryClient.invalidateQueries({ queryKey: ["perfil", userId] });
  }

  async function trocarFoto(arquivo: File) {
    if (!userId) return;
    const caminho = `${userId}/avatar-${Date.now()}.${arquivo.name.split(".").pop() ?? "jpg"}`;
    const { error } = await supabase.storage.from("avatars").upload(caminho, arquivo, {
      upsert: true,
    });
    if (error) {
      toast.error("Não consegui enviar a foto.");
      return;
    }
    await supabase.from("profiles").update({ foto_url: caminho }).eq("id", userId);
    toast.success("Foto atualizada!");
    await queryClient.invalidateQueries({ queryKey: ["perfil", userId] });
  }

  async function sair() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  if (carregando || isLoading || !perfil) {
    return (
      <div className="mx-auto min-h-screen w-full max-w-[480px] space-y-4 bg-background p-4">
        <Skeleton className="h-72 w-full rounded-2xl" />
        <Skeleton className="h-40 w-full rounded-2xl" />
      </div>
    );
  }

  const overall = overallLiberado(perfil.avaliacoes_recebidas) ? Number(perfil.overall) : 0;
  const tier = overallLiberado(perfil.avaliacoes_recebidas)
    ? tierDoJogador(overall, perfil.peladas_jogadas)
    : null;
  const proximo = proximoTier(overall, perfil.peladas_jogadas);
  const attrs = medias.data ?? {
    chute: 0,
    drible: 0,
    velocidade: 0,
    toque: 0,
    posicionamento: 0,
    comportamento: 0,
    pontualidade: 0,
  };

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-[480px] flex-col bg-background">
      <header className="bg-primary px-4 pt-6 pb-8">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-bold text-primary-foreground">Meu perfil</h1>
          <Button
            variant="ghost"
            size="sm"
            onClick={sair}
            className="text-mint hover:bg-mint/10 hover:text-mint"
          >
            <LogOut className="size-4" /> Sair
          </Button>
        </div>

        <div className="mt-5">
          <PlayerCard
            nome={perfil.nome_exibicao}
            posicao={perfil.posicao_preferida}
            overall={overall}
            atributos={attrs}
            fotoUrl={fotoUrl}
            tier={tier}
            cardGeradoUrl={perfil.card_gerado_url}
            avaliacoesRecebidas={perfil.avaliacoes_recebidas}
          />
        </div>

        <label className="mx-auto mt-4 flex w-fit cursor-pointer items-center gap-2 rounded-full bg-mint/15 px-3 py-1.5 text-xs font-semibold text-mint">
          <Camera className="size-4" />
          Trocar foto
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void trocarFoto(f);
            }}
          />
        </label>
      </header>

      <main className="flex-1 space-y-4 px-4 py-4">
        <section className="grid grid-cols-3 gap-2">
          {[
            ["Peladas", perfil.peladas_jogadas],
            ["MVPs", perfil.vezes_mvp],
            ["Avaliações", perfil.avaliacoes_recebidas],
          ].map(([label, valor]) => (
            <div key={String(label)} className="rounded-2xl bg-card p-3 text-center shadow-[var(--shadow-card)]">
              <p className="text-xl font-extrabold text-foreground">{valor}</p>
              <p className="text-[11px] font-medium text-muted-foreground">{label}</p>
            </div>
          ))}
        </section>

        <section className="flex items-center justify-between rounded-2xl bg-card p-4 shadow-[var(--shadow-card)]">
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Users className="size-4" />
            <span className="font-bold text-foreground">{seguidores.data?.seguidores ?? 0}</span>{" "}
            seguidores
          </p>
          <p className="text-sm text-muted-foreground">
            <span className="font-bold text-foreground">{seguidores.data?.seguindo ?? 0}</span>{" "}
            seguindo
          </p>
        </section>

        {!overallLiberado(perfil.avaliacoes_recebidas) && (
          <p className="rounded-2xl bg-mint-soft p-4 text-xs font-medium text-primary">
            Faltam {avaliacoesFaltando(perfil.avaliacoes_recebidas)} avaliações pós-pelada para
            liberar seu overall e sua cartinha.
          </p>
        )}

        {proximo && (
          <p className="rounded-2xl bg-card p-4 text-xs text-muted-foreground shadow-[var(--shadow-card)]">
            Próximo tier: <span className="font-bold text-foreground">{proximo.nome}</span> —
            precisa de overall {proximo.overallMinimo} e {proximo.peladasMinimas} peladas.
          </p>
        )}

        <section className="rounded-2xl bg-primary p-4">
          <h2 className="mb-2 text-sm font-bold text-primary-foreground">Atributos</h2>
          <RadarAttrs
            eixos={[
              { label: "Chute", valor: attrs.chute },
              { label: "Drible", valor: attrs.drible },
              { label: "Velocidade", valor: attrs.velocidade },
              { label: "Toque", valor: attrs.toque },
              { label: "Posição", valor: attrs.posicionamento },
              { label: "Postura", valor: attrs.comportamento },
              { label: "Pontual", valor: attrs.pontualidade },
            ]}
          />
        </section>

        <section className="space-y-3 rounded-2xl bg-card p-4 shadow-[var(--shadow-card)]">
          <h2 className="text-sm font-bold text-foreground">Informações</h2>
          <div className="space-y-1.5">
            <Label htmlFor="nome">Nome de exibição</Label>
            <Input id="nome" value={nome} onChange={(e) => setNome(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cidade">Cidade</Label>
            <Input id="cidade" value={cidade} onChange={(e) => setCidade(e.target.value)} />
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
          <div className="space-y-1.5">
            <Label htmlFor="bio">Bio</Label>
            <Textarea
              id="bio"
              value={bio}
              maxLength={160}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Joga onde? Qual seu estilo?"
            />
          </div>
          <Button onClick={salvar} disabled={salvando || !nome.trim()} className="w-full">
            {salvando ? "Salvando..." : "Salvar alterações"}
          </Button>
        </section>

        <Button asChild variant="secondary" className="w-full">
          <Link to="/">Voltar ao feed</Link>
        </Button>
      </main>

      <BottomNav />
    </div>
  );
}
