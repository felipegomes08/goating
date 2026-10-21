import { Crown } from "lucide-react";
import { cn } from "@/lib/utils";

/** Coroinha dourada ao lado do nome de quem é Premium. */
export function SeloPremium({ className }: { className?: string }) {
  return (
    <Crown
      aria-label="Premium"
      className={cn("inline size-3.5 shrink-0 fill-tier-ouro text-tier-ouro", className)}
    />
  );
}
