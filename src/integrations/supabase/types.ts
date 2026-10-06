export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      card_tiers: {
        Row: {
          id: string
          nome: string
          ordem: number
          overall_minimo: number
          peladas_minimas: number
        }
        Insert: {
          id?: string
          nome: string
          ordem: number
          overall_minimo: number
          peladas_minimas: number
        }
        Update: {
          id?: string
          nome?: string
          ordem?: number
          overall_minimo?: number
          peladas_minimas?: number
        }
        Relationships: []
      }
      crew_members: {
        Row: {
          crew_id: string
          criado_em: string
          estrelas: number | null
          id: string
          nome: string
          posicao: string | null
          user_id: string | null
        }
        Insert: {
          crew_id: string
          criado_em?: string
          estrelas?: number | null
          id?: string
          nome: string
          posicao?: string | null
          user_id?: string | null
        }
        Update: {
          crew_id?: string
          criado_em?: string
          estrelas?: number | null
          id?: string
          nome?: string
          posicao?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crew_members_crew_id_fkey"
            columns: ["crew_id"]
            isOneToOne: false
            referencedRelation: "crews"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crew_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      crews: {
        Row: {
          criado_em: string
          dono_id: string
          id: string
          nome: string
        }
        Insert: {
          criado_em?: string
          dono_id: string
          id?: string
          nome: string
        }
        Update: {
          criado_em?: string
          dono_id?: string
          id?: string
          nome?: string
        }
        Relationships: [
          {
            foreignKeyName: "crews_dono_id_fkey"
            columns: ["dono_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      evaluations: {
        Row: {
          avaliado_id: string
          avaliador_id: string
          chute: number | null
          comportamento: number | null
          criado_em: string
          drible: number | null
          id: string
          match_id: string
          nota_geral: number
          pontualidade: number | null
          posicionamento: number | null
          toque: number | null
          velocidade: number | null
        }
        Insert: {
          avaliado_id: string
          avaliador_id: string
          chute?: number | null
          comportamento?: number | null
          criado_em?: string
          drible?: number | null
          id?: string
          match_id: string
          nota_geral: number
          pontualidade?: number | null
          posicionamento?: number | null
          toque?: number | null
          velocidade?: number | null
        }
        Update: {
          avaliado_id?: string
          avaliador_id?: string
          chute?: number | null
          comportamento?: number | null
          criado_em?: string
          drible?: number | null
          id?: string
          match_id?: string
          nota_geral?: number
          pontualidade?: number | null
          posicionamento?: number | null
          toque?: number | null
          velocidade?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "evaluations_avaliado_id_fkey"
            columns: ["avaliado_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evaluations_avaliador_id_fkey"
            columns: ["avaliador_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evaluations_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
        ]
      }
      followers: {
        Row: {
          criado_em: string
          id: string
          seguido_id: string
          seguidor_id: string
        }
        Insert: {
          criado_em?: string
          id?: string
          seguido_id: string
          seguidor_id: string
        }
        Update: {
          criado_em?: string
          id?: string
          seguido_id?: string
          seguidor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "followers_seguido_id_fkey"
            columns: ["seguido_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "followers_seguidor_id_fkey"
            columns: ["seguidor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      game_players: {
        Row: {
          game_id: string
          member_id: string
          time: number
        }
        Insert: {
          game_id: string
          member_id: string
          time: number
        }
        Update: {
          game_id?: string
          member_id?: string
          time?: number
        }
        Relationships: [
          {
            foreignKeyName: "game_players_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "game_players_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "crew_members"
            referencedColumns: ["id"]
          },
        ]
      }
      games: {
        Row: {
          duracao_seg: number
          gols_a: number
          gols_b: number
          id: string
          match_id: string
          ordem: number
          time_a: number
          time_b: number
          vencedor: number | null
        }
        Insert: {
          duracao_seg?: number
          gols_a?: number
          gols_b?: number
          id?: string
          match_id: string
          ordem: number
          time_a: number
          time_b: number
          vencedor?: number | null
        }
        Update: {
          duracao_seg?: number
          gols_a?: number
          gols_b?: number
          id?: string
          match_id?: string
          ordem?: number
          time_a?: number
          time_b?: number
          vencedor?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "games_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
        ]
      }
      goals: {
        Row: {
          game_id: string
          id: string
          member_id: string | null
          minuto: number
          tempo: number
          time: number
        }
        Insert: {
          game_id: string
          id?: string
          member_id?: string | null
          minuto?: number
          tempo?: number
          time: number
        }
        Update: {
          game_id?: string
          id?: string
          member_id?: string | null
          minuto?: number
          tempo?: number
          time?: number
        }
        Relationships: [
          {
            foreignKeyName: "goals_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goals_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "crew_members"
            referencedColumns: ["id"]
          },
        ]
      }
      match_invite_links: {
        Row: {
          ativo: boolean
          criado_em: string
          id: string
          match_id: string
          token: string
        }
        Insert: {
          ativo?: boolean
          criado_em?: string
          id?: string
          match_id: string
          token: string
        }
        Update: {
          ativo?: boolean
          criado_em?: string
          id?: string
          match_id?: string
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "match_invite_links_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
        ]
      }
      match_participants: {
        Row: {
          entrou_em: string
          id: string
          match_id: string
          status: string
          user_id: string
        }
        Insert: {
          entrou_em?: string
          id?: string
          match_id: string
          status?: string
          user_id: string
        }
        Update: {
          entrou_em?: string
          id?: string
          match_id?: string
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "match_participants_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_participants_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      match_players: {
        Row: {
          derrotas: number
          empates: number
          gols: number
          id: string
          jogos: number
          match_id: string
          member_id: string
          time: number | null
          vitorias: number
        }
        Insert: {
          derrotas?: number
          empates?: number
          gols?: number
          id?: string
          jogos?: number
          match_id: string
          member_id: string
          time?: number | null
          vitorias?: number
        }
        Update: {
          derrotas?: number
          empates?: number
          gols?: number
          id?: string
          jogos?: number
          match_id?: string
          member_id?: string
          time?: number | null
          vitorias?: number
        }
        Relationships: [
          {
            foreignKeyName: "match_players_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_players_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "crew_members"
            referencedColumns: ["id"]
          },
        ]
      }
      matches: {
        Row: {
          cidade: string
          contagem_vitoria: string
          crew_id: string | null
          criado_em: string
          data: string
          descricao: string | null
          finalizada_em: string | null
          gols_limite: number | null
          horario: string
          horario_fim: string | null
          id: string
          local: string
          minutos_tempo: number
          mvp_id: string | null
          nomes_times: string[] | null
          num_times: number
          organizador_id: string
          placar_estado: Json | null
          placar_finalizado_em: string | null
          quantidade_vagas: number
          status: string
          tempos: number
          tipo: string
          titulo: string
        }
        Insert: {
          cidade: string
          contagem_vitoria?: string
          crew_id?: string | null
          criado_em?: string
          data: string
          descricao?: string | null
          finalizada_em?: string | null
          gols_limite?: number | null
          horario: string
          horario_fim?: string | null
          id?: string
          local: string
          minutos_tempo?: number
          mvp_id?: string | null
          nomes_times?: string[] | null
          num_times?: number
          organizador_id: string
          placar_estado?: Json | null
          placar_finalizado_em?: string | null
          quantidade_vagas: number
          status?: string
          tempos?: number
          tipo?: string
          titulo: string
        }
        Update: {
          cidade?: string
          contagem_vitoria?: string
          crew_id?: string | null
          criado_em?: string
          data?: string
          descricao?: string | null
          finalizada_em?: string | null
          gols_limite?: number | null
          horario?: string
          horario_fim?: string | null
          id?: string
          local?: string
          minutos_tempo?: number
          mvp_id?: string | null
          nomes_times?: string[] | null
          num_times?: number
          organizador_id?: string
          placar_estado?: Json | null
          placar_finalizado_em?: string | null
          quantidade_vagas?: number
          status?: string
          tempos?: number
          tipo?: string
          titulo?: string
        }
        Relationships: [
          {
            foreignKeyName: "matches_crew_id_fkey"
            columns: ["crew_id"]
            isOneToOne: false
            referencedRelation: "crews"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_mvp_id_fkey"
            columns: ["mvp_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_organizador_id_fkey"
            columns: ["organizador_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avaliacoes_recebidas: number
          bio: string | null
          card_gerado_url: string | null
          cidade: string | null
          criado_em: string
          eh_convidado: boolean
          email: string | null
          foto_url: string | null
          handle: string | null
          id: string
          nome_exibicao: string
          overall: number
          peladas_jogadas: number
          perfil_completo: boolean
          plano: string
          posicao_preferida: string | null
          tier_pendente: string | null
          tier_reconhecido: string | null
          vezes_mvp: number
          xp: number
        }
        Insert: {
          avaliacoes_recebidas?: number
          bio?: string | null
          card_gerado_url?: string | null
          cidade?: string | null
          criado_em?: string
          eh_convidado?: boolean
          email?: string | null
          foto_url?: string | null
          handle?: string | null
          id: string
          nome_exibicao: string
          overall?: number
          peladas_jogadas?: number
          perfil_completo?: boolean
          plano?: string
          posicao_preferida?: string | null
          tier_pendente?: string | null
          tier_reconhecido?: string | null
          vezes_mvp?: number
          xp?: number
        }
        Update: {
          avaliacoes_recebidas?: number
          bio?: string | null
          card_gerado_url?: string | null
          cidade?: string | null
          criado_em?: string
          eh_convidado?: boolean
          email?: string | null
          foto_url?: string | null
          handle?: string | null
          id?: string
          nome_exibicao?: string
          overall?: number
          peladas_jogadas?: number
          perfil_completo?: boolean
          plano?: string
          posicao_preferida?: string | null
          tier_pendente?: string | null
          tier_reconhecido?: string | null
          vezes_mvp?: number
          xp?: number
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      calcular_xp: { Args: { _uid: string }; Returns: number }
      convite_info: {
        Args: { p_token: string }
        Returns: {
          cidade: string
          confirmados: number
          data: string
          descricao: string
          horario: string
          horario_fim: string
          local: string
          match_id: string
          organizador_nome: string
          quantidade_vagas: number
          tipo: string
          titulo: string
        }[]
      }
      crew_stats: {
        Args: { p_ate?: string; p_crew_id: string; p_desde?: string }
        Returns: {
          derrotas: number
          empates: number
          foto_url: string
          gols: number
          jogos: number
          member_id: string
          nome: string
          peladas: number
          user_id: string
          vitorias: number
        }[]
      }
      entrar_na_turma: {
        Args: { p_crew_id: string; p_member_id?: string }
        Returns: string
      }
      finalizar_peladas_vencidas: { Args: never; Returns: undefined }
      minhas_turmas: {
        Args: never
        Returns: {
          artilheiro: string | null
          artilheiro_gols: number | null
          crew_id: string
          membros: number
          meus_gols: number
          minha_posicao: number | null
          nome: string
          peladas: number
          proxima_data: string | null
          proxima_horario: string | null
          proxima_id: string | null
          sou_dono: boolean
        }[]
      }
      pode_avaliar: {
        Args: { _avaliado: string; _avaliador: string; _match_id: string }
        Returns: boolean
      }
      reivindicar_tier: { Args: never; Returns: string }
      sair_da_turma: { Args: { p_crew_id: string }; Returns: undefined }
      salvar_placar: {
        Args: { p_match_id: string; p_payload: Json }
        Returns: undefined
      }
      tier_do_jogador: {
        Args: { _avaliacoes: number; _overall: number; _xp: number }
        Returns: string
      }
      tier_ordem: { Args: { _nome: string }; Returns: number }
      vincular_membro: {
        Args: { p_member_id: string; p_user_id: string }
        Returns: string
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
