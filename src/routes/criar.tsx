import { useState } from "react";
import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { ArrowLeft, Check, Lock, Minus, Plus, Share2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useSession, usePerfil } from "@/hooks/use-session";
import { CidadeCombobox } from "@/components/goating/cidade-combobox";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/criar")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Criar pelada · Goating" },
      {
        name: "description",
        content: "Monte sua pelada em menos de um minuto e chame a galera pelo link de convite.",
      },
      { property: "og:title", content: "Criar pelada no Goating" },
      { property: "og:description", content: "Organize sua pelada e reúna os jogadores da cidade." },
    ],
  }),
  component: CriarPelada,
});

function CriarPelada() {
  const navigate = useNavigate();
  const { userId, carregando } = useSession();
  const { data: perfil } = usePerfil(userId);

  const [titulo, setTitulo] = useState("");
  const [data, setData] = useState("");
  const [horario, setHorario] = useState("19:30");
  const [local, setLocal] = useState("");
  const [cidade, setCidade] = useState("");
  const [vagas, setVagas] = useState(10);
  const [tipo, setTipo] = useState<"aberta" | "fechada">("aberta");
  const [enviando, setEnviando] = useState(false);
  const [criada, setCriada] = useState<{
    id: string;
    titulo: string;
    cidade: string;
    token: string;
  } | null>(null);

  if (!carregando && !userId) {
    navigate({ to: "/auth", replace: true });
  }

  const cidadeFinal = cidade || perfil?.cidade || "";
  const valido = titulo.trim() && data && horario && local.trim() && cidadeFinal.trim();

  async function criar() {
    if (!valido || !userId) return;
    setEnviando(true);
    try {
      const { data: pelada, error } = await supabase
        .from("matches")
        .insert({
          organizador_id: userId,
          titulo: titulo.trim(),
          data,
          horario,
          local: local.trim(),
          cidade: cidadeFinal.trim(),
          quantidade_vagas: vagas,
          tipo,
        })
        .select()
        .single();
      if (error) throw error;

      await supabase.from("match_participants").insert({
        match_id: pelada.id,
        user_id: userId,
        status: "aprovado",
      });

      const token = crypto.randomUUID().replaceAll("-", "").slice(0, 10);
      await supabase.from("match_invite_links").insert({ match_id: pelada.id, token });

      setCriada({ id: pelada.id, titulo: pelada.titulo, cidade: pelada.cidade, token });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não deu para criar a pelada.");
    } finally {
      setEnviando(false);
    }
  }

  if (criada) {
    const link = `${window.location.origin}/p/${criada.token}`;
    return (
      <div className="app-shell flex flex-col">
        <header className="bg-primary px-4 pt-6 pb-8 text-center">
          <div className="mx-auto flex size-16 items-center justify-center rounded-full bg-primary-foreground/10">
            <Check className="size-8 text-mint" />
          </div>
          <h1 className="mt-4 text-2xl font-extrabold text-primary-foreground">Pelada criada!</h1>
          <p className="mt-1 text-sm text-mint">
            {criada.titulo} · {criada.cidade}
          </p>
        </header>
        <div className="flex-1 space-y-4 p-5">
          <div className="rounded-2xl border-2 border-dashed border-mint bg-mint-soft p-4 text-center">
            <p className="text-xs font-medium text-muted-foreground">Link de convite</p>
            <p className="mt-1 text-sm font-bold break-all text-primary">{link}</p>
          </div>
          <Button
            className="w-full"
            onClick={() => {
              void navigator.clipboard.writeText(link);
              toast.success("Link copiado!");
            }}
          >
            <Share2 className="mr-2 size-4" /> Compartilhar link
          </Button>
          <Button asChild className="w-full bg-mint text-mint-foreground hover:bg-mint/90">
            <Link to="/pelada/$id" params={{ id: criada.id }}>
              Abrir a pelada
            </Link>
          </Button>
          <Button asChild variant="outline" className="w-full">
            <Link to="/">Ver no feed</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="app-shell flex flex-col pb-24">
      <header className="flex items-center gap-3 bg-primary px-4 py-4">
        <Link to="/" aria-label="Voltar">
          <ArrowLeft className="size-5 text-primary-foreground" />
        </Link>
        <h1 className="text-lg font-extrabold text-primary-foreground">Criar Pelada</h1>
      </header>

      <div className="flex-1 space-y-4 p-5">
        <div>
          <Label htmlFor="titulo">Título</Label>
          <Input
            id="titulo"
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            placeholder="Pelada de quinta"
            className="mt-1"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="data">Data</Label>
            <Input
              id="data"
              type="date"
              value={data}
              onChange={(e) => setData(e.target.value)}
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="horario">Horário</Label>
            <Input
              id="horario"
              type="time"
              value={horario}
              onChange={(e) => setHorario(e.target.value)}
              className="mt-1"
            />
          </div>
        </div>

        <div>
          <Label htmlFor="local">Local</Label>
          <Input
            id="local"
            value={local}
            onChange={(e) => setLocal(e.target.value)}
            placeholder="Arena Gol Society"
            className="mt-1"
          />
        </div>

        <div>
          <Label>Cidade</Label>
          <div className="mt-1">
            <CidadeCombobox value={cidadeFinal || null} onChange={setCidade} />
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Usada para mostrar essa pelada no feed de quem está nessa cidade.
          </p>
        </div>

        <div>
          <Label>Quantidade de vagas</Label>
          <div className="mt-1 flex items-center justify-between rounded-xl border border-input bg-card px-3 py-2">
            <button
              type="button"
              aria-label="Menos vagas"
              onClick={() => setVagas((v) => Math.max(2, v - 1))}
              className="flex size-8 items-center justify-center rounded-lg bg-secondary"
            >
              <Minus className="size-4" />
            </button>
            <span className="text-lg font-extrabold">{vagas}</span>
            <button
              type="button"
              aria-label="Mais vagas"
              onClick={() => setVagas((v) => Math.min(30, v + 1))}
              className="flex size-8 items-center justify-center rounded-lg bg-secondary"
            >
              <Plus className="size-4" />
            </button>
          </div>
        </div>

        <div>
          <Label>Tipo de pelada</Label>
          <div className="mt-2 grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setTipo("aberta")}
              className={cn(
                "rounded-2xl border p-3 text-left transition-colors",
                tipo === "aberta" ? "border-mint bg-mint-soft" : "border-border bg-card",
              )}
            >
              <Check className="size-5 text-primary" />
              <p className="mt-2 text-sm font-bold text-foreground">Aberta</p>
              <p className="mt-1 text-[11px] text-muted-foreground">
                Qualquer jogador entra direto até lotar as vagas.
              </p>
            </button>
            <button
              type="button"
              onClick={() => setTipo("fechada")}
              className={cn(
                "rounded-2xl border p-3 text-left transition-colors",
                tipo === "fechada"
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-card",
              )}
            >
              <Lock className={cn("size-5", tipo === "fechada" ? "text-mint" : "text-primary")} />
              <p className="mt-2 text-sm font-bold">Fechada</p>
              <p
                className={cn(
                  "mt-1 text-[11px]",
                  tipo === "fechada" ? "text-mint" : "text-muted-foreground",
                )}
              >
                Jogador solicita entrada e o organizador aprova manualmente.
              </p>
            </button>
          </div>
        </div>
      </div>

      <div className="sticky bottom-0 border-t border-border bg-card p-4">
        <Button
          className={cn(
            "w-full font-semibold",
            valido ? "bg-mint text-mint-foreground hover:bg-mint/90" : "",
          )}
          disabled={!valido || enviando}
          onClick={criar}
        >
          Criar Pelada
        </Button>
      </div>
    </div>
  );
}
