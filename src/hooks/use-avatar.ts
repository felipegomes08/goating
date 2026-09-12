import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/** Gera uma URL assinada para a foto do jogador no bucket privado `avatars`. */
export function useAvatarUrl(caminho: string | null | undefined) {
  const { data } = useQuery({
    queryKey: ["avatar", caminho],
    enabled: !!caminho,
    staleTime: 1000 * 60 * 30,
    queryFn: async () => {
      const { data } = await supabase.storage.from("avatars").createSignedUrl(caminho!, 3600);
      return data?.signedUrl ?? null;
    },
  });
  return data ?? null;
}
