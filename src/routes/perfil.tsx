import { useEffect, useState } from "react";
import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Camera, LogOut, Pencil, Users } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useSession, usePerfil } from "@/hooks/use-session";
import { BottomNav } from "@/components/goating/bottom-nav";
import { CidadeCombobox } from "@/components/goating/cidade-combobox";
import { AuraTier } from "@/components/goating/aura-tier";
import { PlayerCard } from "@/components/goating/player-card";
import { ProgressoTier } from "@/components/goating/progresso-tier";
import { RadarAttrs } from "@/components/goating/radar-attrs";
import { MEDIAS_ZERADAS, SELECT_ATRIBUTOS, mediasAtributos } from "@/lib/atributos";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { NICK_MAX, normalizarNick, problemaDoNick } from "@/lib/nick";
import { avaliacoesFaltando, overallLiberado, tierPorNome } from "@/lib/tiers";

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
  const [nick, setNick] = useState("");
  const [editando, setEditando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [fotoUrl, setFotoUrl] = useState<string | null>(null);
  const [abrindo, setAbrindo] = useState(false);
  const [revelando, setRevelando] = useState(false);

  useEffect(() => {
    if (!carregando && !userId) navigate({ to: "/auth", replace: true });
  }, [carregando, userId, navigate]);

  function carregarCampos() {
    if (!perfil) return;
    setNome(perfil.nome_exibicao);
    setNick(perfil.handle ?? "");
    setCidade(perfil.cidade ?? "");
    setBio(perfil.bio ?? "");
    setPosicao(perfil.posicao_preferida);
  }

  // Só sincroniza fora da edição: o perfil recarregar (foto nova, avaliação) não pode
  // apagar o que a pessoa está digitando.
  useEffect(() => {
    if (!editando) carregarCampos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [perfil, editando]);

  function cancelarEdicao() {
    carregarCampos();
    setEditando(false);
  }

  const problemaNick = problemaDoNick(nick);
  const nickMudou = nick !== (perfil?.handle ?? "");
  const [nickConsultado, setNickConsultado] = useState("");
  useEffect(() => {
    const espera = setTimeout(() => setNickConsultado(nick), 350);
    return () => clearTimeout(espera);
  }, [nick]);
  const nickLivre = useQuery({
    queryKey: ["nick-livre", nickConsultado],
    enabled: editando && nickMudou && !problemaNick && nickConsultado === nick,
    queryFn: async () => {
      const { count, error } = await supabase
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .eq("handle", nickConsultado);
      if (error) throw error;
      return (count ?? 0) === 0;
    },
  });
  const nickOcupado = nickMudou && !problemaNick && nickLivre.data === false;
  // Nick antigo (gerado no cadastro) que não foi mexido nunca trava o salvar dos outros campos.
  const nickBloqueado = nickMudou && (!!problemaNick || nickOcupado);
  const avisoDoNick =
    nickMudou && problemaNick
      ? problemaNick
      : nickOcupado
        ? "Esse nick já tem dono. Tenta outro."
        : nickMudou && nickLivre.data === true && nickConsultado === nick
          ? `@${nick} está livre.`
          : "Único no Goating. É por ele que a galera te acha na busca.";

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
        .select(SELECT_ATRIBUTOS)
        .eq("avaliado_id", userId!);
      if (error) throw error;
      return mediasAtributos(data ?? []);
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
    if (!userId || nickBloqueado) return;
    setSalvando(true);
    const { error } = await supabase
      .from("profiles")
      .update({
        nome_exibicao: nome.trim(),
        ...(nickMudou ? { handle: nick } : {}),
        cidade: cidade.trim() || null,
        bio: bio.trim() || null,
        posicao_preferida: posicao,
        perfil_completo: !!(nome.trim() && cidade.trim() && posicao),
      })
      .eq("id", userId);
    setSalvando(false);
    if (error) {
      // 23505 = alguém pegou o mesmo nick entre a checagem e o salvar
      toast.error(
        error.code === "23505"
          ? "Esse nick acabou de ser pego. Tenta outro."
          : "Não consegui salvar suas informações.",
      );
      return;
    }
    toast.success("Perfil atualizado!");
    await queryClient.invalidateQueries({ queryKey: ["perfil", userId] });
    await queryClient.invalidateQueries({ queryKey: ["nick-livre"] });
    setEditando(false);
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
  // O tier exibido é sempre o "reconhecido" (já revelado) — nunca pula direto pro tier
  // calculado ao vivo enquanto tiver recompensa pendente pra abrir.
  const tier = overallLiberado(perfil.avaliacoes_recebidas)
    ? tierPorNome(perfil.tier_reconhecido)
    : null;

  async function revelarTier() {
    setAbrindo(true);
    // A confirmação já vai pro banco assim que clica — se o app fechar durante a
    // suspense ou a animação, ao reabrir já está com o tier novo garantido.
    const chamada = supabase.rpc("reivindicar_tier");
    const suspense = new Promise((resolve) => setTimeout(resolve, 1300));
    const [{ data, error }] = await Promise.all([chamada, suspense]);
    if (error || !data) {
      toast.error("Não deu pra revelar sua recompensa agora.");
      setAbrindo(false);
      return;
    }
    await queryClient.invalidateQueries({ queryKey: ["perfil", userId] });
    setAbrindo(false);
    setRevelando(true);
    setTimeout(() => setRevelando(false), 1600);
  }
  const attrs = medias.data ?? MEDIAS_ZERADAS;

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-[480px] flex-col bg-background">
      <header className="relative isolate overflow-hidden bg-primary px-4 pt-6 pb-8">
        <AuraTier tier={tier} />
        <div className="relative flex items-center justify-between">
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

        <div className="relative mt-5">
          <PlayerCard
            nome={perfil.nome_exibicao}
            posicao={perfil.posicao_preferida}
            overall={overall}
            atributos={attrs}
            fotoUrl={fotoUrl}
            tier={tier}
            cardGeradoUrl={perfil.card_gerado_url}
            avaliacoesRecebidas={perfil.avaliacoes_recebidas}
            recompensaPendente={!!perfil.tier_pendente}
            abrindo={abrindo}
            revelando={revelando}
            onRevelar={revelarTier}
          />
        </div>

        <label className="relative mx-auto mt-4 flex w-fit cursor-pointer items-center gap-2 rounded-full bg-mint/15 px-3 py-1.5 text-xs font-semibold text-mint">
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
        <section className="grid grid-cols-2 gap-2">
          {[
            ["Peladas", perfil.peladas_jogadas],
            ["XP", perfil.xp],
            ["MVPs", perfil.vezes_mvp],
            ["Avaliações", perfil.avaliacoes_recebidas],
          ].map(([label, valor]) => (
            <div
              key={String(label)}
              className="rounded-2xl bg-card p-3 text-center shadow-[var(--shadow-card)]"
            >
              <p className="text-xl font-extrabold text-foreground">{valor}</p>
              <p className="text-[11px] font-medium text-muted-foreground">{label}</p>
            </div>
          ))}
        </section>

        <section className="flex items-center justify-between rounded-2xl bg-card p-4 shadow-[var(--shadow-card)]">
          <Link
            to="/rede"
            search={{ aba: "seguidores" }}
            className="flex items-center gap-2 text-sm text-muted-foreground"
          >
            <Users className="size-4" />
            <span className="font-bold text-foreground">
              {seguidores.data?.seguidores ?? 0}
            </span>{" "}
            seguidores
          </Link>
          <Link to="/rede" search={{ aba: "seguindo" }} className="text-sm text-muted-foreground">
            <span className="font-bold text-foreground">{seguidores.data?.seguindo ?? 0}</span>{" "}
            seguindo
          </Link>
        </section>

        {!overallLiberado(perfil.avaliacoes_recebidas) && (
          <p className="rounded-2xl bg-mint-soft p-4 text-xs font-medium text-primary">
            Faltam {avaliacoesFaltando(perfil.avaliacoes_recebidas)} avaliações pós-pelada para
            liberar seu overall e sua cartinha.
          </p>
        )}

        <ProgressoTier
          tier={tier}
          overall={overall}
          xp={perfil.xp}
          avaliacoes={perfil.avaliacoes_recebidas}
          recompensaPendente={!!perfil.tier_pendente}
        />

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
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-foreground">Informações</h2>
            {!editando && (
              <Button variant="outline" size="sm" onClick={() => setEditando(true)}>
                <Pencil className="size-3.5" /> Editar
              </Button>
            )}
          </div>

          {!editando ? (
            <dl className="divide-y divide-border text-sm">
              {[
                ["Nome", perfil.nome_exibicao],
                ["Nick", perfil.handle ? `@${perfil.handle}` : "sem nick"],
                ["Cidade", perfil.cidade ?? "não informada"],
                ["Posição", perfil.posicao_preferida ?? "não informada"],
                ["Bio", perfil.bio ?? "—"],
              ].map(([rotulo, valor]) => (
                <div key={rotulo} className="flex gap-3 py-2">
                  <dt className="w-16 shrink-0 text-muted-foreground">{rotulo}</dt>
                  <dd className="min-w-0 flex-1 font-semibold break-words text-foreground">
                    {valor}
                  </dd>
                </div>
              ))}
            </dl>
          ) : (
            <>
              <div className="space-y-1.5">
                <Label htmlFor="nome">Nome de exibição</Label>
                <Input id="nome" value={nome} onChange={(e) => setNome(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="nick">Nick</Label>
                <div className="relative">
                  <span className="absolute top-1/2 left-3 -translate-y-1/2 text-sm font-semibold text-muted-foreground">
                    @
                  </span>
                  <Input
                    id="nick"
                    value={nick}
                    maxLength={NICK_MAX}
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                    onChange={(e) => setNick(normalizarNick(e.target.value))}
                    className="pl-7"
                  />
                </div>
                <p
                  className={
                    nickBloqueado
                      ? "text-xs font-medium text-destructive"
                      : "text-xs text-muted-foreground"
                  }
                >
                  {avisoDoNick}
                </p>
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
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  disabled={salvando}
                  onClick={cancelarEdicao}
                >
                  Cancelar
                </Button>
                <Button
                  onClick={salvar}
                  disabled={salvando || !nome.trim() || nickBloqueado || nickLivre.isFetching}
                  className="flex-1"
                >
                  {salvando ? "Salvando..." : "Salvar"}
                </Button>
              </div>
            </>
          )}
        </section>

        <Button asChild variant="secondary" className="w-full">
          <Link to="/">Voltar ao feed</Link>
        </Button>
      </main>

      <BottomNav />
    </div>
  );
}
