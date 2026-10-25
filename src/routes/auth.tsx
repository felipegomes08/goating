import { useState } from "react";
import { createFileRoute, Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { MailCheck } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { traduzirErroAuth } from "@/lib/auth-erros";
import { CAPTCHA_LIGADO, Captcha, comCaptcha } from "@/components/goating/captcha";
import { GoatingLogo } from "@/components/goating/logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { origemDoSite } from "@/lib/site";
import { entrarComGoogleNoApp, noApp } from "@/lib/nativo";

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
  const search = useRouterState({ select: (s) => s.location.search }) as {
    convite?: string;
    turma?: string;
    /** código do link de convite da turma */
    c?: string;
  };
  // "confirmar": conta criada, esperando a pessoa clicar no link do e-mail
  const [modo, setModo] = useState<"entrar" | "criar" | "recuperar" | "confirmar">("entrar");
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [carregando, setCarregando] = useState(false);
  // comprovante do "não sou um robô": vale pra uma tentativa; a rodada nova pede outro
  const [comprovante, setComprovante] = useState<string | null>(null);
  const [rodada, setRodada] = useState(0);
  const faltaCaptcha = CAPTCHA_LIGADO && !comprovante;
  const novaRodada = () => setRodada((r) => r + 1);

  // pra onde a pessoa estava indo (convite de pelada ou de turma): o link de confirmação do
  // e-mail volta pra lá, e a conta guarda o destino caso o e-mail abra em outro navegador
  const destino = search?.convite
    ? `/p/${search.convite}`
    : search?.turma
      ? `/turma/${search.turma}${search.c ? `?c=${encodeURIComponent(search.c)}` : ""}`
      : null;
  const voltaDoEmail = `${origemDoSite()}${destino ?? ""}`;

  /** Depois de entrar, a pessoa volta pra onde estava indo: convite de pelada, turma ou o feed. */
  function irParaDestino() {
    if (search?.convite) {
      void navigate({ to: "/p/$token", params: { token: search.convite }, replace: true });
    } else if (search?.turma) {
      void navigate({
        to: "/turma/$id",
        params: { id: search.turma },
        search: search.c ? { c: search.c } : {},
        replace: true,
      });
    } else {
      void navigate({ to: "/", replace: true });
    }
  }

  /**
   * Entrar (ou criar conta) com Google. No site o Google abre na mesma aba e volta pro destino do
   * convite; no app abre a janelinha de contas do celular.
   */
  async function entrarComGoogle() {
    setCarregando(true);
    try {
      if (noApp()) {
        await entrarComGoogleNoApp();
        irParaDestino();
        return;
      }
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: voltaDoEmail },
      });
      if (error) throw error;
    } catch (err) {
      toast.error(
        err instanceof Error && err.message ? err.message : "Não deu pra entrar com Google agora.",
      );
    } finally {
      setCarregando(false);
    }
  }

  async function enviarRecuperacao(e: React.FormEvent) {
    e.preventDefault();
    setCarregando(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${origemDoSite()}/redefinir-senha`,
        ...comCaptcha(comprovante),
      });
      if (error) throw error;
      toast.success("Se esse e-mail tiver conta, mandamos um link pra redefinir a senha.");
      setModo("entrar");
    } catch (err) {
      toast.error(traduzirErroAuth(err));
    } finally {
      setCarregando(false);
      novaRodada();
    }
  }

  /** "Já confirmei": tenta entrar com o e-mail e a senha que a pessoa acabou de digitar. */
  async function entrarDepoisDeConfirmar() {
    setCarregando(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password: senha,
        options: comCaptcha(comprovante),
      });
      if (error) throw error;
      toast.success("Conta confirmada. Bem-vindo ao Goating!");
      irParaDestino();
    } catch (err) {
      toast.error(
        err instanceof Error && /email not confirmed/i.test(err.message)
          ? "Ainda não confirmou. Abra o e-mail e toque no link."
          : traduzirErroAuth(err),
      );
    } finally {
      setCarregando(false);
      novaRodada();
    }
  }

  async function reenviarConfirmacao() {
    setCarregando(true);
    try {
      const { error } = await supabase.auth.resend({
        type: "signup",
        email,
        options: { emailRedirectTo: voltaDoEmail, ...comCaptcha(comprovante) },
      });
      if (error) throw error;
      toast.success("Mandamos o e-mail de novo.");
    } catch (err) {
      toast.error(traduzirErroAuth(err));
    } finally {
      setCarregando(false);
      novaRodada();
    }
  }

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setCarregando(true);
    try {
      if (modo === "criar") {
        const { error } = await supabase.auth.signUp({
          email,
          password: senha,
          options: {
            emailRedirectTo: voltaDoEmail,
            data: { nome_exibicao: nome, ...(destino ? { destino } : {}) },
            ...comCaptcha(comprovante),
          },
        });
        if (error) throw error;
        const { data } = await supabase.auth.getSession();
        if (!data.session) {
          setModo("confirmar");
          return;
        }
        toast.success("Conta criada. Bem-vindo ao Goating!");
        irParaDestino();
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password: senha,
          options: comCaptcha(comprovante),
        });
        if (error) throw error;
        irParaDestino();
      }
    } catch (err) {
      toast.error(traduzirErroAuth(err));
    } finally {
      setCarregando(false);
      novaRodada();
    }
  }

  return (
    // celular baixo (tela de uns 640 de altura): some o ícone e os espaços encolhem,
    // pra o formulário inteiro caber sem precisar rolar
    <div className="app-shell flex flex-col justify-center bg-primary px-6 py-10 [@media(max-height:740px)]:py-4">
      <div className="mb-8 text-center [@media(max-height:740px)]:mb-4">
        <div className="flex justify-center [@media(max-height:740px)]:hidden">
          <GoatingLogo size={56} />
        </div>
        <h1 className="mt-4 flex justify-center [@media(max-height:740px)]:mt-0">
          <GoatingLogo variant="wordmark" size={48} />
        </h1>
        <p className="mt-1 text-sm text-mint">Jogue. Conecte. Evolua.</p>
      </div>

      {modo === "confirmar" ? (
        <div className="rounded-2xl bg-card p-5 text-center shadow-[var(--shadow-card)]">
          <span className="mx-auto flex size-14 items-center justify-center rounded-full bg-mint-soft">
            <MailCheck className="size-7 text-primary" strokeWidth={1.8} />
          </span>
          <h2 className="mt-4 text-lg font-extrabold text-foreground">Confirme seu e-mail</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Mandamos um link pra <span className="font-semibold text-foreground">{email}</span>.
            Abra o e-mail, toque no link e depois volte aqui.
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            Não achou? Olha na caixa de spam ou promoções.
          </p>
          <div className="mt-4">
            <Captcha key={`confirmar-${rodada}`} onComprovante={setComprovante} />
          </div>
          <Button
            className="mt-3 w-full"
            disabled={carregando || faltaCaptcha}
            onClick={entrarDepoisDeConfirmar}
          >
            Já confirmei, entrar
          </Button>
          <Button
            variant="outline"
            className="mt-2 w-full"
            disabled={carregando || faltaCaptcha}
            onClick={reenviarConfirmacao}
          >
            Reenviar e-mail
          </Button>
          <button
            type="button"
            onClick={() => setModo("criar")}
            className="mt-4 text-xs font-semibold text-muted-foreground underline"
          >
            Usar outro e-mail
          </button>
        </div>
      ) : modo === "recuperar" ? (
        <form
          onSubmit={enviarRecuperacao}
          className="rounded-2xl bg-card p-5 shadow-[var(--shadow-card)]"
        >
          <p className="mb-4 text-sm text-muted-foreground">
            Digita seu e-mail que a gente manda um link pra você criar uma senha nova.
          </p>
          <div className="mb-5">
            <Label htmlFor="email-recuperar">E-mail</Label>
            <Input
              id="email-recuperar"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="mt-1"
            />
          </div>
          <div className="mb-3">
            <Captcha key={`recuperar-${rodada}`} onComprovante={setComprovante} />
          </div>
          <Button type="submit" disabled={carregando || faltaCaptcha} className="w-full">
            Enviar link de recuperação
          </Button>
          <button
            type="button"
            onClick={() => setModo("entrar")}
            className="mt-4 w-full text-center text-sm font-semibold text-muted-foreground"
          >
            Voltar para o login
          </button>
        </form>
      ) : (
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

          <button
            type="button"
            disabled={carregando}
            onClick={() => void entrarComGoogle()}
            className="flex h-11 w-full items-center justify-center gap-2.5 rounded-xl border border-border bg-white text-sm font-semibold text-[#1f1f1f] shadow-sm transition-colors hover:bg-secondary disabled:opacity-60"
          >
            <LogoGoogle />
            {modo === "criar" ? "Criar conta com Google" : "Entrar com Google"}
          </button>
          <div className="my-4 flex items-center gap-3 text-xs text-muted-foreground">
            <span className="h-px flex-1 bg-border" />
            ou com e-mail
            <span className="h-px flex-1 bg-border" />
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

          <div className="mb-2">
            <Label htmlFor="senha">Senha</Label>
            <Input
              id="senha"
              type="password"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              required
              minLength={modo === "criar" ? 8 : 1}
              className="mt-1"
            />
            {modo === "criar" && (
              <p className="mt-1 text-xs text-muted-foreground">Pelo menos 8 caracteres.</p>
            )}
          </div>

          {modo === "entrar" && (
            <button
              type="button"
              onClick={() => setModo("recuperar")}
              className="mb-4 block text-right text-xs font-semibold text-muted-foreground"
            >
              Esqueci minha senha
            </button>
          )}

          <div className="mb-3">
            <Captcha key={`${modo}-${rodada}`} onComprovante={setComprovante} />
          </div>
          <Button type="submit" disabled={carregando || faltaCaptcha} className="w-full">
            {modo === "entrar" ? "Entrar" : "Criar conta"}
          </Button>
          {modo === "criar" && (
            <p className="mt-3 text-center text-xs text-muted-foreground">
              Ao criar a conta você concorda com a{" "}
              <Link to="/privacidade" className="font-semibold underline">
                política de privacidade
              </Link>
              .
            </p>
          )}
        </form>
      )}

      <Link
        to="/privacidade"
        className="mt-6 block text-center text-xs font-medium text-primary-foreground/60 underline [@media(max-height:740px)]:mt-3"
      >
        Política de privacidade
      </Link>
    </div>
  );
}

/** O "G" colorido do Google (como pede a marca do botão). */
function LogoGoogle() {
  return (
    <svg viewBox="0 0 48 48" className="size-5" aria-hidden>
      <path
        fill="#FFC107"
        d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.2-.1-2.3-.4-3.5z"
      />
      <path
        fill="#FF3D00"
        d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"
      />
      <path
        fill="#4CAF50"
        d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"
      />
      <path
        fill="#1976D2"
        d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.2-.1-2.3-.4-3.5z"
      />
    </svg>
  );
}
