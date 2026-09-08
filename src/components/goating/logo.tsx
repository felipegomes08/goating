import { cn } from "@/lib/utils";

export function GoatingLogo({
  size = 32,
  withWordmark = false,
  className,
}: {
  size?: number;
  withWordmark?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div
        className="flex items-center justify-center rounded-xl bg-mint font-extrabold text-mint-foreground"
        style={{ width: size, height: size, fontSize: size * 0.58, lineHeight: 1 }}
        aria-hidden
      >
        G
      </div>
      {withWordmark && (
        <span className="text-lg font-extrabold tracking-tight text-primary-foreground">
          Goating
        </span>
      )}
    </div>
  );
}
