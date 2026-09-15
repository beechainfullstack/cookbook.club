export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      book_entries: {
        Row: {
          created_at: string
          flavor: Database["public"]["Enums"]["flavor"]
          id: string
          revealed: boolean
          school_id: string
          tagged_name: string
          tagged_user_id: string
          tagger_names: string[]
          tagger_user_ids: string[]
        }
        Insert: {
          created_at?: string
          flavor: Database["public"]["Enums"]["flavor"]
          id: string
          revealed?: boolean
          school_id: string
          tagged_name: string
          tagged_user_id: string
          tagger_names?: string[]
          tagger_user_ids?: string[]
        }
        Update: {
          created_at?: string
          flavor?: Database["public"]["Enums"]["flavor"]
          id?: string
          revealed?: boolean
          school_id?: string
          tagged_name?: string
          tagged_user_id?: string
          tagger_names?: string[]
          tagger_user_ids?: string[]
        }
        Relationships: [
          {
            foreignKeyName: "book_entries_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "book_entries_tagged_user_id_fkey"
            columns: ["tagged_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string
          id: string
          school_id: string
        }
        Insert: {
          created_at?: string
          display_name: string
          id: string
          school_id: string
        }
        Update: {
          created_at?: string
          display_name?: string
          id?: string
          school_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      schools: {
        Row: {
          active: boolean
          id: string
          location: string
          name: string
        }
        Insert: {
          active?: boolean
          id?: string
          location: string
          name: string
        }
        Update: {
          active?: boolean
          id?: string
          location?: string
          name?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      claim_push_deliveries: {
        Args: never
        Returns: {
          flavor: Database["public"]["Enums"]["flavor"]
          id: string
          lease_id: string
          token: string
          user_id: string
        }[]
      }
      create_tag: {
        Args: {
          p_flavor: Database["public"]["Enums"]["flavor"]
          p_request_id: string
          p_tagged_id: string
        }
        Returns: string
      }
      enroll: {
        Args: {
          p_birth_date: string
          p_display_name: string
          p_school_code: string
          p_school_id: string
        }
        Returns: {
          created_at: string
          display_name: string
          id: string
          school_id: string
        }
        SetofOptions: {
          from: "*"
          to: "profiles"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      finish_push_delivery: {
        Args: {
          p_error?: string
          p_id: string
          p_lease_id: string
          p_remove_token?: boolean
          p_ticket_id?: string
        }
        Returns: undefined
      }
      get_book: {
        Args: {
          p_before_id?: string
          p_before_time?: string
          p_flavor?: Database["public"]["Enums"]["flavor"]
          p_recipient?: string
        }
        Returns: {
          created_at: string
          flavor: Database["public"]["Enums"]["flavor"]
          id: string
          revealed: boolean
          school_id: string
          tagged_name: string
          tagged_user_id: string
          tagger_names: string[]
          tagger_user_ids: string[]
        }[]
        SetofOptions: {
          from: "*"
          to: "book_entries"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      get_contacts: {
        Args: never
        Returns: {
          display_name: string
          id: string
        }[]
      }
      my_school_id: { Args: never; Returns: string }
      register_push_token: { Args: { p_token: string }; Returns: undefined }
      remove_push_token: { Args: { p_token: string }; Returns: undefined }
      sync_contacts: {
        Args: { p_phones: string[] }
        Returns: {
          display_name: string
          id: string
        }[]
      }
    }
    Enums: {
      flavor: "art" | "sports" | "style" | "music" | "ideas" | "kindness"
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      flavor: ["art", "sports", "style", "music", "ideas", "kindness"],
    },
  },
} as const
