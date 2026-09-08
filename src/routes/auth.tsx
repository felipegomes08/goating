import { useState } from "react";
import { createFileRoute, useNavigate, useRouterState } from "@tanstack/react-router";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { GoatingLogo } from "@/components/goating/logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/auth")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Entrar no Goating · Peladas da sua cidade" },
      {
        name: "description",
        content:
          "Crie sua conta no Goating para entrar em peladas da sua cidade, seguir jogadores e evoluir sua cartinha.",
      },
      { property: "og:title", content: "Entrar no Goating" },
      {
        property: "og:description",
        content: "Jogue. Conecte. Evolua. A rede social das peladas.",
      },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const search = useRouterState({ select: (s) => s.location.search }) as { convite?: string };
  const [modo, setModo] = useState<"entrar" | "criar">("entrar");
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [carregando, setCarregando] = useState(false);

  const destino = search?.convite ? `/p/${search.convite}` : "/";

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setCarregando(true);
    try {
      if (modo === "criar") {
        const { error } = await supabase.auth.signUp({
          email,
          password: senha,
          options: {
            emailRedirectTo: window.location.origin,
            data: { nome_exibicao: nome },
          },
        });
        if (error) throw error;
        const { data } = await supabase.auth.getSession();
        if (!data.session) {
          toast.success("Confira seu e-mail para confirmar a conta.");
          return;
        }
        toast.success("Conta criada. Bem-vindo ao Goating!");
        navigate({ to: destino, replace: true });
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password: senha });
        if (error) throw error;
        navigate({ to: destino, replace: true });
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível continuar.");
    } finally {
      setCarregando(false);
    }
  }

  return (
    <div className="app-shell flex flex-col justify-center bg-primary px-6 py-10">
      <div className="mb-8 text-center">
        <div className="flex justify-center">
          <GoatingLogo size={56} />
        </div>
        <h1 className="mt-4 text-3xl font-extrabold text-primary-foreground">Goating</h1>
        <p className="mt-1 text-sm text-mint">Jogue. Conecte. Evolua.</p>
      </div>

      <form onSubmit={enviar} className="rounded-2xl bg-card p-5 shadow-[var(--shadow-card)]">
        <div className="mb-5 grid grid-cols-2 gap-1 rounded-xl bg-secondary p-1">
          {(["entrar", "criar"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setModo(m)}
              className={
                "rounded-lg py-2 text-sm font-semibold transition-colors " +
                (modo === m ? "bg-primary text-primary-foreground" : "text-muted-foreground")
              }
            >
              {m === "entrar" ? "Entrar" : "Criar conta"}
            </button>
          ))}
        </div>

        {modo === "criar" && (
          <div className="mb-3">
            <Label htmlFor="nome">Nome de exibição</Label>
            <Input
              id="nome"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              required
              placeholder="Como a galera te chama"
              className="mt-1"
            />
          </div>
        )}

        <div className="mb-3">
          <Label htmlFor="email">E-mail</Label>
          <Input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="mt-1"
          />
        </div>

        <div className="mb-5">
          <Label htmlFor="senha">Senha</Label>
          <Input
            id="senha"
            type="password"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            required
            minLength={6}
            className="mt-1"
          />
        </div>

        <Button
          type="submit"
          disabled={carregando}
          className="w-full bg-mint font-semibold text-mint-foreground hover:bg-mint/90"
        >
          {modo === "entrar" ? "Entrar" : "Criar conta"}
        </Button>
      </form>
    </div>
  );
}
