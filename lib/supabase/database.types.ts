export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never;
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      graphql: {
        Args: { extensions?: Json; operationName?: string; query?: string; variables?: Json };
        Returns: Json;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
  public: {
    Tables: {
      admin_actions: {
        Row: {
          action: string;
          admin_id: string;
          created_at: string;
          details: NonNullable<Json>;
          id: number;
          market_id: string | null;
          target_user: string | null;
        };
        ComputedFields: never;
        Insert: {
          action: string;
          admin_id: string;
          created_at?: string;
          details?: NonNullable<Json>;
          id?: never;
          market_id?: string | null;
          target_user?: string | null;
        };
        Update: {
          action?: string;
          admin_id?: string;
          created_at?: string;
          details?: NonNullable<Json>;
          id?: never;
          market_id?: string | null;
          target_user?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "admin_actions_admin_id_fkey";
            columns: ["admin_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "admin_actions_market_id_fkey";
            columns: ["market_id"];
            isOneToOne: false;
            referencedRelation: "markets";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "admin_actions_target_user_fkey";
            columns: ["target_user"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      ledger_entries: {
        Row: {
          amount: number;
          created_at: string;
          id: number;
          kind: Database["public"]["Enums"]["ledger_kind"];
          market_id: string | null;
          trade_id: string | null;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          amount: number;
          created_at?: string;
          id?: never;
          kind: Database["public"]["Enums"]["ledger_kind"];
          market_id?: string | null;
          trade_id?: string | null;
          user_id: string;
        };
        Update: {
          amount?: number;
          created_at?: string;
          id?: never;
          kind?: Database["public"]["Enums"]["ledger_kind"];
          market_id?: string | null;
          trade_id?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "ledger_entries_market_id_fkey";
            columns: ["market_id"];
            isOneToOne: false;
            referencedRelation: "markets";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ledger_entries_trade_id_fkey";
            columns: ["trade_id"];
            isOneToOne: false;
            referencedRelation: "trades";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ledger_entries_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      market_exclusions: {
        Row: {
          market_id: string;
          reason: string | null;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          market_id: string;
          reason?: string | null;
          user_id: string;
        };
        Update: {
          market_id?: string;
          reason?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "market_exclusions_market_id_fkey";
            columns: ["market_id"];
            isOneToOne: false;
            referencedRelation: "markets";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "market_exclusions_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      markets: {
        Row: {
          b: number;
          closes_at: string;
          created_at: string;
          created_by: string | null;
          description: string | null;
          id: string;
          opens_at: string;
          resolution_criteria: string;
          resolution_source: string;
          resolved_at: string | null;
          resolved_by: string | null;
          status: Database["public"]["Enums"]["market_status"];
          title: string;
          winning_outcome_id: string | null;
        };
        ComputedFields: never;
        Insert: {
          b: number;
          closes_at: string;
          created_at?: string;
          created_by?: string | null;
          description?: string | null;
          id?: string;
          opens_at?: string;
          resolution_criteria: string;
          resolution_source: string;
          resolved_at?: string | null;
          resolved_by?: string | null;
          status?: Database["public"]["Enums"]["market_status"];
          title: string;
          winning_outcome_id?: string | null;
        };
        Update: {
          b?: number;
          closes_at?: string;
          created_at?: string;
          created_by?: string | null;
          description?: string | null;
          id?: string;
          opens_at?: string;
          resolution_criteria?: string;
          resolution_source?: string;
          resolved_at?: string | null;
          resolved_by?: string | null;
          status?: Database["public"]["Enums"]["market_status"];
          title?: string;
          winning_outcome_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "markets_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "markets_resolved_by_fkey";
            columns: ["resolved_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "markets_winner_fk";
            columns: ["winning_outcome_id"];
            isOneToOne: false;
            referencedRelation: "outcome_prices";
            referencedColumns: ["outcome_id"];
          },
          {
            foreignKeyName: "markets_winner_fk";
            columns: ["winning_outcome_id"];
            isOneToOne: false;
            referencedRelation: "outcomes";
            referencedColumns: ["id"];
          },
        ];
      };
      outcomes: {
        Row: {
          id: string;
          label: string;
          market_id: string;
          q: number;
          sort_order: number;
        };
        ComputedFields: never;
        Insert: {
          id?: string;
          label: string;
          market_id: string;
          q?: number;
          sort_order: number;
        };
        Update: {
          id?: string;
          label?: string;
          market_id?: string;
          q?: number;
          sort_order?: number;
        };
        Relationships: [
          {
            foreignKeyName: "outcomes_market_id_fkey";
            columns: ["market_id"];
            isOneToOne: false;
            referencedRelation: "markets";
            referencedColumns: ["id"];
          },
        ];
      };
      positions: {
        Row: {
          market_id: string;
          net_spent: number;
          outcome_id: string;
          shares: number;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          market_id: string;
          net_spent?: number;
          outcome_id: string;
          shares?: number;
          user_id: string;
        };
        Update: {
          market_id?: string;
          net_spent?: number;
          outcome_id?: string;
          shares?: number;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "positions_market_id_fkey";
            columns: ["market_id"];
            isOneToOne: false;
            referencedRelation: "markets";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "positions_outcome_id_fkey";
            columns: ["outcome_id"];
            isOneToOne: false;
            referencedRelation: "outcome_prices";
            referencedColumns: ["outcome_id"];
          },
          {
            foreignKeyName: "positions_outcome_id_fkey";
            columns: ["outcome_id"];
            isOneToOne: false;
            referencedRelation: "outcomes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "positions_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      profiles: {
        Row: {
          balance: number;
          blocked_reason: string | null;
          created_at: string;
          display_name: string;
          email: string;
          id: string;
          is_blocked: boolean;
          role: Database["public"]["Enums"]["user_role"];
          show_name_in_feed: boolean;
        };
        ComputedFields: never;
        Insert: {
          balance?: number;
          blocked_reason?: string | null;
          created_at?: string;
          display_name: string;
          email: string;
          id: string;
          is_blocked?: boolean;
          role?: Database["public"]["Enums"]["user_role"];
          show_name_in_feed?: boolean;
        };
        Update: {
          balance?: number;
          blocked_reason?: string | null;
          created_at?: string;
          display_name?: string;
          email?: string;
          id?: string;
          is_blocked?: boolean;
          role?: Database["public"]["Enums"]["user_role"];
          show_name_in_feed?: boolean;
        };
        Relationships: [];
      };
      trades: {
        Row: {
          cost: number;
          created_at: string;
          id: string;
          market_id: string;
          outcome_id: string;
          prob_after: number;
          prob_before: number;
          probs_after: number[];
          shares: number;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          cost: number;
          created_at?: string;
          id?: string;
          market_id: string;
          outcome_id: string;
          prob_after: number;
          prob_before: number;
          probs_after: number[];
          shares: number;
          user_id: string;
        };
        Update: {
          cost?: number;
          created_at?: string;
          id?: string;
          market_id?: string;
          outcome_id?: string;
          prob_after?: number;
          prob_before?: number;
          probs_after?: number[];
          shares?: number;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "trades_market_id_fkey";
            columns: ["market_id"];
            isOneToOne: false;
            referencedRelation: "markets";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "trades_outcome_id_fkey";
            columns: ["outcome_id"];
            isOneToOne: false;
            referencedRelation: "outcome_prices";
            referencedColumns: ["outcome_id"];
          },
          {
            foreignKeyName: "trades_outcome_id_fkey";
            columns: ["outcome_id"];
            isOneToOne: false;
            referencedRelation: "outcomes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "trades_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      weekly_topup_runs: {
        Row: {
          iso_week: string;
          ran_at: string;
        };
        ComputedFields: never;
        Insert: {
          iso_week: string;
          ran_at?: string;
        };
        Update: {
          iso_week?: string;
          ran_at?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      outcome_prices: {
        Row: {
          b: number | null;
          label: string | null;
          market_id: string | null;
          outcome_id: string | null;
          prob: number | null;
          q: number | null;
          sort_order: number | null;
        };
        ComputedFields: never;
        Relationships: [
          {
            foreignKeyName: "outcomes_market_id_fkey";
            columns: ["market_id"];
            isOneToOne: false;
            referencedRelation: "markets";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Functions: {
      admin_add_exclusion: {
        Args: { p_market: string; p_reason?: string; p_user: string };
        Returns: undefined;
      };
      admin_adjust_points: {
        Args: { p_amount: number; p_reason: string; p_user: string };
        Returns: undefined;
      };
      admin_list_actions: {
        Args: { p_limit?: number };
        Returns: {
          action: string;
          admin_id: string;
          admin_name: string;
          created_at: string;
          details: Json;
          id: number;
          market_id: string;
          market_title: string;
          target_name: string;
          target_user: string;
        }[];
      };
      admin_list_users: {
        Args: Record<PropertyKey, never>;
        Returns: {
          balance: number;
          blocked_reason: string;
          created_at: string;
          display_name: string;
          email: string;
          is_blocked: boolean;
          last_trade_at: string;
          trade_count: number;
          user_id: string;
        }[];
      };
      admin_remove_exclusion: { Args: { p_market: string; p_user: string }; Returns: undefined };
      admin_set_blocked: {
        Args: { p_blocked: boolean; p_reason?: string; p_user: string };
        Returns: undefined;
      };
      allowed_email_domain: { Args: Record<PropertyKey, never>; Returns: string };
      cancel_market: { Args: { p_market: string }; Returns: undefined };
      check_ledger: {
        Args: Record<PropertyKey, never>;
        Returns: {
          balance: number;
          ledger_sum: number;
          user_id: string;
        }[];
      };
      create_market: {
        Args: {
          p_b: number;
          p_closes_at: string;
          p_criteria: string;
          p_description: string;
          p_open?: boolean;
          p_opens_at: string;
          p_outcomes: string[];
          p_source: string;
          p_title: string;
        };
        Returns: string;
      };
      delete_market: { Args: { p_market: string }; Returns: undefined };
      get_leaderboard: {
        Args: Record<PropertyKey, never>;
        Returns: {
          balance: number;
          display_name: string;
          is_me: boolean;
          open_value: number;
          total: number;
        }[];
      };
      get_leaderboard_this_month: {
        Args: Record<PropertyKey, never>;
        Returns: {
          amount: number;
          display_name: string;
          is_me: boolean;
        }[];
      };
      get_market_stats: {
        Args: { p_market?: string };
        Returns: {
          b: number;
          closes_at: string;
          last_trade_at: string;
          market_id: string;
          market_value: number;
          n_outcomes: number;
          outcomes: Json;
          pot: number;
          spark: number[];
          status: Database["public"]["Enums"]["market_status"];
          trade_count: number;
          trader_count: number;
          volume_24h: number;
          volume_total: number;
        }[];
      };
      get_price_history: {
        Args: { p_market: string };
        Returns: {
          created_at: string;
          probs_after: number[];
        }[];
      };
      get_public_trades: {
        Args: {
          p_before_at?: string;
          p_before_id?: string;
          p_limit?: number;
          p_market?: string;
          p_only_mine?: boolean;
          p_outcome?: string;
          p_side?: string;
        };
        Returns: {
          avg_price: number;
          created_at: string;
          id: string;
          is_me: boolean;
          market_id: string;
          market_title: string;
          outcome_id: string;
          outcome_label: string;
          outcome_sort: number;
          points: number;
          prob_after: number;
          prob_before: number;
          shares: number;
          side: string;
          trader_name: string;
        }[];
      };
      is_admin: { Args: Record<PropertyKey, never>; Returns: boolean };
      is_admin_mfa: { Args: Record<PropertyKey, never>; Returns: boolean };
      lmsr_cost: { Args: { b: number; q: number[] }; Returns: number };
      lmsr_prob: { Args: { b: number; i: number; q: number[] }; Returns: number };
      place_trade: {
        Args: { p_max_cost: number; p_outcome: string; p_shares: number };
        Returns: {
          cost: number;
          created_at: string;
          id: string;
          market_id: string;
          outcome_id: string;
          prob_after: number;
          prob_before: number;
          probs_after: number[];
          shares: number;
          user_id: string;
        };
        SetofOptions: {
          from: "*";
          to: "trades";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      resolve_market: { Args: { p_market: string; p_winner: string }; Returns: undefined };
      run_weekly_topup_if_due: { Args: Record<PropertyKey, never>; Returns: undefined };
      set_market_status: {
        Args: { p_market: string; p_status: Database["public"]["Enums"]["market_status"] };
        Returns: undefined;
      };
      weekly_topup: { Args: Record<PropertyKey, never>; Returns: undefined };
    };
    Enums: {
      ledger_kind: "grant" | "topup" | "trade" | "payout" | "refund" | "adjustment";
      market_status: "draft" | "open" | "closed" | "resolved" | "cancelled";
      user_role: "student" | "admin";
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
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      ledger_kind: ["grant", "topup", "trade", "payout", "refund", "adjustment"],
      market_status: ["draft", "open", "closed", "resolved", "cancelled"],
      user_role: ["student", "admin"],
    },
  },
} as const;
