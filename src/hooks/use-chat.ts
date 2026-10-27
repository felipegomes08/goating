import { useEffect } from "react";
import {
  type InfiniteData,
  useInfiniteQuery,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";

export type Mensagem = {
  id: string;
  crew_id: string;
  autor_id: string | null;
  tipo: string;
  texto: string | null;
  match_id: string | null;
  dados: Json | null;
  criado_em: string;
  apagada_em: string | null;
  /** mandada daqui e ainda esperando o banco confirmar */
  pendente?: boolean;
};

const COLUNAS = "id, crew_id, autor_id, tipo, texto, match_id, dados, criado_em, apagada_em";
const POR_PAGINA = 50;

type Paginas = InfiniteData<Mensagem[], string | null>;

/** Coloca (ou troca) uma mensagem na primeira página, mantendo a mais nova em cima. */
function colocar(dados: Paginas | undefined, msg: Mensagem): Paginas | undefined {
  if (!dados) return dados;
  const existe = dados.pages.some((p) => p.some((m) => m.id === msg.id));
  const pages = existe
    ? dados.pages.map((p) => p.map((m) => (m.id === msg.id ? msg : m)))
    : [[msg, ...(dados.pages[0] ?? [])], ...dados.pages.slice(1)];
  pages[0] = [...(pages[0] ?? [])].sort((a, b) => b.criado_em.localeCompare(a.criado_em));
  return { ...dados, pages };
}

function tirar(dados: Paginas | undefined, id: string): Paginas | undefined {
  if (!dados) return dados;
  return { ...dados, pages: dados.pages.map((p) => p.filter((m) => m.id !== id)) };
}

/**
 * O chat de uma turma: as mensagens (as 50 mais novas, e mais antigas sob demanda), chegando na
 * hora pelo tempo real, e o envio otimista (a mensagem aparece antes do banco confirmar).
 */
export function useChat(crewId: string, userId: string | null, ativo: boolean) {
  const queryClient = useQueryClient();
  const chave = ["chat", crewId];

  const consulta = useInfiniteQuery({
    queryKey: chave,
    enabled: ativo && !!userId,
    initialPageParam: null as string | null,
    queryFn: async ({ pageParam }): Promise<Mensagem[]> => {
      let q = supabase
        .from("mensagens_da_turma")
        .select(COLUNAS)
        .eq("crew_id", crewId)
        .order("criado_em", { ascending: false })
        .limit(POR_PAGINA);
      if (pageParam) q = q.lt("criado_em", pageParam);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
    getNextPageParam: (ultima) =>
      ultima.length < POR_PAGINA ? undefined : ultima[ultima.length - 1]?.criado_em,
  });

  useEffect(() => {
    if (!ativo || !userId) return;
    const aoMudar = (payload: { new: unknown }) =>
      queryClient.setQueryData<Paginas>(["chat", crewId], (d) =>
        colocar(d, payload.new as Mensagem),
      );
    const canal = supabase
      // nome único: duas telas abertas ao mesmo tempo não brigam pelo mesmo canal
      .channel(`chat-${crewId}-${crypto.randomUUID()}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "mensagens_da_turma",
          filter: `crew_id=eq.${crewId}`,
        },
        aoMudar,
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "mensagens_da_turma",
          filter: `crew_id=eq.${crewId}`,
        },
        aoMudar,
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(canal);
    };
  }, [crewId, userId, ativo, queryClient]);

  async function enviar(texto: string) {
    const limpo = texto.trim();
    if (!userId || !limpo) return false;
    const id = crypto.randomUUID();
    const provisoria: Mensagem = {
      id,
      crew_id: crewId,
      autor_id: userId,
      tipo: "texto",
      texto: limpo,
      match_id: null,
      dados: null,
      criado_em: new Date().toISOString(),
      apagada_em: null,
      pendente: true,
    };
    queryClient.setQueryData<Paginas>(chave, (d) => colocar(d, provisoria));
    const { data, error } = await supabase
      .from("mensagens_da_turma")
      .insert({ id, crew_id: crewId, autor_id: userId, tipo: "texto", texto: limpo })
      .select(COLUNAS)
      .single();
    if (error) {
      queryClient.setQueryData<Paginas>(chave, (d) => tirar(d, id));
      toast.error(
        /Calma!/.test(error.message) ? error.message : "Não deu pra mandar. Confere a internet.",
      );
      return false;
    }
    queryClient.setQueryData<Paginas>(chave, (d) => colocar(d, data));
    return true;
  }

  async function apagar(id: string) {
    const { error } = await supabase.rpc("apagar_mensagem", { p_id: id });
    if (error) {
      toast.error("Não deu pra apagar essa mensagem.");
      return;
    }
    queryClient.setQueryData<Paginas>(chave, (d) => {
      const msg = d?.pages.flat().find((m) => m.id === id);
      return msg
        ? colocar(d, { ...msg, texto: null, dados: null, apagada_em: new Date().toISOString() })
        : d;
    });
  }

  return {
    /** da mais nova pra mais antiga */
    mensagens: consulta.data?.pages.flat() ?? [],
    carregando: consulta.isLoading,
    erro: consulta.isError,
    temMais: !!consulta.hasNextPage,
    carregandoMais: consulta.isFetchingNextPage,
    carregarMais: () => void consulta.fetchNextPage(),
    enviar,
    apagar,
  };
}

/** Mensagens não lidas de cada turma (e se o chat está silenciado). */
export function useChatsNaoLidos(userId: string | null) {
  const consulta = useQuery({
    queryKey: ["chats-nao-lidos", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("chats_nao_lidos");
      if (error) throw error;
      return data;
    },
  });
  const lista = consulta.data ?? [];
  return {
    naoLidas: (crewId: string) => lista.find((c) => c.crew_id === crewId)?.nao_lidas ?? 0,
    silenciado: (crewId: string) => lista.find((c) => c.crew_id === crewId)?.silenciado ?? false,
    /** total pra aba Turmas: chat silenciado não conta */
    total: lista.reduce((s, c) => s + (c.silenciado ? 0 : c.nao_lidas), 0),
  };
}

/** Marca o chat como lido e atualiza os contadores. */
export async function marcarChatLido(
  crewId: string,
  queryClient: ReturnType<typeof useQueryClient>,
) {
  await supabase.rpc("marcar_chat_lido", { p_crew_id: crewId });
  await queryClient.invalidateQueries({ queryKey: ["chats-nao-lidos"] });
}
