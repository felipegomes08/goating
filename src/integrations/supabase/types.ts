export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5";
  };
  public: {
    Tables: {
      card_tiers: {
        Row: {
          id: string;
          nome: string;
          ordem: number;
          overall_minimo: number;
          peladas_minimas: number;
        };
        Insert: {
          id?: string;
          nome: string;
          ordem: number;
          overall_minimo: number;
          peladas_minimas: number;
        };
        Update: {
          id?: string;
          nome?: string;
          ordem?: number;
          overall_minimo?: number;
          peladas_minimas?: number;
        };
        Relationships: [];
      };
      crew_members: {
        Row: {
          admin: boolean;
          crew_id: string;
          criado_em: string;
          estrelas: number | null;
          id: string;
          nome: string;
          posicao: string | null;
          removido_em: string | null;
          user_id: string | null;
        };
        Insert: {
          admin?: boolean;
          crew_id: string;
          criado_em?: string;
          estrelas?: number | null;
          id?: string;
          nome: string;
          posicao?: string | null;
          removido_em?: string | null;
          user_id?: string | null;
        };
        Update: {
          admin?: boolean;
          crew_id?: string;
          criado_em?: string;
          estrelas?: number | null;
          id?: string;
          nome?: string;
          posicao?: string | null;
          removido_em?: string | null;
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "crew_members_crew_id_fkey";
            columns: ["crew_id"];
            isOneToOne: false;
            referencedRelation: "crews";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "crew_members_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      crew_invites: {
        Row: {
          crew_id: string;
          criado_em: string;
          token: string;
        };
        Insert: {
          crew_id: string;
          criado_em?: string;
          token?: string;
        };
        Update: {
          crew_id?: string;
          criado_em?: string;
          token?: string;
        };
        Relationships: [];
      };
      crews: {
        Row: {
          aceita_pedidos: boolean;
          avaliacoes: number;
          capa_url: string | null;
          cidade: string | null;
          criado_em: string;
          dono_id: string;
          escudo_url: string | null;
          excluida_em: string | null;
          id: string;
          nome: string;
          nota: number | null;
        };
        Insert: {
          aceita_pedidos?: boolean;
          avaliacoes?: number;
          capa_url?: string | null;
          cidade?: string | null;
          criado_em?: string;
          dono_id: string;
          escudo_url?: string | null;
          excluida_em?: string | null;
          id?: string;
          nome: string;
          nota?: number | null;
        };
        Update: {
          aceita_pedidos?: boolean;
          avaliacoes?: number;
          capa_url?: string | null;
          cidade?: string | null;
          criado_em?: string;
          dono_id?: string;
          escudo_url?: string | null;
          excluida_em?: string | null;
          id?: string;
          nome?: string;
          nota?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "crews_dono_id_fkey";
            columns: ["dono_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      evaluations: {
        Row: {
          avaliado_id: string;
          avaliador_id: string;
          chute: number | null;
          comentario: string | null;
          como_goleiro: boolean;
          identificavel: boolean;
          elasticidade: number | null;
          jogo_pes: number | null;
          reflexo: number | null;
          reposicao: number | null;
          saida_gol: number | null;
          comportamento: number | null;
          criado_em: string;
          cruzamento: number | null;
          drible: number | null;
          controle: number | null;
          desarme: number | null;
          finalizacao: number | null;
          fisico: number | null;
          jogo_aereo: number | null;
          marcacao: number | null;
          passe: number | null;
          visao: number | null;
          posicao: string | null;
          id: string;
          match_id: string;
          nota_geral: number;
          pontualidade: number | null;
          posicionamento: number | null;
          toque: number | null;
          velocidade: number | null;
        };
        Insert: {
          avaliado_id: string;
          avaliador_id: string;
          chute?: number | null;
          comentario?: string | null;
          como_goleiro?: boolean;
          identificavel?: boolean;
          elasticidade?: number | null;
          jogo_pes?: number | null;
          reflexo?: number | null;
          reposicao?: number | null;
          saida_gol?: number | null;
          comportamento?: number | null;
          criado_em?: string;
          cruzamento?: number | null;
          drible?: number | null;
          controle?: number | null;
          desarme?: number | null;
          finalizacao?: number | null;
          fisico?: number | null;
          jogo_aereo?: number | null;
          marcacao?: number | null;
          passe?: number | null;
          visao?: number | null;
          posicao?: string | null;
          id?: string;
          match_id: string;
          nota_geral: number;
          pontualidade?: number | null;
          posicionamento?: number | null;
          toque?: number | null;
          velocidade?: number | null;
        };
        Update: {
          avaliado_id?: string;
          avaliador_id?: string;
          chute?: number | null;
          comentario?: string | null;
          como_goleiro?: boolean;
          identificavel?: boolean;
          elasticidade?: number | null;
          jogo_pes?: number | null;
          reflexo?: number | null;
          reposicao?: number | null;
          saida_gol?: number | null;
          comportamento?: number | null;
          criado_em?: string;
          cruzamento?: number | null;
          drible?: number | null;
          controle?: number | null;
          desarme?: number | null;
          finalizacao?: number | null;
          fisico?: number | null;
          jogo_aereo?: number | null;
          marcacao?: number | null;
          passe?: number | null;
          visao?: number | null;
          posicao?: string | null;
          id?: string;
          match_id?: string;
          nota_geral?: number;
          pontualidade?: number | null;
          posicionamento?: number | null;
          toque?: number | null;
          velocidade?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "evaluations_avaliado_id_fkey";
            columns: ["avaliado_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "evaluations_avaliador_id_fkey";
            columns: ["avaliador_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "evaluations_match_id_fkey";
            columns: ["match_id"];
            isOneToOne: false;
            referencedRelation: "matches";
            referencedColumns: ["id"];
          },
        ];
      };
      followers: {
        Row: {
          criado_em: string;
          id: string;
          seguido_id: string;
          seguidor_id: string;
        };
        Insert: {
          criado_em?: string;
          id?: string;
          seguido_id: string;
          seguidor_id: string;
        };
        Update: {
          criado_em?: string;
          id?: string;
          seguido_id?: string;
          seguidor_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "followers_seguido_id_fkey";
            columns: ["seguido_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "followers_seguidor_id_fkey";
            columns: ["seguidor_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      game_players: {
        Row: {
          game_id: string;
          member_id: string;
          time: number;
        };
        Insert: {
          game_id: string;
          member_id: string;
          time: number;
        };
        Update: {
          game_id?: string;
          member_id?: string;
          time?: number;
        };
        Relationships: [
          {
            foreignKeyName: "game_players_game_id_fkey";
            columns: ["game_id"];
            isOneToOne: false;
            referencedRelation: "games";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "game_players_member_id_fkey";
            columns: ["member_id"];
            isOneToOne: false;
            referencedRelation: "crew_members";
            referencedColumns: ["id"];
          },
        ];
      };
      games: {
        Row: {
          duracao_seg: number;
          gols_a: number;
          gols_b: number;
          penaltis_a: number | null;
          penaltis_b: number | null;
          penaltis_na_artilharia: boolean;
          id: string;
          match_id: string;
          ordem: number;
          time_a: number;
          time_b: number;
          vencedor: number | null;
        };
        Insert: {
          duracao_seg?: number;
          gols_a?: number;
          gols_b?: number;
          penaltis_a?: number | null;
          penaltis_b?: number | null;
          penaltis_na_artilharia?: boolean;
          id?: string;
          match_id: string;
          ordem: number;
          time_a: number;
          time_b: number;
          vencedor?: number | null;
        };
        Update: {
          duracao_seg?: number;
          gols_a?: number;
          gols_b?: number;
          penaltis_a?: number | null;
          penaltis_b?: number | null;
          penaltis_na_artilharia?: boolean;
          id?: string;
          match_id?: string;
          ordem?: number;
          time_a?: number;
          time_b?: number;
          vencedor?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "games_match_id_fkey";
            columns: ["match_id"];
            isOneToOne: false;
            referencedRelation: "matches";
            referencedColumns: ["id"];
          },
        ];
      };
      goals: {
        Row: {
          game_id: string;
          id: string;
          member_id: string | null;
          minuto: number;
          penalti: boolean;
          tempo: number;
          time: number;
        };
        Insert: {
          game_id: string;
          id?: string;
          member_id?: string | null;
          minuto?: number;
          penalti?: boolean;
          tempo?: number;
          time: number;
        };
        Update: {
          game_id?: string;
          id?: string;
          member_id?: string | null;
          minuto?: number;
          penalti?: boolean;
          tempo?: number;
          time?: number;
        };
        Relationships: [
          {
            foreignKeyName: "goals_game_id_fkey";
            columns: ["game_id"];
            isOneToOne: false;
            referencedRelation: "games";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "goals_member_id_fkey";
            columns: ["member_id"];
            isOneToOne: false;
            referencedRelation: "crew_members";
            referencedColumns: ["id"];
          },
        ];
      };
      match_invite_links: {
        Row: {
          ativo: boolean;
          criado_em: string;
          id: string;
          match_id: string;
          token: string;
        };
        Insert: {
          ativo?: boolean;
          criado_em?: string;
          id?: string;
          match_id: string;
          token: string;
        };
        Update: {
          ativo?: boolean;
          criado_em?: string;
          id?: string;
          match_id?: string;
          token?: string;
        };
        Relationships: [
          {
            foreignKeyName: "match_invite_links_match_id_fkey";
            columns: ["match_id"];
            isOneToOne: false;
            referencedRelation: "matches";
            referencedColumns: ["id"];
          },
        ];
      };
      match_participants: {
        Row: {
          entrou_em: string;
          id: string;
          match_id: string;
          status: string;
          user_id: string;
        };
        Insert: {
          entrou_em?: string;
          id?: string;
          match_id: string;
          status?: string;
          user_id: string;
        };
        Update: {
          entrou_em?: string;
          id?: string;
          match_id?: string;
          status?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "match_participants_match_id_fkey";
            columns: ["match_id"];
            isOneToOne: false;
            referencedRelation: "matches";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "match_participants_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      match_players: {
        Row: {
          amarelos: number;
          assistencias: number;
          azuis: number;
          defesas: number;
          derrotas: number;
          vermelhos: number;
          empates: number;
          gols: number;
          id: string;
          jogos: number;
          match_id: string;
          member_id: string;
          ordem: number;
          time: number | null;
          vitorias: number;
        };
        Insert: {
          amarelos?: number;
          assistencias?: number;
          azuis?: number;
          defesas?: number;
          derrotas?: number;
          vermelhos?: number;
          empates?: number;
          gols?: number;
          id?: string;
          jogos?: number;
          match_id: string;
          member_id: string;
          ordem?: number;
          time?: number | null;
          vitorias?: number;
        };
        Update: {
          amarelos?: number;
          assistencias?: number;
          azuis?: number;
          defesas?: number;
          derrotas?: number;
          vermelhos?: number;
          empates?: number;
          gols?: number;
          id?: string;
          jogos?: number;
          match_id?: string;
          member_id?: string;
          ordem?: number;
          time?: number | null;
          vitorias?: number;
        };
        Relationships: [
          {
            foreignKeyName: "match_players_match_id_fkey";
            columns: ["match_id"];
            isOneToOne: false;
            referencedRelation: "matches";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "match_players_member_id_fkey";
            columns: ["member_id"];
            isOneToOne: false;
            referencedRelation: "crew_members";
            referencedColumns: ["id"];
          },
        ];
      };
      notificacoes: {
        Row: {
          chave: string | null;
          corpo: string | null;
          criado_em: string;
          id: string;
          lida_em: string | null;
          link: string | null;
          push_enviado_em: string | null;
          tipo: string;
          titulo: string;
          user_id: string;
        };
        Insert: {
          chave?: string | null;
          corpo?: string | null;
          criado_em?: string;
          id?: string;
          lida_em?: string | null;
          link?: string | null;
          push_enviado_em?: string | null;
          tipo: string;
          titulo: string;
          user_id: string;
        };
        Update: {
          chave?: string | null;
          corpo?: string | null;
          criado_em?: string;
          id?: string;
          lida_em?: string | null;
          link?: string | null;
          push_enviado_em?: string | null;
          tipo?: string;
          titulo?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      matches: {
        Row: {
          avaliacao_ate: string | null;
          avisada_em: string | null;
          cidade: string;
          contagem_vitoria: string;
          crew_id: string | null;
          criado_em: string;
          data: string;
          descricao: string | null;
          finalizada_em: string | null;
          gols_limite: number | null;
          horario: string;
          horario_fim: string | null;
          id: string;
          local: string;
          local_link: string | null;
          minutos_tempo: number;
          mvp_fechado_em: string | null;
          mvp_id: string | null;
          cores_times: string[] | null;
          nomes_times: string[] | null;
          num_times: number;
          organizador_id: string;
          placar_estado: Json | null;
          placar_finalizado_em: string | null;
          quantidade_vagas: number;
          status: string;
          tempos: number;
          tipo: string;
          titulo: string;
        };
        Insert: {
          avaliacao_ate?: string | null;
          avisada_em?: string | null;
          cidade: string;
          contagem_vitoria?: string;
          crew_id?: string | null;
          criado_em?: string;
          data: string;
          descricao?: string | null;
          finalizada_em?: string | null;
          gols_limite?: number | null;
          horario: string;
          horario_fim?: string | null;
          id?: string;
          local: string;
          local_link?: string | null;
          minutos_tempo?: number;
          mvp_fechado_em?: string | null;
          mvp_id?: string | null;
          cores_times?: string[] | null;
          nomes_times?: string[] | null;
          num_times?: number;
          organizador_id: string;
          placar_estado?: Json | null;
          placar_finalizado_em?: string | null;
          quantidade_vagas: number;
          status?: string;
          tempos?: number;
          tipo?: string;
          titulo: string;
        };
        Update: {
          avaliacao_ate?: string | null;
          avisada_em?: string | null;
          cidade?: string;
          contagem_vitoria?: string;
          crew_id?: string | null;
          criado_em?: string;
          data?: string;
          descricao?: string | null;
          finalizada_em?: string | null;
          gols_limite?: number | null;
          horario?: string;
          horario_fim?: string | null;
          id?: string;
          local?: string;
          local_link?: string | null;
          minutos_tempo?: number;
          mvp_fechado_em?: string | null;
          mvp_id?: string | null;
          cores_times?: string[] | null;
          nomes_times?: string[] | null;
          num_times?: number;
          organizador_id?: string;
          placar_estado?: Json | null;
          placar_finalizado_em?: string | null;
          quantidade_vagas?: number;
          status?: string;
          tempos?: number;
          tipo?: string;
          titulo?: string;
        };
        Relationships: [
          {
            foreignKeyName: "matches_crew_id_fkey";
            columns: ["crew_id"];
            isOneToOne: false;
            referencedRelation: "crews";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "matches_mvp_id_fkey";
            columns: ["mvp_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "matches_organizador_id_fkey";
            columns: ["organizador_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      assinaturas: {
        Row: {
          atualizado_em: string;
          cancela_no_fim: boolean;
          periodo_fim: string | null;
          plano: string | null;
          status: string;
          stripe_customer_id: string;
          stripe_subscription_id: string | null;
          user_id: string;
          usou_promocao: boolean;
        };
        Insert: {
          atualizado_em?: string;
          cancela_no_fim?: boolean;
          periodo_fim?: string | null;
          plano?: string | null;
          status?: string;
          stripe_customer_id: string;
          stripe_subscription_id?: string | null;
          user_id: string;
          usou_promocao?: boolean;
        };
        Update: {
          atualizado_em?: string;
          cancela_no_fim?: boolean;
          periodo_fim?: string | null;
          plano?: string | null;
          status?: string;
          stripe_customer_id?: string;
          stripe_subscription_id?: string | null;
          user_id?: string;
          usou_promocao?: boolean;
        };
        Relationships: [];
      };
      contatos: {
        Row: { atualizado_em: string; celular: string | null; id: string };
        Insert: { atualizado_em?: string; celular?: string | null; id: string };
        Update: { atualizado_em?: string; celular?: string | null; id?: string };
        Relationships: [];
      };
      conquistas: {
        Row: { codigo: string; ganha_em: string; user_id: string };
        Insert: { codigo: string; ganha_em?: string; user_id: string };
        Update: { codigo?: string; ganha_em?: string; user_id?: string };
        Relationships: [];
      };
      ranking_semanal: {
        Row: {
          posicao_cidade: number | null;
          posicao_geral: number;
          semana: string;
          user_id: string;
        };
        Insert: {
          posicao_cidade?: number | null;
          posicao_geral: number;
          semana: string;
          user_id: string;
        };
        Update: {
          posicao_cidade?: number | null;
          posicao_geral?: number;
          semana?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          avaliacoes_recebidas: number;
          bio: string | null;
          capa: string | null;
          card_gerado_url: string | null;
          cidade: string | null;
          criado_em: string;
          eh_convidado: boolean;
          foto_url: string | null;
          handle: string | null;
          id: string;
          moldura: string | null;
          nome_exibicao: string;
          overall: number;
          peladas_jogadas: number;
          perfil_completo: boolean;
          plano: string;
          premium_ate: string | null;
          posicao_preferida: string | null;
          push_desligados: string[];
          tier_pendente: string | null;
          tier_reconhecido: string | null;
          vezes_mvp: number;
          xp: number;
        };
        Insert: {
          avaliacoes_recebidas?: number;
          bio?: string | null;
          capa?: string | null;
          card_gerado_url?: string | null;
          cidade?: string | null;
          criado_em?: string;
          eh_convidado?: boolean;
          foto_url?: string | null;
          handle?: string | null;
          id: string;
          moldura?: string | null;
          nome_exibicao: string;
          overall?: number;
          peladas_jogadas?: number;
          perfil_completo?: boolean;
          plano?: string;
          premium_ate?: string | null;
          posicao_preferida?: string | null;
          push_desligados?: string[];
          tier_pendente?: string | null;
          tier_reconhecido?: string | null;
          vezes_mvp?: number;
          xp?: number;
        };
        Update: {
          avaliacoes_recebidas?: number;
          bio?: string | null;
          capa?: string | null;
          card_gerado_url?: string | null;
          cidade?: string | null;
          criado_em?: string;
          eh_convidado?: boolean;
          foto_url?: string | null;
          handle?: string | null;
          id?: string;
          moldura?: string | null;
          nome_exibicao?: string;
          overall?: number;
          peladas_jogadas?: number;
          perfil_completo?: boolean;
          plano?: string;
          premium_ate?: string | null;
          posicao_preferida?: string | null;
          push_desligados?: string[];
          tier_pendente?: string | null;
          tier_reconhecido?: string | null;
          vezes_mvp?: number;
          xp?: number;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      eh_premium: { Args: { p_user: string }; Returns: boolean };
      esquecer_dispositivo: { Args: { p_token: string }; Returns: undefined };
      registrar_dispositivo: {
        Args: { p_token: string; p_plataforma?: string };
        Returns: undefined;
      };
      calcular_xp: { Args: { _uid: string }; Returns: number };
      convite_info: {
        Args: { p_token: string };
        Returns: {
          cidade: string;
          confirmados: number;
          data: string;
          descricao: string;
          horario: string;
          horario_fim: string;
          local: string;
          match_id: string;
          organizador_nome: string;
          quantidade_vagas: number;
          tipo: string;
          titulo: string;
        }[];
      };
      crew_stats: {
        Args: { p_ate?: string; p_crew_id: string; p_desde?: string };
        Returns: {
          amarelos: number;
          assistencias: number;
          azuis: number;
          defesas: number;
          derrotas: number;
          vermelhos: number;
          empates: number;
          foto_url: string;
          gols: number;
          jogos: number;
          member_id: string;
          mvps: number;
          nome: string;
          peladas: number;
          user_id: string;
          vitorias: number;
        }[];
      };
      definir_admin: {
        Args: { p_admin: boolean; p_member_id: string };
        Returns: undefined;
      };
      apagar_meu_comentario_de_turma: { Args: { p_review_id: string }; Returns: undefined };
      avaliar_turma: {
        Args: {
          p_ambiente: number;
          p_comentario?: string;
          p_crew_id: string;
          p_estrutura: number;
          p_nivel: number;
          p_organizacao: number;
          p_pontualidade: number;
        };
        Returns: undefined;
      };
      cancelar_pedido_de_entrada: { Args: { p_crew_id: string }; Returns: undefined };
      comentarios_da_turma: {
        Args: { p_crew_id: string };
        Returns: {
          autor_foto: string | null;
          autor_id: string | null;
          autor_nome: string;
          comentario: string;
          criado_em: string;
          denunciei: boolean;
          id: string;
          meu: boolean;
          oculto: boolean;
        }[];
      };
      entrar_na_turma: {
        Args: { p_crew_id: string; p_member_id?: string; p_token?: string };
        Returns: string;
      };
      pedidos_da_turma: {
        Args: { p_crew_id: string };
        Returns: {
          avaliacoes_recebidas: number;
          cidade: string | null;
          criado_em: string;
          foto_url: string | null;
          handle: string | null;
          id: string;
          nome: string;
          overall: number;
          peladas: number;
          posicao: string | null;
          tier: string | null;
          user_id: string;
        }[];
      };
      pedir_entrada_na_turma: { Args: { p_crew_id: string }; Returns: undefined };
      ranking_de_turmas: {
        Args: { p_cidade: string };
        Returns: {
          aceita_pedidos: boolean;
          avaliacoes: number;
          cidade: string | null;
          crew_id: string;
          escudo_url: string | null;
          membros: number;
          nome: string;
          nota: number | null;
          peladas: number;
          sou_membro: boolean;
        }[];
      };
      renovar_convite_da_turma: { Args: { p_crew_id: string }; Returns: string };
      responder_pedido_de_entrada: {
        Args: { p_aprovar: boolean; p_pedido_id: string };
        Returns: undefined;
      };
      resumo_da_turma: {
        Args: { p_crew_id: string };
        Returns: {
          aceita_pedidos: boolean;
          ambiente: number | null;
          estrutura: number | null;
          minha: Json | null;
          nivel: number | null;
          nota: number | null;
          organizacao: number | null;
          pedido: string | null;
          pontualidade: number | null;
          posso_avaliar: boolean;
          total: number;
        }[];
      };
      excluir_minha_conta: { Args: never; Returns: undefined };
      finalizar_peladas_vencidas: { Args: never; Returns: undefined };
      gere_pelada: { Args: { p_match_id: string }; Returns: boolean };
      gere_turma: { Args: { p_crew_id: string }; Returns: boolean };
      minhas_turmas: {
        Args: never;
        Returns: {
          artilheiro: string | null;
          artilheiro_gols: number | null;
          crew_id: string;
          membros: number;
          meus_gols: number;
          minha_posicao: number | null;
          nome: string;
          peladas: number;
          proxima_data: string | null;
          proxima_horario: string | null;
          proxima_id: string | null;
          sou_admin: boolean;
          sou_dono: boolean;
        }[];
      };
      pode_avaliar: {
        Args: { _avaliado: string; _avaliador: string; _match_id: string };
        Returns: boolean;
      };
      reivindicar_tier: { Args: never; Returns: string };
      excluir_turma: { Args: { p_crew_id: string }; Returns: undefined };
      apagar_meu_comentario: { Args: { p_evaluation_id: string }; Returns: undefined };
      comentarios_do_jogador: {
        Args: { p_user_id: string };
        Returns: {
          autor_foto: string | null;
          autor_id: string | null;
          autor_nome: string;
          comentario: string;
          criado_em: string;
          denunciei: boolean;
          id: string;
          meu: boolean;
          oculto: boolean;
          pelada: string | null;
        }[];
      };
      denunciar_comentario: {
        Args: { p_alvo_id: string; p_motivo?: string; p_tipo: string };
        Returns: undefined;
      };
      mvp_da_partida: {
        Args: { p_match_id: string };
        Returns: {
          avaliacoes: number;
          mvp_id: string;
          nota: number;
        }[];
      };
      avaliacoes_da_pelada: {
        Args: { p_match_id: string };
        Returns: {
          avaliacoes: number;
          foto_url: string | null;
          handle: string | null;
          nome_exibicao: string;
          nota: number;
          posicao_preferida: string | null;
          user_id: string;
        }[];
      };
      quem_me_avaliou: {
        Args: { p_match_id: string };
        Returns: {
          avaliador_id: string | null;
          foto_url: string | null;
          handle: string | null;
          identificavel: boolean;
          nome: string | null;
          nota_geral: number;
          notas: Json;
          posicao: string | null;
        }[];
      };
      juntar_membros: {
        Args: { p_destino: string; p_origem: string };
        Returns: string;
      };
      medias_do_jogador: {
        Args: { p_user_id: string };
        Returns: {
          comportamento: number;
          controle: number;
          cruzamento: number;
          desarme: number;
          drible: number;
          elasticidade: number;
          finalizacao: number;
          fisico: number;
          jogo_aereo: number;
          jogo_pes: number;
          marcacao: number;
          nota_geral: number;
          notas_liberadas: boolean;
          passe: number;
          posicionamento_goleiro: number;
          reflexo: number;
          reposicao: number;
          saida_gol: number;
          total: number;
          total_goleiro: number;
          velocidade: number;
          visao: number;
        }[];
      };
      raio_x_do_jogador: { Args: never; Returns: Json };
      progresso_das_conquistas: {
        Args: { p_user: string };
        Returns: { codigo: string; meta: number; valor: number }[];
      };
      remover_da_turma: { Args: { p_member_id: string }; Returns: undefined };
      sair_da_turma: { Args: { p_crew_id: string }; Returns: undefined };
      salvar_placar: {
        Args: { p_match_id: string; p_payload: Json };
        Returns: undefined;
      };
      tier_do_jogador: {
        Args: { _avaliacoes: number; _overall: number; _xp: number };
        Returns: string;
      };
      tier_ordem: { Args: { _nome: string }; Returns: number };
      tirar_da_pelada: {
        Args: { p_match_id: string; p_user_id: string };
        Returns: undefined;
      };
      vincular_membro: {
        Args: { p_member_id: string; p_user_id: string };
        Returns: string;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema["CompositeTypes"] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {},
  },
} as const;
