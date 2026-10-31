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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      agent_audit: {
        Row: {
          action: string
          actor_user: string | null
          agent_id: string | null
          created_at: string
          detail: Json
          id: string
          outcome: string
          target: string | null
        }
        Insert: {
          action: string
          actor_user?: string | null
          agent_id?: string | null
          created_at?: string
          detail?: Json
          id?: string
          outcome: string
          target?: string | null
        }
        Update: {
          action?: string
          actor_user?: string | null
          agent_id?: string | null
          created_at?: string
          detail?: Json
          id?: string
          outcome?: string
          target?: string | null
        }
        Relationships: []
      }
      agent_credentials: {
        Row: {
          agent_id: string
          created_at: string
          created_by: string
          expires_at: string
          id: string
          last_used_at: string | null
          revoked_at: string | null
          token_hash: string
          token_prefix: string
        }
        Insert: {
          agent_id: string
          created_at?: string
          created_by: string
          expires_at: string
          id?: string
          last_used_at?: string | null
          revoked_at?: string | null
          token_hash: string
          token_prefix: string
        }
        Update: {
          agent_id?: string
          created_at?: string
          created_by?: string
          expires_at?: string
          id?: string
          last_used_at?: string | null
          revoked_at?: string | null
          token_hash?: string
          token_prefix?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_credentials_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_grants: {
        Row: {
          agent_id: string
          created_at: string
          expires_at: string
          granted_by: string
          id: string
          revoked_at: string | null
          scopes: string[]
          target: string
        }
        Insert: {
          agent_id: string
          created_at?: string
          expires_at: string
          granted_by: string
          id?: string
          revoked_at?: string | null
          scopes: string[]
          target: string
        }
        Update: {
          agent_id?: string
          created_at?: string
          expires_at?: string
          granted_by?: string
          id?: string
          revoked_at?: string | null
          scopes?: string[]
          target?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_grants_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_tasks: {
        Row: {
          agent_id: string
          created_at: string
          created_by: string
          id: string
          instruction: string
          required_scope: string
          result: string | null
          result_entry: string | null
          status: Database["public"]["Enums"]["task_status"]
          target: string
          updated_at: string
        }
        Insert: {
          agent_id: string
          created_at?: string
          created_by: string
          id?: string
          instruction: string
          required_scope: string
          result?: string | null
          result_entry?: string | null
          status?: Database["public"]["Enums"]["task_status"]
          target: string
          updated_at?: string
        }
        Update: {
          agent_id?: string
          created_at?: string
          created_by?: string
          id?: string
          instruction?: string
          required_scope?: string
          result?: string | null
          result_entry?: string | null
          status?: Database["public"]["Enums"]["task_status"]
          target?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_tasks_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_tasks_result_entry_fkey"
            columns: ["result_entry"]
            isOneToOne: false
            referencedRelation: "knowledge_entries"
            referencedColumns: ["id"]
          },
        ]
      }
      agents: {
        Row: {
          created_at: string
          created_by: string
          duties: string[]
          id: string
          last_seen_at: string | null
          name: string
          purpose: string
          role: Database["public"]["Enums"]["agent_role"]
          status: Database["public"]["Enums"]["agent_status"]
        }
        Insert: {
          created_at?: string
          created_by: string
          duties?: string[]
          id?: string
          last_seen_at?: string | null
          name: string
          purpose?: string
          role?: Database["public"]["Enums"]["agent_role"]
          status?: Database["public"]["Enums"]["agent_status"]
        }
        Update: {
          created_at?: string
          created_by?: string
          duties?: string[]
          id?: string
          last_seen_at?: string | null
          name?: string
          purpose?: string
          role?: Database["public"]["Enums"]["agent_role"]
          status?: Database["public"]["Enums"]["agent_status"]
        }
        Relationships: []
      }
      invitations: {
        Row: {
          accepted_at: string | null
          accepted_by: string | null
          created_at: string
          email: string
          expires_at: string
          id: string
          invited_by: string
          revoked_at: string | null
          role: Database["public"]["Enums"]["app_role"]
          token_hash: string
        }
        Insert: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string
          email: string
          expires_at?: string
          id?: string
          invited_by: string
          revoked_at?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          token_hash: string
        }
        Update: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string
          revoked_at?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          token_hash?: string
        }
        Relationships: []
      }
      knowledge_entries: {
        Row: {
          agent_id: string | null
          author_user: string | null
          body: string
          created_at: string
          evidence: Database["public"]["Enums"]["evidence_class"]
          id: string
          kind: Database["public"]["Enums"]["knowledge_kind"]
          occurred_at: string | null
          project: string
          sources: Json
          tags: string[]
          title: string
        }
        Insert: {
          agent_id?: string | null
          author_user?: string | null
          body?: string
          created_at?: string
          evidence?: Database["public"]["Enums"]["evidence_class"]
          id?: string
          kind: Database["public"]["Enums"]["knowledge_kind"]
          occurred_at?: string | null
          project?: string
          sources?: Json
          tags?: string[]
          title: string
        }
        Update: {
          agent_id?: string | null
          author_user?: string | null
          body?: string
          created_at?: string
          evidence?: Database["public"]["Enums"]["evidence_class"]
          id?: string
          kind?: Database["public"]["Enums"]["knowledge_kind"]
          occurred_at?: string | null
          project?: string
          sources?: Json
          tags?: string[]
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "knowledge_entries_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
        ]
      }
      qa_issues: {
        Row: {
          agent_id: string | null
          build_version: string
          category: Database["public"]["Enums"]["issue_category"]
          created_at: string
          evidence_ref: string | null
          expected_behavior: string
          id: string
          observed_behavior: string
          platform: string | null
          relayed_to: Json
          reported_by: string | null
          repro_steps: string
          severity: Database["public"]["Enums"]["issue_severity"]
          source: string
          status: Database["public"]["Enums"]["issue_status"]
          title: string
          updated_at: string
        }
        Insert: {
          agent_id?: string | null
          build_version: string
          category?: Database["public"]["Enums"]["issue_category"]
          created_at?: string
          evidence_ref?: string | null
          expected_behavior: string
          id?: string
          observed_behavior: string
          platform?: string | null
          relayed_to?: Json
          reported_by?: string | null
          repro_steps: string
          severity?: Database["public"]["Enums"]["issue_severity"]
          source?: string
          status?: Database["public"]["Enums"]["issue_status"]
          title: string
          updated_at?: string
        }
        Update: {
          agent_id?: string | null
          build_version?: string
          category?: Database["public"]["Enums"]["issue_category"]
          created_at?: string
          evidence_ref?: string | null
          expected_behavior?: string
          id?: string
          observed_behavior?: string
          platform?: string | null
          relayed_to?: Json
          reported_by?: string | null
          repro_steps?: string
          severity?: Database["public"]["Enums"]["issue_severity"]
          source?: string
          status?: Database["public"]["Enums"]["issue_status"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "qa_issues_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
        ]
      }
      service_credentials: {
        Row: {
          created_at: string
          created_by: string
          expires_at: string | null
          id: string
          label: string
          last_used_at: string | null
          revoked_at: string | null
          scopes: string[]
          token_hash: string
          token_prefix: string
        }
        Insert: {
          created_at?: string
          created_by: string
          expires_at?: string | null
          id?: string
          label: string
          last_used_at?: string | null
          revoked_at?: string | null
          scopes?: string[]
          token_hash: string
          token_prefix: string
        }
        Update: {
          created_at?: string
          created_by?: string
          expires_at?: string | null
          id?: string
          label?: string
          last_used_at?: string | null
          revoked_at?: string | null
          scopes?: string[]
          token_hash?: string
          token_prefix?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_member: { Args: { _user_id: string }; Returns: boolean }
      owner_exists: { Args: never; Returns: boolean }
      redeem_invitation: { Args: { _token: string }; Returns: string }
    }
    Enums: {
      agent_role: "sentinel" | "angeltech" | "demontech"
      agent_status: "active" | "paused" | "revoked"
      app_role: "owner" | "reviewer"
      evidence_class:
        | "verified"
        | "primary_source"
        | "reported"
        | "observed"
        | "hypothesis"
        | "historical"
      issue_category:
        | "animation_snapping"
        | "foot_sliding"
        | "clipping"
        | "collision_mismatch"
        | "horse_chariot"
        | "performance_spike"
        | "multiplayer_desync"
        | "other"
      issue_severity: "blocker" | "critical" | "major" | "minor" | "trivial"
      issue_status:
        | "new"
        | "triaged"
        | "in_progress"
        | "fixed"
        | "verified"
        | "wont_fix"
        | "duplicate"
      knowledge_kind:
        | "observation"
        | "research"
        | "history"
        | "report"
        | "decision"
      task_status:
        | "queued"
        | "acknowledged"
        | "in_progress"
        | "reported"
        | "failed"
        | "cancelled"
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
    Enums: {
      agent_role: ["sentinel", "angeltech", "demontech"],
      agent_status: ["active", "paused", "revoked"],
      app_role: ["owner", "reviewer"],
      evidence_class: [
        "verified",
        "primary_source",
        "reported",
        "observed",
        "hypothesis",
        "historical",
      ],
      issue_category: [
        "animation_snapping",
        "foot_sliding",
        "clipping",
        "collision_mismatch",
        "horse_chariot",
        "performance_spike",
        "multiplayer_desync",
        "other",
      ],
      issue_severity: ["blocker", "critical", "major", "minor", "trivial"],
      issue_status: [
        "new",
        "triaged",
        "in_progress",
        "fixed",
        "verified",
        "wont_fix",
        "duplicate",
      ],
      knowledge_kind: [
        "observation",
        "research",
        "history",
        "report",
        "decision",
      ],
      task_status: [
        "queued",
        "acknowledged",
        "in_progress",
        "reported",
        "failed",
        "cancelled",
      ],
    },
  },
} as const
