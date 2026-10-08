import { cn } from "@/lib/utils";
import { LOGO } from "@/lib/logo";

export function GoatingLogo({
  size = 32,
  withWordmark = false,
  className,
  variant = "icon",
  tone = "dark",
  iconTone,
  wordmarkTone,
}: {
  size?: number;
  withWordmark?: boolean;
  className?: string;
  variant?: "icon" | "wordmark";
  tone?: "dark" | "light";
  iconTone?: "dark" | "light";
  wordmarkTone?: "dark" | "light";
}) {
  const itone = iconTone ?? tone;
  const wtone = wordmarkTone ?? tone;

  return (
    <div className={cn("flex max-w-full items-center gap-2", className)}>
      {variant !== "wordmark" && (
        <img
          src={itone === "dark" ? LOGO.iconeVerde : LOGO.iconeBranco}
          width={size}
          height={size}
          className="shrink-0 self-center object-contain"
          alt={withWordmark ? "" : "Goating"}
        />
      )}
      {(withWordmark || variant === "wordmark") && (
        <img
          src={wtone === "dark" ? LOGO.letreiroBranco : LOGO.letreiroVerde}
          width={size * 3.8}
          height={size}
          className="min-w-0 self-center object-contain"
          alt="Goating"
        />
      )}
    </div>
  );
}
