export type Json = string | number | boolean | null | {
  [key: string]: Json | undefined
} | Json[]

export type Database = {
  "graphql_public": {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      "graphql": {
        Args: {
          "extensions"?: Json
          "operationName"?: string
          "query"?: string
          "variables"?: Json
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
  "public": {
    Tables: {
      "budget_alerts": {
        Row: {
          "claimed_at": string | null
          "month": string
          "sent_at": string | null
        }
        ComputedFields: never
        Insert: {
          "claimed_at"?: string | null
          "month": string
          "sent_at"?: string | null
        }
        Update: {
          "claimed_at"?: string | null
          "month"?: string
          "sent_at"?: string | null
        }
        Relationships: []
      }
      "feedback": {
        Row: {
          "comment": string | null
          "created_at": string
          "id": string
          "message_id": string
          "rating": number
          "user_id": string
        }
        ComputedFields: never
        Insert: {
          "comment"?: string | null
          "created_at"?: string
          "id"?: string
          "message_id": string
          "rating": number
          "user_id": string
        }
        Update: {
          "comment"?: string | null
          "created_at"?: string
          "id"?: string
          "message_id"?: string
          "rating"?: number
          "user_id"?: string
        }
        Relationships: [
          {
            foreignKeyName: "feedback_message_id_user_id_fkey"
            columns: ["message_id", "user_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id", "user_id"]
          },
          {
            foreignKeyName: "feedback_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      "llm_usage": {
        Row: {
          "cache_creation_tokens": number
          "cached_input_tokens": number
          "cost_usd": number
          "created_at": string
          "id": string
          "input_tokens": number
          "message_id": string | null
          "model": string
          "output_tokens": number
          "status": string
          "user_id": string | null
        }
        ComputedFields: never
        Insert: {
          "cache_creation_tokens"?: number
          "cached_input_tokens"?: number
          "cost_usd": number
          "created_at"?: string
          "id"?: string
          "input_tokens": number
          "message_id"?: string | null
          "model": string
          "output_tokens": number
          "status"?: string
          "user_id"?: string | null
        }
        Update: {
          "cache_creation_tokens"?: number
          "cached_input_tokens"?: number
          "cost_usd"?: number
          "created_at"?: string
          "id"?: string
          "input_tokens"?: number
          "message_id"?: string | null
          "model"?: string
          "output_tokens"?: number
          "status"?: string
          "user_id"?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "llm_usage_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "llm_usage_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      "message_deliveries": {
        Row: {
          "attempted_at": string | null
          "attempts": number
          "channel": string
          "created_at": string
          "error_code": string | null
          "id": string
          "message_id": string
          "next_attempt_at": string
          "provider_id": string | null
          "push_token": string | null
          "status": string
        }
        ComputedFields: never
        Insert: {
          "attempted_at"?: string | null
          "attempts"?: number
          "channel": string
          "created_at"?: string
          "error_code"?: string | null
          "id"?: string
          "message_id": string
          "next_attempt_at"?: string
          "provider_id"?: string | null
          "push_token"?: string | null
          "status"?: string
        }
        Update: {
          "attempted_at"?: string | null
          "attempts"?: number
          "channel"?: string
          "created_at"?: string
          "error_code"?: string | null
          "id"?: string
          "message_id"?: string
          "next_attempt_at"?: string
          "provider_id"?: string | null
          "push_token"?: string | null
          "status"?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_deliveries_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
        ]
      }
      "messages": {
        Row: {
          "channels": (string)[]
          "claimed_at": string | null
          "content": string
          "cost_usd": number
          "created_at": string
          "cycle_key": string | null
          "error_code": string | null
          "generation_attempts": number
          "id": string
          "input_tokens": number
          "model": string | null
          "output_tokens": number
          "scheduled_for": string
          "sent_at": string | null
          "state": string
          "survey_updated_at": string | null
          "type": string
          "user_id": string
        }
        ComputedFields: never
        Insert: {
          "channels"?: (string)[]
          "claimed_at"?: string | null
          "content": string
          "cost_usd"?: number
          "created_at"?: string
          "cycle_key"?: string | null
          "error_code"?: string | null
          "generation_attempts"?: number
          "id"?: string
          "input_tokens"?: number
          "model"?: string | null
          "output_tokens"?: number
          "scheduled_for"?: string
          "sent_at"?: string | null
          "state"?: string
          "survey_updated_at"?: string | null
          "type": string
          "user_id": string
        }
        Update: {
          "channels"?: (string)[]
          "claimed_at"?: string | null
          "content"?: string
          "cost_usd"?: number
          "created_at"?: string
          "cycle_key"?: string | null
          "error_code"?: string | null
          "generation_attempts"?: number
          "id"?: string
          "input_tokens"?: number
          "model"?: string | null
          "output_tokens"?: number
          "scheduled_for"?: string
          "sent_at"?: string | null
          "state"?: string
          "survey_updated_at"?: string | null
          "type"?: string
          "user_id"?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      "notification_settings": {
        Row: {
          "channels": (string)[]
          "day": number
          "expo_push_token": string | null
          "paused": boolean
          "star_mode": boolean
          "time": string
          "timezone": string
          "updated_at": string
          "user_id": string
        }
        ComputedFields: never
        Insert: {
          "channels"?: (string)[]
          "day"?: number
          "expo_push_token"?: string | null
          "paused"?: boolean
          "star_mode"?: boolean
          "time"?: string
          "timezone"?: string
          "updated_at"?: string
          "user_id": string
        }
        Update: {
          "channels"?: (string)[]
          "day"?: number
          "expo_push_token"?: string | null
          "paused"?: boolean
          "star_mode"?: boolean
          "time"?: string
          "timezone"?: string
          "updated_at"?: string
          "user_id"?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_settings_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      "photos": {
        Row: {
          "id": string
          "last_shown_at": string | null
          "season_tag": string
          "storage_path": string
          "uploaded_at": string
          "user_id": string
        }
        ComputedFields: never
        Insert: {
          "id"?: string
          "last_shown_at"?: string | null
          "season_tag": string
          "storage_path": string
          "uploaded_at"?: string
          "user_id": string
        }
        Update: {
          "id"?: string
          "last_shown_at"?: string | null
          "season_tag"?: string
          "storage_path"?: string
          "uploaded_at"?: string
          "user_id"?: string
        }
        Relationships: [
          {
            foreignKeyName: "photos_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      "sky_events": {
        Row: {
          "computation_source": string
          "data": NonNullable<Json>
          "id": string
          "occurs_at": string
          "type": string
        }
        ComputedFields: never
        Insert: {
          "computation_source": string
          "data"?: NonNullable<Json>
          "id"?: string
          "occurs_at": string
          "type": string
        }
        Update: {
          "computation_source"?: string
          "data"?: NonNullable<Json>
          "id"?: string
          "occurs_at"?: string
          "type"?: string
        }
        Relationships: []
      }
      "survey_answers": {
        Row: {
          "goals": (string)[]
          "goals_other": string
          "inspirations": string
          "priorities": (string)[]
          "priorities_other": string
          "putting_off": string
          "saved_step": number
          "updated_at": string
          "user_id": string
        }
        ComputedFields: never
        Insert: {
          "goals"?: (string)[]
          "goals_other"?: string
          "inspirations"?: string
          "priorities"?: (string)[]
          "priorities_other"?: string
          "putting_off"?: string
          "saved_step"?: number
          "updated_at"?: string
          "user_id": string
        }
        Update: {
          "goals"?: (string)[]
          "goals_other"?: string
          "inspirations"?: string
          "priorities"?: (string)[]
          "priorities_other"?: string
          "putting_off"?: string
          "saved_step"?: number
          "updated_at"?: string
          "user_id"?: string
        }
        Relationships: [
          {
            foreignKeyName: "survey_answers_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      "users": {
        Row: {
          "created_at": string
          "id": string
          "messaging_hold": boolean
          "onboarding_completed_at": string | null
        }
        ComputedFields: never
        Insert: {
          "created_at"?: string
          "id": string
          "messaging_hold"?: boolean
          "onboarding_completed_at"?: string | null
        }
        Update: {
          "created_at"?: string
          "id"?: string
          "messaging_hold"?: boolean
          "onboarding_completed_at"?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      "claim_budget_alert": {
        Args: Record<PropertyKey, never>
        Returns: {
          "claimed_at": string | null
          "month": string
          "sent_at": string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "budget_alerts"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      "claim_delivery": {
        Args: { "p_user_id"?: string }
        Returns: {
          "attempted_at": string | null
          "attempts": number
          "channel": string
          "created_at": string
          "error_code": string | null
          "id": string
          "message_id": string
          "next_attempt_at": string
          "provider_id": string | null
          "push_token": string | null
          "status": string
        }[]
        SetofOptions: {
          from: "*"
          to: "message_deliveries"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      "claim_generation": {
        Args: { "p_user_id"?: string }
        Returns: {
          "channels": (string)[]
          "claimed_at": string | null
          "content": string
          "cost_usd": number
          "created_at": string
          "cycle_key": string | null
          "error_code": string | null
          "generation_attempts": number
          "id": string
          "input_tokens": number
          "model": string | null
          "output_tokens": number
          "scheduled_for": string
          "sent_at": string | null
          "state": string
          "survey_updated_at": string | null
          "type": string
          "user_id": string
        }[]
        SetofOptions: {
          from: "*"
          to: "messages"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      "complete_onboarding": {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      "crisis_signal": { Args: { "value": string }; Returns: boolean }
      "enqueue_safety": { Args: { "p_content": string }; Returns: number }
      "enqueue_weekly": {
        Args: { "p_deliver_now"?: boolean; "p_user_id"?: string }
        Returns: number
      }
      "invoke_weekly_worker": {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      "is_timezone": { Args: { "value": string }; Returns: boolean }
      "next_checkin": {
        Args: {
          "after_time": string
          "day_number": number
          "local_time": string
          "zone": string
        }
        Returns: string
      }
      "prepare_deliveries": {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      "reserve_llm": {
        Args: {
          "p_budget": number
          "p_max_cost": number
          "p_message_id": string
          "p_model": string
        }
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  } ? keyof (
      & DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]][
        "Tables"
      ]
      & DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]][
        "Views"
      ]
    )
    : never = never,
> = DefaultSchemaTableNameOrOptions extends
  { schema: keyof DatabaseWithoutInternals } ? (
    & DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]][
      "Tables"
    ]
    & DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]][
      "Views"
    ]
  )[TableName] extends {
    Row: infer R
  } ? R
  : never
  : DefaultSchemaTableNameOrOptions extends
    keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[
      DefaultSchemaTableNameOrOptions
    ] extends {
      Row: infer R
    } ? R
    : never
  : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  } ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]][
      "Tables"
    ]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends
  { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]][
    "Tables"
  ][TableName] extends {
    Insert: infer I
  } ? I
  : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Insert: infer I
    } ? I
    : never
  : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  } ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]][
      "Tables"
    ]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends
  { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]][
    "Tables"
  ][TableName] extends {
    Update: infer U
  } ? U
  : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Update: infer U
    } ? U
    : never
  : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  } ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]][
      "Enums"
    ]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends
  { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][
    EnumName
  ]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
  : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  } ? keyof DatabaseWithoutInternals[
      PublicCompositeTypeNameOrOptions["schema"]
    ]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends
  { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]][
    "CompositeTypes"
  ][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "graphql_public": {
    Enums: {},
  },
  "public": {
    Enums: {},
  },
} as const
