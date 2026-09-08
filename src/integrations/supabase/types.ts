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
      matches: {
        Row: {
          cidade: string
          criado_em: string
          data: string
          descricao: string | null
          finalizada_em: string | null
          horario: string
          id: string
          local: string
          mvp_id: string | null
          organizador_id: string
          quantidade_vagas: number
          status: string
          tipo: string
          titulo: string
        }
        Insert: {
          cidade: string
          criado_em?: string
          data: string
          descricao?: string | null
          finalizada_em?: string | null
          horario: string
          id?: string
          local: string
          mvp_id?: string | null
          organizador_id: string
          quantidade_vagas: number
          status?: string
          tipo?: string
          titulo: string
        }
        Update: {
          cidade?: string
          criado_em?: string
          data?: string
          descricao?: string | null
          finalizada_em?: string | null
          horario?: string
          id?: string
          local?: string
          mvp_id?: string | null
          organizador_id?: string
          quantidade_vagas?: number
          status?: string
          tipo?: string
          titulo?: string
        }
        Relationships: [
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
          vezes_mvp: number
        }
        Insert: {
          avaliacoes_recebidas?: number
          bio?: string | null
          card_gerado_url?: string | null
          cidade?: string | null
          criado_em?: string
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
          vezes_mvp?: number
        }
        Update: {
          avaliacoes_recebidas?: number
          bio?: string | null
          card_gerado_url?: string | null
          cidade?: string | null
          criado_em?: string
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
          vezes_mvp?: number
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      pode_avaliar: {
        Args: { _avaliado: string; _avaliador: string; _match_id: string }
        Returns: boolean
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
