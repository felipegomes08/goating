const MAPA: Array<[RegExp, string]> = [
  [/invalid login credentials/i, "E-mail ou senha incorretos."],
  [/email not confirmed/i, "Confirme seu e-mail antes de entrar."],
  [/user already registered|already been registered/i, "Esse e-mail já tem conta. Faça login."],
  [/password should be at least (\d+)/i, "A senha precisa ter pelo menos $1 caracteres."],
  [/password.*(weak|pwned|compromised|leaked)/i, "Essa senha é fraca ou muito comum. Escolha outra."],
  [/unable to validate email address|invalid email/i, "E-mail inválido."],
  [/email rate limit|over_email_send_rate_limit|too many requests|rate limit/i, "Muitas tentativas. Espere alguns minutos e tente de novo."],
  [/new password should be different/i, "A nova senha precisa ser diferente da atual."],
  [/token has expired|otp_expired|invalid.*token/i, "O link expirou. Peça um novo."],
  [/user not found/i, "Não encontramos uma conta com esse e-mail."],
  [/signups? not allowed|signup is disabled/i, "Os cadastros estão desativados no momento."],
  [/anonymous sign-?ins? (are|is) disabled/i, "Entrar como convidado está desativado no momento."],
  [/network|fetch failed|failed to fetch/i, "Sem conexão. Verifique sua internet e tente de novo."],
];

const MAPA_URL: Record<string, string> = {
  otp_expired: "Esse link expirou ou já foi usado. Peça um novo link de recuperação.",
  access_denied: "Esse link expirou ou já foi usado. Peça um novo link de recuperação.",
  invalid_request: "O link de recuperação veio incompleto. Peça um novo.",
  server_error: "Deu problema ao abrir o link. Tente pedir um novo.",
};

export function traduzirErroUrl(codigo: string): string {
  return MAPA_URL[codigo] ?? "Esse link não funcionou. Peça um novo link de recuperação.";
}

export function traduzirErroAuth(erro: unknown): string {
  const msg = erro instanceof Error ? erro.message : typeof erro === "string" ? erro : "";
  for (const [re, texto] of MAPA) {
    const m = msg.match(re);
    if (m) return texto.replace("$1", m[1] ?? "");
  }
  return msg ? "Não foi possível continuar. Tente novamente." : "Não foi possível continuar.";
}
