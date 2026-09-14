import { useEffect, useRef, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { traduzirErroAuth } from "@/lib/auth-erros";
import { GoatingLogo } from "@/components/goating/logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/redefinir-senha")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Redefinir senha · Goating" },
      { name: "description", content: "Crie uma nova senha para sua conta no Goating." },
    ],
  }),
  component: RedefinirSenha,
});

function RedefinirSenha() {
  const navigate = useNavigate();
  const [pronto, setPronto] = useState(false);
  const [invalido, setInvalido] = useState(false);
  const [senha, setSenha] = useState("");
  const [confirmarSenha, setConfirmarSenha] = useState("");
  const [enviando, setEnviando] = useState(false);
  const prontoRef = useRef(false);

  useEffect(() => {
    let ativo = true;

    function marcarPronto() {
      if (!ativo) return;
      prontoRef.current = true;
      setPronto(true);
    }

    // O link de recuperação chega com o token na URL; o client do Supabase
    // detecta isso sozinho (detectSessionInUrl) e dispara PASSWORD_RECOVERY.
    const { data: sub } = supabase.auth.onAuthStateChange((evento) => {
      if (evento === "PASSWORD_RECOVERY") marcarPronto();
    });

    // Se o evento já disparou antes deste efeito montar, a sessão já existe.
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) marcarPronto();
    });

    const tempo = setTimeout(() => {
      if (ativo && !prontoRef.current) setInvalido(true);
    }, 4000);

    return () => {
      ativo = false;
      sub.subscription.unsubscribe();
      clearTimeout(tempo);
    };
  }, []);

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    if (senha !== confirmarSenha) {
      toast.error("As senhas não são iguais.");
      return;
    }
    setEnviando(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: senha });
      if (error) throw error;
      toast.success("Senha atualizada! Faça login com a nova senha.");
      await supabase.auth.signOut();
      navigate({ to: "/auth", replace: true });
    } catch (err) {
      toast.error(traduzirErroAuth(err));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="app-shell flex flex-col justify-center bg-primary px-6 py-10">
      <div className="mb-8 text-center">
        <div className="flex justify-center">
          <GoatingLogo size={56} />
        </div>
        <h1 className="mt-4 flex justify-center">
          <GoatingLogo variant="wordmark" size={48} />
        </h1>
      </div>

      <div className="rounded-2xl bg-card p-5 shadow-[var(--shadow-card)]">
        {invalido && !pronto ? (
          <div className="space-y-4 text-center">
            <p className="text-sm text-muted-foreground">
              Esse link de redefinição expirou ou já foi usado.
            </p>
            <Button asChild className="w-full">
              <Link to="/auth">Pedir um novo link</Link>
            </Button>
          </div>
        ) : !pronto ? (
          <p className="text-center text-sm text-muted-foreground">Confirmando o link...</p>
        ) : (
          <form onSubmit={salvar} className="space-y-4">
            <p className="text-sm text-muted-foreground">Escolha sua nova senha.</p>
            <div>
              <Label htmlFor="senha-nova">Nova senha</Label>
              <Input
                id="senha-nova"
                type="password"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                required
                minLength={6}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="senha-confirmar">Confirmar nova senha</Label>
              <Input
                id="senha-confirmar"
                type="password"
                value={confirmarSenha}
                onChange={(e) => setConfirmarSenha(e.target.value)}
                required
                minLength={6}
                className="mt-1"
              />
            </div>
            <Button
              type="submit"
              disabled={enviando}
              className="w-full bg-mint font-semibold text-mint-foreground hover:bg-mint/90"
            >
              Salvar nova senha
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
