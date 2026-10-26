import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/** Celular do próprio usuário (só ele lê), só os dígitos; null quando não informou. */
export function useCelular(userId: string | null) {
  return useQuery({
    queryKey: ["celular", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contatos")
        .select("celular")
        .eq("id", userId!)
        .maybeSingle();
      if (error) throw error;
      return data?.celular ?? null;
    },
  });
}

/** Grava o celular (só dígitos; vazio apaga). */
export async function salvarCelular(userId: string, digitos: string) {
  return supabase
    .from("contatos")
    .upsert({ id: userId, celular: digitos || null, atualizado_em: new Date().toISOString() });
}
