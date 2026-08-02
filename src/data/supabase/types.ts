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
      accounts: {
        Row: {
          color: string | null
          created_at: string
          currency: string
          current_balance: number
          deleted_at: string | null
          icon: string | null
          id: string
          initial_balance: number
          institution: string | null
          is_default: boolean
          metadata: Json
          name: string
          type: Database["public"]["Enums"]["account_type"]
          updated_at: string
          user_id: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          currency?: string
          current_balance?: number
          deleted_at?: string | null
          icon?: string | null
          id?: string
          initial_balance?: number
          institution?: string | null
          is_default?: boolean
          metadata?: Json
          name: string
          type: Database["public"]["Enums"]["account_type"]
          updated_at?: string
          user_id: string
        }
        Update: {
          color?: string | null
          created_at?: string
          currency?: string
          current_balance?: number
          deleted_at?: string | null
          icon?: string | null
          id?: string
          initial_balance?: number
          institution?: string | null
          is_default?: boolean
          metadata?: Json
          name?: string
          type?: Database["public"]["Enums"]["account_type"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      api_rate_limit_counters: {
        Row: {
          count: number
          key: string
          updated_at: string
          window_start: string
        }
        Insert: {
          count?: number
          key: string
          updated_at?: string
          window_start: string
        }
        Update: {
          count?: number
          key?: string
          updated_at?: string
          window_start?: string
        }
        Relationships: []
      }
      boxes: {
        Row: {
          account_id: string
          created_at: string
          current_balance: number
          deleted_at: string | null
          id: string
          linked_debt_id: string | null
          linked_recurring_id: string | null
          metadata: Json
          name: string
          target_amount: number | null
          target_date: string | null
          type: Database["public"]["Enums"]["box_type"]
          updated_at: string
          user_id: string
        }
        Insert: {
          account_id: string
          created_at?: string
          current_balance?: number
          deleted_at?: string | null
          id?: string
          linked_debt_id?: string | null
          linked_recurring_id?: string | null
          metadata?: Json
          name: string
          target_amount?: number | null
          target_date?: string | null
          type: Database["public"]["Enums"]["box_type"]
          updated_at?: string
          user_id: string
        }
        Update: {
          account_id?: string
          created_at?: string
          current_balance?: number
          deleted_at?: string | null
          id?: string
          linked_debt_id?: string | null
          linked_recurring_id?: string | null
          metadata?: Json
          name?: string
          target_amount?: number | null
          target_date?: string | null
          type?: Database["public"]["Enums"]["box_type"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "boxes_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "boxes_linked_debt_id_fkey"
            columns: ["linked_debt_id"]
            isOneToOne: false
            referencedRelation: "debts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "boxes_linked_recurring_id_fkey"
            columns: ["linked_recurring_id"]
            isOneToOne: false
            referencedRelation: "recurring_rules"
            referencedColumns: ["id"]
          },
        ]
      }
      budget_operation_receipts: {
        Row: {
          budget_id: string | null
          created_at: string
          id: string
          idempotency_key: string
          operation: string
          request_hash: string
          result: Json
          user_id: string
        }
        Insert: {
          budget_id?: string | null
          created_at?: string
          id?: string
          idempotency_key: string
          operation: string
          request_hash: string
          result: Json
          user_id: string
        }
        Update: {
          budget_id?: string | null
          created_at?: string
          id?: string
          idempotency_key?: string
          operation?: string
          request_hash?: string
          result?: Json
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "budget_operation_receipts_budget_id_fkey"
            columns: ["budget_id"]
            isOneToOne: false
            referencedRelation: "budgets"
            referencedColumns: ["id"]
          },
        ]
      }
      budget_progress_snapshots: {
        Row: {
          as_of: string
          budget_id: string
          created_at: string
          id: string
          pct: number
          remaining: number
          spent: number
          user_id: string
        }
        Insert: {
          as_of: string
          budget_id: string
          created_at?: string
          id?: string
          pct: number
          remaining: number
          spent: number
          user_id: string
        }
        Update: {
          as_of?: string
          budget_id?: string
          created_at?: string
          id?: string
          pct?: number
          remaining?: number
          spent?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "budget_progress_snapshots_budget_id_fkey"
            columns: ["budget_id"]
            isOneToOne: false
            referencedRelation: "budgets"
            referencedColumns: ["id"]
          },
        ]
      }
      budget_suggestion_decisions: {
        Row: {
          budget_id: string | null
          category_id: string
          created_at: string
          evidence: Json
          evidence_end: string
          evidence_start: string
          id: string
          idempotency_key: string
          period_kind: Database["public"]["Enums"]["budget_period"]
          proposed_amount: number
          request_hash: string
          resolution: string
          result: Json
          suggestion_key: string
          user_id: string
        }
        Insert: {
          budget_id?: string | null
          category_id: string
          created_at?: string
          evidence: Json
          evidence_end: string
          evidence_start: string
          id?: string
          idempotency_key: string
          period_kind: Database["public"]["Enums"]["budget_period"]
          proposed_amount: number
          request_hash: string
          resolution: string
          result: Json
          suggestion_key: string
          user_id: string
        }
        Update: {
          budget_id?: string | null
          category_id?: string
          created_at?: string
          evidence?: Json
          evidence_end?: string
          evidence_start?: string
          id?: string
          idempotency_key?: string
          period_kind?: Database["public"]["Enums"]["budget_period"]
          proposed_amount?: number
          request_hash?: string
          resolution?: string
          result?: Json
          suggestion_key?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "budget_suggestion_decisions_budget_id_fkey"
            columns: ["budget_id"]
            isOneToOne: false
            referencedRelation: "budgets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "budget_suggestion_decisions_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      budgets: {
        Row: {
          alerted_thresholds: number[]
          amount: number
          auto_renew: boolean
          base_amount: number
          category_id: string | null
          created_at: string
          currency: string
          deleted_at: string | null
          id: string
          kind: Database["public"]["Enums"]["budget_kind"]
          metadata: Json
          period_end: string
          period_kind: Database["public"]["Enums"]["budget_period"]
          period_start: string
          rollover: boolean
          rollover_amount: number
          source: Database["public"]["Enums"]["budget_source"]
          status: Database["public"]["Enums"]["budget_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          alerted_thresholds?: number[]
          amount: number
          auto_renew?: boolean
          base_amount: number
          category_id?: string | null
          created_at?: string
          currency?: string
          deleted_at?: string | null
          id?: string
          kind: Database["public"]["Enums"]["budget_kind"]
          metadata?: Json
          period_end: string
          period_kind: Database["public"]["Enums"]["budget_period"]
          period_start: string
          rollover?: boolean
          rollover_amount?: number
          source?: Database["public"]["Enums"]["budget_source"]
          status?: Database["public"]["Enums"]["budget_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          alerted_thresholds?: number[]
          amount?: number
          auto_renew?: boolean
          base_amount?: number
          category_id?: string | null
          created_at?: string
          currency?: string
          deleted_at?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["budget_kind"]
          metadata?: Json
          period_end?: string
          period_kind?: Database["public"]["Enums"]["budget_period"]
          period_start?: string
          rollover?: boolean
          rollover_amount?: number
          source?: Database["public"]["Enums"]["budget_source"]
          status?: Database["public"]["Enums"]["budget_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "budgets_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      categories: {
        Row: {
          description: string | null
          id: string
          is_sensitive: boolean
          is_system: boolean
          label: string
          sort_order: number
        }
        Insert: {
          description?: string | null
          id: string
          is_sensitive?: boolean
          is_system?: boolean
          label: string
          sort_order: number
        }
        Update: {
          description?: string | null
          id?: string
          is_sensitive?: boolean
          is_system?: boolean
          label?: string
          sort_order?: number
        }
        Relationships: []
      }
      classification_action_receipts: {
        Row: {
          created_at: string
          id: string
          idempotency_key: string
          movement_id: string | null
          operation: string
          request_fingerprint: string
          response: Json
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          idempotency_key: string
          movement_id?: string | null
          operation: string
          request_fingerprint: string
          response: Json
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          idempotency_key?: string
          movement_id?: string | null
          operation?: string
          request_fingerprint?: string
          response?: Json
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "classification_action_receipts_movement_id_fkey"
            columns: ["movement_id"]
            isOneToOne: false
            referencedRelation: "movements"
            referencedColumns: ["id"]
          },
        ]
      }
      classification_batches: {
        Row: {
          created_at: string
          id: string
          idempotency_key: string
          kind: string
          metadata: Json
          movement_changes: Json
          movement_count: number
          source_subcategory_id: string | null
          status: string
          target_category_id: string | null
          target_subcategory_id: string | null
          undo_until: string
          undone_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          idempotency_key: string
          kind: string
          metadata?: Json
          movement_changes: Json
          movement_count: number
          source_subcategory_id?: string | null
          status?: string
          target_category_id?: string | null
          target_subcategory_id?: string | null
          undo_until: string
          undone_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          idempotency_key?: string
          kind?: string
          metadata?: Json
          movement_changes?: Json
          movement_count?: number
          source_subcategory_id?: string | null
          status?: string
          target_category_id?: string | null
          target_subcategory_id?: string | null
          undo_until?: string
          undone_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "classification_batches_source_subcategory_id_fkey"
            columns: ["source_subcategory_id"]
            isOneToOne: false
            referencedRelation: "user_subcategories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "classification_batches_target_category_id_fkey"
            columns: ["target_category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "classification_batches_target_subcategory_id_fkey"
            columns: ["target_subcategory_id"]
            isOneToOne: false
            referencedRelation: "user_subcategories"
            referencedColumns: ["id"]
          },
        ]
      }
      conversation_memory_states: {
        Row: {
          channel: string
          continuity_hint: string | null
          created_at: string
          expires_at: string
          id: string
          last_intent: string | null
          last_query_date_range: Json | null
          last_query_kind: string | null
          last_query_text: string | null
          last_result_summary: string | null
          last_tool_name: string | null
          metadata: Json
          referenced_entities: Json
          referenced_movements: Json
          scope: string
          source_ref: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          channel: string
          continuity_hint?: string | null
          created_at?: string
          expires_at: string
          id?: string
          last_intent?: string | null
          last_query_date_range?: Json | null
          last_query_kind?: string | null
          last_query_text?: string | null
          last_result_summary?: string | null
          last_tool_name?: string | null
          metadata?: Json
          referenced_entities?: Json
          referenced_movements?: Json
          scope?: string
          source_ref?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          channel?: string
          continuity_hint?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          last_intent?: string | null
          last_query_date_range?: Json | null
          last_query_kind?: string | null
          last_query_text?: string | null
          last_result_summary?: string | null
          last_tool_name?: string | null
          metadata?: Json
          referenced_entities?: Json
          referenced_movements?: Json
          scope?: string
          source_ref?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      debt_installments: {
        Row: {
          created_at: string
          debt_id: string
          due_date: string
          expected_amount: number
          id: string
          metadata: Json
          movement_id: string | null
          number: number
          paid_amount: number
          status: Database["public"]["Enums"]["installment_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          debt_id: string
          due_date: string
          expected_amount: number
          id?: string
          metadata?: Json
          movement_id?: string | null
          number: number
          paid_amount?: number
          status?: Database["public"]["Enums"]["installment_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          debt_id?: string
          due_date?: string
          expected_amount?: number
          id?: string
          metadata?: Json
          movement_id?: string | null
          number?: number
          paid_amount?: number
          status?: Database["public"]["Enums"]["installment_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "debt_installments_debt_id_fkey"
            columns: ["debt_id"]
            isOneToOne: false
            referencedRelation: "debts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "debt_installments_movement_id_fkey"
            columns: ["movement_id"]
            isOneToOne: false
            referencedRelation: "movements"
            referencedColumns: ["id"]
          },
        ]
      }
      debt_operation_receipts: {
        Row: {
          created_at: string
          debt_id: string
          id: string
          idempotency_key: string
          installment_id: string | null
          operation: string
          request_hash: string
          result: Json
          user_id: string
        }
        Insert: {
          created_at?: string
          debt_id: string
          id?: string
          idempotency_key: string
          installment_id?: string | null
          operation: string
          request_hash: string
          result: Json
          user_id: string
        }
        Update: {
          created_at?: string
          debt_id?: string
          id?: string
          idempotency_key?: string
          installment_id?: string | null
          operation?: string
          request_hash?: string
          result?: Json
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "debt_operation_receipts_debt_id_fkey"
            columns: ["debt_id"]
            isOneToOne: false
            referencedRelation: "debts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "debt_operation_receipts_installment_id_fkey"
            columns: ["installment_id"]
            isOneToOne: false
            referencedRelation: "debt_installments"
            referencedColumns: ["id"]
          },
        ]
      }
      debt_payment_allocations: {
        Row: {
          allocated_amount: number
          allocation_order: number
          created_at: string
          debt_id: string
          debt_installment_id: string
          debt_payment_id: string
          id: string
          metadata: Json
          movement_id: string
          policy: string
          reversed_at: string | null
          user_id: string
        }
        Insert: {
          allocated_amount: number
          allocation_order: number
          created_at?: string
          debt_id: string
          debt_installment_id: string
          debt_payment_id: string
          id?: string
          metadata?: Json
          movement_id: string
          policy?: string
          reversed_at?: string | null
          user_id: string
        }
        Update: {
          allocated_amount?: number
          allocation_order?: number
          created_at?: string
          debt_id?: string
          debt_installment_id?: string
          debt_payment_id?: string
          id?: string
          metadata?: Json
          movement_id?: string
          policy?: string
          reversed_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "debt_payment_allocations_debt_id_fkey"
            columns: ["debt_id"]
            isOneToOne: false
            referencedRelation: "debts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "debt_payment_allocations_debt_installment_id_fkey"
            columns: ["debt_installment_id"]
            isOneToOne: false
            referencedRelation: "debt_installments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "debt_payment_allocations_debt_payment_id_fkey"
            columns: ["debt_payment_id"]
            isOneToOne: false
            referencedRelation: "debt_payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "debt_payment_allocations_movement_id_fkey"
            columns: ["movement_id"]
            isOneToOne: false
            referencedRelation: "movements"
            referencedColumns: ["id"]
          },
        ]
      }
      debt_payments: {
        Row: {
          amount: number
          created_at: string
          currency: string
          debt_id: string
          id: string
          metadata: Json
          movement_id: string | null
          paid_at: string
          reversal_reason: string | null
          reversed_at: string | null
          source: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          currency?: string
          debt_id: string
          id?: string
          metadata?: Json
          movement_id?: string | null
          paid_at?: string
          reversal_reason?: string | null
          reversed_at?: string | null
          source?: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          currency?: string
          debt_id?: string
          id?: string
          metadata?: Json
          movement_id?: string | null
          paid_at?: string
          reversal_reason?: string | null
          reversed_at?: string | null
          source?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "debt_payments_debt_id_fkey"
            columns: ["debt_id"]
            isOneToOne: false
            referencedRelation: "debts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "debt_payments_movement_id_fkey"
            columns: ["movement_id"]
            isOneToOne: false
            referencedRelation: "movements"
            referencedColumns: ["id"]
          },
        ]
      }
      debts: {
        Row: {
          closed_at: string | null
          confidence: number | null
          created_at: string
          currency: string
          current_balance: number
          deleted_at: string | null
          direction: Database["public"]["Enums"]["debt_direction"]
          due_date: string | null
          id: string
          idempotency_key: string | null
          installment_amount: number | null
          installment_count: number | null
          interest_notes: string | null
          kind: Database["public"]["Enums"]["debt_kind"]
          last_payment_at: string | null
          metadata: Json
          name: string
          next_payment_date: string | null
          opened_at: string
          principal_amount: number
          related_person_id: string | null
          source: string
          status: Database["public"]["Enums"]["debt_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          closed_at?: string | null
          confidence?: number | null
          created_at?: string
          currency?: string
          current_balance: number
          deleted_at?: string | null
          direction: Database["public"]["Enums"]["debt_direction"]
          due_date?: string | null
          id?: string
          idempotency_key?: string | null
          installment_amount?: number | null
          installment_count?: number | null
          interest_notes?: string | null
          kind?: Database["public"]["Enums"]["debt_kind"]
          last_payment_at?: string | null
          metadata?: Json
          name: string
          next_payment_date?: string | null
          opened_at?: string
          principal_amount: number
          related_person_id?: string | null
          source?: string
          status?: Database["public"]["Enums"]["debt_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          closed_at?: string | null
          confidence?: number | null
          created_at?: string
          currency?: string
          current_balance?: number
          deleted_at?: string | null
          direction?: Database["public"]["Enums"]["debt_direction"]
          due_date?: string | null
          id?: string
          idempotency_key?: string | null
          installment_amount?: number | null
          installment_count?: number | null
          interest_notes?: string | null
          kind?: Database["public"]["Enums"]["debt_kind"]
          last_payment_at?: string | null
          metadata?: Json
          name?: string
          next_payment_date?: string | null
          opened_at?: string
          principal_amount?: number
          related_person_id?: string | null
          source?: string
          status?: Database["public"]["Enums"]["debt_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "debts_related_person_id_fkey"
            columns: ["related_person_id"]
            isOneToOne: false
            referencedRelation: "related_persons"
            referencedColumns: ["id"]
          },
        ]
      }
      dedup_decisions: {
        Row: {
          created_at: string
          fingerprint: string
          id: string
          incoming_reference_id: string
          incoming_source: Database["public"]["Enums"]["movement_source"]
          matched_movement_id: string | null
          metadata: Json
          reasons: string[]
          requires_confirmation: boolean
          score: number
          semantic_agent_model: string | null
          semantic_agent_provider: string | null
          semantic_agent_used: boolean
          status: string
          trace_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          fingerprint: string
          id?: string
          incoming_reference_id: string
          incoming_source: Database["public"]["Enums"]["movement_source"]
          matched_movement_id?: string | null
          metadata?: Json
          reasons?: string[]
          requires_confirmation?: boolean
          score?: number
          semantic_agent_model?: string | null
          semantic_agent_provider?: string | null
          semantic_agent_used?: boolean
          status: string
          trace_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          fingerprint?: string
          id?: string
          incoming_reference_id?: string
          incoming_source?: Database["public"]["Enums"]["movement_source"]
          matched_movement_id?: string | null
          metadata?: Json
          reasons?: string[]
          requires_confirmation?: boolean
          score?: number
          semantic_agent_model?: string | null
          semantic_agent_provider?: string | null
          semantic_agent_used?: boolean
          status?: string
          trace_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "dedup_decisions_matched_movement_id_fkey"
            columns: ["matched_movement_id"]
            isOneToOne: false
            referencedRelation: "movements"
            referencedColumns: ["id"]
          },
        ]
      }
      email_connections: {
        Row: {
          created_at: string
          deleted_at: string | null
          email_address: string
          encrypted_refresh_token: string | null
          id: string
          last_history_id: string | null
          last_watch_renewed_at: string | null
          metadata: Json
          provider: string
          provider_account_id: string | null
          scopes: string[]
          status: string
          updated_at: string
          user_id: string
          watch_expiration: string | null
          watch_status: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          email_address: string
          encrypted_refresh_token?: string | null
          id?: string
          last_history_id?: string | null
          last_watch_renewed_at?: string | null
          metadata?: Json
          provider?: string
          provider_account_id?: string | null
          scopes?: string[]
          status?: string
          updated_at?: string
          user_id: string
          watch_expiration?: string | null
          watch_status?: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          email_address?: string
          encrypted_refresh_token?: string | null
          id?: string
          last_history_id?: string | null
          last_watch_renewed_at?: string | null
          metadata?: Json
          provider?: string
          provider_account_id?: string | null
          scopes?: string[]
          status?: string
          updated_at?: string
          user_id?: string
          watch_expiration?: string | null
          watch_status?: string
        }
        Relationships: []
      }
      email_institutions: {
        Row: {
          aliases: string[]
          created_at: string
          default_senders: string[]
          display_name: string
          enabled: boolean
          institution_key: string
          metadata: Json
          sort_order: number
          updated_at: string
        }
        Insert: {
          aliases?: string[]
          created_at?: string
          default_senders?: string[]
          display_name: string
          enabled?: boolean
          institution_key: string
          metadata?: Json
          sort_order?: number
          updated_at?: string
        }
        Update: {
          aliases?: string[]
          created_at?: string
          default_senders?: string[]
          display_name?: string
          enabled?: boolean
          institution_key?: string
          metadata?: Json
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      email_messages: {
        Row: {
          content_hash: string | null
          created_at: string
          email_connection_id: string
          id: string
          metadata: Json
          parsed_status: string
          provider_message_id: string
          provider_thread_id: string | null
          received_at: string
          sender: string | null
          subject_hash: string | null
          user_id: string
        }
        Insert: {
          content_hash?: string | null
          created_at?: string
          email_connection_id: string
          id?: string
          metadata?: Json
          parsed_status: string
          provider_message_id: string
          provider_thread_id?: string | null
          received_at: string
          sender?: string | null
          subject_hash?: string | null
          user_id: string
        }
        Update: {
          content_hash?: string | null
          created_at?: string
          email_connection_id?: string
          id?: string
          metadata?: Json
          parsed_status?: string
          provider_message_id?: string
          provider_thread_id?: string | null
          received_at?: string
          sender?: string | null
          subject_hash?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_messages_email_connection_id_fkey"
            columns: ["email_connection_id"]
            isOneToOne: false
            referencedRelation: "email_connections"
            referencedColumns: ["id"]
          },
        ]
      }
      email_parse_templates: {
        Row: {
          activation_mode: string
          created_at: string
          enabled: boolean
          fallback_count: number
          id: string
          institution_key: string
          last_failure_at: string | null
          last_matched_at: string | null
          last_shadow_at: string | null
          match_count: number
          metadata: Json
          parse_failure_count: number
          parser_config: Json
          priority: number
          provider: string
          sample_hashes: string[]
          sender_pattern: string
          shadow_match_count: number
          template_version: string
          updated_at: string
          verification_status: string
          verified_at: string | null
        }
        Insert: {
          activation_mode?: string
          created_at?: string
          enabled?: boolean
          fallback_count?: number
          id?: string
          institution_key: string
          last_failure_at?: string | null
          last_matched_at?: string | null
          last_shadow_at?: string | null
          match_count?: number
          metadata?: Json
          parse_failure_count?: number
          parser_config?: Json
          priority?: number
          provider?: string
          sample_hashes?: string[]
          sender_pattern: string
          shadow_match_count?: number
          template_version: string
          updated_at?: string
          verification_status?: string
          verified_at?: string | null
        }
        Update: {
          activation_mode?: string
          created_at?: string
          enabled?: boolean
          fallback_count?: number
          id?: string
          institution_key?: string
          last_failure_at?: string | null
          last_matched_at?: string | null
          last_shadow_at?: string | null
          match_count?: number
          metadata?: Json
          parse_failure_count?: number
          parser_config?: Json
          priority?: number
          provider?: string
          sample_hashes?: string[]
          sender_pattern?: string
          shadow_match_count?: number
          template_version?: string
          updated_at?: string
          verification_status?: string
          verified_at?: string | null
        }
        Relationships: []
      }
      experience_preference_events: {
        Row: {
          actor_type: string
          created_at: string
          event_type: string
          id: string
          idempotency_key: string
          next_state: Json
          previous_state: Json
          user_id: string
        }
        Insert: {
          actor_type?: string
          created_at?: string
          event_type?: string
          id?: string
          idempotency_key: string
          next_state?: Json
          previous_state?: Json
          user_id: string
        }
        Update: {
          actor_type?: string
          created_at?: string
          event_type?: string
          id?: string
          idempotency_key?: string
          next_state?: Json
          previous_state?: Json
          user_id?: string
        }
        Relationships: []
      }
      external_event_log: {
        Row: {
          created_at: string
          event_type: string
          id: string
          idempotency_key: string
          metadata: Json
          payload_hash: string
          payload_ref: string | null
          received_at: string
          source: string
          status: string
          trace_id: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          event_type: string
          id?: string
          idempotency_key: string
          metadata?: Json
          payload_hash: string
          payload_ref?: string | null
          received_at?: string
          source: string
          status?: string
          trace_id: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          event_type?: string
          id?: string
          idempotency_key?: string
          metadata?: Json
          payload_hash?: string
          payload_ref?: string | null
          received_at?: string
          source?: string
          status?: string
          trace_id?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      financial_memory_items: {
        Row: {
          canonical_key: string
          confidence: number
          confirmation_status: string
          created_at: string
          evidence_ref: string
          evidence_source: string
          explanation: string | null
          id: string
          kind: string
          last_used_at: string | null
          lifecycle_status: string
          metadata: Json
          negative_evidence_count: number
          negative_evidence_refs: string[]
          positive_evidence_count: number
          positive_evidence_refs: string[]
          review_at: string | null
          revoked_at: string | null
          revoked_reason: string | null
          search_terms: string[]
          sensitive_confirmed_at: string | null
          sensitivity: string
          source_candidate_id: string | null
          summary: string
          superseded_at: string | null
          supersedes_memory_id: string | null
          suspended_at: string | null
          updated_at: string
          user_id: string
          valid_until: string | null
        }
        Insert: {
          canonical_key: string
          confidence: number
          confirmation_status?: string
          created_at?: string
          evidence_ref: string
          evidence_source: string
          explanation?: string | null
          id?: string
          kind: string
          last_used_at?: string | null
          lifecycle_status?: string
          metadata?: Json
          negative_evidence_count?: number
          negative_evidence_refs?: string[]
          positive_evidence_count?: number
          positive_evidence_refs?: string[]
          review_at?: string | null
          revoked_at?: string | null
          revoked_reason?: string | null
          search_terms?: string[]
          sensitive_confirmed_at?: string | null
          sensitivity?: string
          source_candidate_id?: string | null
          summary: string
          superseded_at?: string | null
          supersedes_memory_id?: string | null
          suspended_at?: string | null
          updated_at?: string
          user_id: string
          valid_until?: string | null
        }
        Update: {
          canonical_key?: string
          confidence?: number
          confirmation_status?: string
          created_at?: string
          evidence_ref?: string
          evidence_source?: string
          explanation?: string | null
          id?: string
          kind?: string
          last_used_at?: string | null
          lifecycle_status?: string
          metadata?: Json
          negative_evidence_count?: number
          negative_evidence_refs?: string[]
          positive_evidence_count?: number
          positive_evidence_refs?: string[]
          review_at?: string | null
          revoked_at?: string | null
          revoked_reason?: string | null
          search_terms?: string[]
          sensitive_confirmed_at?: string | null
          sensitivity?: string
          source_candidate_id?: string | null
          summary?: string
          superseded_at?: string | null
          supersedes_memory_id?: string | null
          suspended_at?: string | null
          updated_at?: string
          user_id?: string
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "financial_memory_source_candidate_id_fkey"
            columns: ["source_candidate_id"]
            isOneToOne: false
            referencedRelation: "learning_candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_memory_supersedes_id_fkey"
            columns: ["supersedes_memory_id"]
            isOneToOne: false
            referencedRelation: "financial_memory_items"
            referencedColumns: ["id"]
          },
        ]
      }
      goal_operation_receipts: {
        Row: {
          created_at: string
          goal_id: string | null
          id: string
          idempotency_key: string
          operation: string
          request_hash: string
          result: Json
          user_id: string
        }
        Insert: {
          created_at?: string
          goal_id?: string | null
          id?: string
          idempotency_key: string
          operation: string
          request_hash: string
          result: Json
          user_id: string
        }
        Update: {
          created_at?: string
          goal_id?: string | null
          id?: string
          idempotency_key?: string
          operation?: string
          request_hash?: string
          result?: Json
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "goal_operation_receipts_goal_id_fkey"
            columns: ["goal_id"]
            isOneToOne: false
            referencedRelation: "goals"
            referencedColumns: ["id"]
          },
        ]
      }
      goals: {
        Row: {
          box_id: string | null
          created_at: string
          currency: string
          deleted_at: string | null
          id: string
          metadata: Json
          name: string
          status: Database["public"]["Enums"]["goal_status"]
          target_amount: number
          target_date: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          box_id?: string | null
          created_at?: string
          currency?: string
          deleted_at?: string | null
          id?: string
          metadata?: Json
          name: string
          status?: Database["public"]["Enums"]["goal_status"]
          target_amount: number
          target_date?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          box_id?: string | null
          created_at?: string
          currency?: string
          deleted_at?: string | null
          id?: string
          metadata?: Json
          name?: string
          status?: Database["public"]["Enums"]["goal_status"]
          target_amount?: number
          target_date?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "goals_box_id_fkey"
            columns: ["box_id"]
            isOneToOne: false
            referencedRelation: "boxes"
            referencedColumns: ["id"]
          },
        ]
      }
      insight_action_receipts: {
        Row: {
          created_at: string
          id: string
          idempotency_key: string
          insight_candidate_id: string | null
          operation: string
          request_fingerprint: string
          response: Json
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          idempotency_key: string
          insight_candidate_id?: string | null
          operation: string
          request_fingerprint: string
          response: Json
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          idempotency_key?: string
          insight_candidate_id?: string | null
          operation?: string
          request_fingerprint?: string
          response?: Json
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "insight_action_receipts_insight_candidate_id_fkey"
            columns: ["insight_candidate_id"]
            isOneToOne: false
            referencedRelation: "insight_candidates"
            referencedColumns: ["id"]
          },
        ]
      }
      insight_candidates: {
        Row: {
          action: Json | null
          body: string
          confidence: number
          created_at: string
          displayed_at: string | null
          evidence: Json
          evidence_text: string
          expires_at: string | null
          feedback: Database["public"]["Enums"]["insight_feedback"] | null
          feedback_at: string | null
          fingerprint: string
          id: string
          metadata: Json
          narrated_at: string | null
          outdated_at: string | null
          period_end: string
          period_start: string
          quality_score: number
          rank_score: number
          risk_level: Database["public"]["Enums"]["risk_level"]
          source_entity_ids: string[]
          source_facts: Json
          status: Database["public"]["Enums"]["insight_status"]
          title: string
          type: Database["public"]["Enums"]["insight_type"]
          updated_at: string
          user_id: string
        }
        Insert: {
          action?: Json | null
          body: string
          confidence: number
          created_at?: string
          displayed_at?: string | null
          evidence?: Json
          evidence_text: string
          expires_at?: string | null
          feedback?: Database["public"]["Enums"]["insight_feedback"] | null
          feedback_at?: string | null
          fingerprint: string
          id?: string
          metadata?: Json
          narrated_at?: string | null
          outdated_at?: string | null
          period_end: string
          period_start: string
          quality_score: number
          rank_score: number
          risk_level?: Database["public"]["Enums"]["risk_level"]
          source_entity_ids?: string[]
          source_facts?: Json
          status?: Database["public"]["Enums"]["insight_status"]
          title: string
          type: Database["public"]["Enums"]["insight_type"]
          updated_at?: string
          user_id: string
        }
        Update: {
          action?: Json | null
          body?: string
          confidence?: number
          created_at?: string
          displayed_at?: string | null
          evidence?: Json
          evidence_text?: string
          expires_at?: string | null
          feedback?: Database["public"]["Enums"]["insight_feedback"] | null
          feedback_at?: string | null
          fingerprint?: string
          id?: string
          metadata?: Json
          narrated_at?: string | null
          outdated_at?: string | null
          period_end?: string
          period_start?: string
          quality_score?: number
          rank_score?: number
          risk_level?: Database["public"]["Enums"]["risk_level"]
          source_entity_ids?: string[]
          source_facts?: Json
          status?: Database["public"]["Enums"]["insight_status"]
          title?: string
          type?: Database["public"]["Enums"]["insight_type"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      insight_deliveries: {
        Row: {
          channel: string
          created_at: string
          delivered_at: string | null
          id: string
          insight_candidate_id: string | null
          metadata: Json
          seen_at: string | null
          status: string
          user_id: string
        }
        Insert: {
          channel: string
          created_at?: string
          delivered_at?: string | null
          id?: string
          insight_candidate_id?: string | null
          metadata?: Json
          seen_at?: string | null
          status: string
          user_id: string
        }
        Update: {
          channel?: string
          created_at?: string
          delivered_at?: string | null
          id?: string
          insight_candidate_id?: string | null
          metadata?: Json
          seen_at?: string | null
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "insight_deliveries_insight_candidate_id_fkey"
            columns: ["insight_candidate_id"]
            isOneToOne: false
            referencedRelation: "insight_candidates"
            referencedColumns: ["id"]
          },
        ]
      }
      insight_feedback_events: {
        Row: {
          created_at: string
          id: string
          idempotency_key: string
          insight_candidate_id: string
          insight_type: Database["public"]["Enums"]["insight_type"]
          metadata: Json
          user_id: string
          value: Database["public"]["Enums"]["insight_feedback"]
        }
        Insert: {
          created_at?: string
          id?: string
          idempotency_key: string
          insight_candidate_id: string
          insight_type: Database["public"]["Enums"]["insight_type"]
          metadata?: Json
          user_id: string
          value: Database["public"]["Enums"]["insight_feedback"]
        }
        Update: {
          created_at?: string
          id?: string
          idempotency_key?: string
          insight_candidate_id?: string
          insight_type?: Database["public"]["Enums"]["insight_type"]
          metadata?: Json
          user_id?: string
          value?: Database["public"]["Enums"]["insight_feedback"]
        }
        Relationships: [
          {
            foreignKeyName: "insight_feedback_events_insight_candidate_id_fkey"
            columns: ["insight_candidate_id"]
            isOneToOne: false
            referencedRelation: "insight_candidates"
            referencedColumns: ["id"]
          },
        ]
      }
      insight_type_preferences: {
        Row: {
          insight_type: Database["public"]["Enums"]["insight_type"]
          last_idempotency_key: string
          metadata: Json
          muted: boolean
          muted_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          insight_type: Database["public"]["Enums"]["insight_type"]
          last_idempotency_key: string
          metadata?: Json
          muted?: boolean
          muted_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          insight_type?: Database["public"]["Enums"]["insight_type"]
          last_idempotency_key?: string
          metadata?: Json
          muted?: boolean
          muted_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      internal_event_log: {
        Row: {
          attempt_count: number
          consumer_name: string
          created_at: string
          event_type: string
          id: string
          last_error: string | null
          metadata: Json
          outbox_id: string
          processed_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          attempt_count?: number
          consumer_name: string
          created_at?: string
          event_type: string
          id?: string
          last_error?: string | null
          metadata?: Json
          outbox_id: string
          processed_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          attempt_count?: number
          consumer_name?: string
          created_at?: string
          event_type?: string
          id?: string
          last_error?: string | null
          metadata?: Json
          outbox_id?: string
          processed_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "internal_event_log_outbox_id_fkey"
            columns: ["outbox_id"]
            isOneToOne: false
            referencedRelation: "transactional_outbox"
            referencedColumns: ["id"]
          },
        ]
      }
      learned_preferences: {
        Row: {
          created_at: string
          id: string
          key: string
          last_observed_at: string
          metadata: Json
          negative_evidence_count: number
          negative_evidence_refs: string[]
          observation_count: number
          positive_evidence_count: number
          positive_evidence_refs: string[]
          source_module: string
          status: string
          supersedes_preference_id: string | null
          updated_at: string
          user_id: string
          value: Json
        }
        Insert: {
          created_at?: string
          id?: string
          key: string
          last_observed_at?: string
          metadata?: Json
          negative_evidence_count?: number
          negative_evidence_refs?: string[]
          observation_count?: number
          positive_evidence_count?: number
          positive_evidence_refs?: string[]
          source_module: string
          status?: string
          supersedes_preference_id?: string | null
          updated_at?: string
          user_id: string
          value: Json
        }
        Update: {
          created_at?: string
          id?: string
          key?: string
          last_observed_at?: string
          metadata?: Json
          negative_evidence_count?: number
          negative_evidence_refs?: string[]
          observation_count?: number
          positive_evidence_count?: number
          positive_evidence_refs?: string[]
          source_module?: string
          status?: string
          supersedes_preference_id?: string | null
          updated_at?: string
          user_id?: string
          value?: Json
        }
        Relationships: [
          {
            foreignKeyName: "learned_preferences_supersedes_preference_id_fkey"
            columns: ["supersedes_preference_id"]
            isOneToOne: false
            referencedRelation: "learned_preferences"
            referencedColumns: ["id"]
          },
        ]
      }
      learning_candidates: {
        Row: {
          basis: string
          canonical_key: string
          confidence: number
          created_at: string
          decided_at: string | null
          decision_reason: string | null
          evidence_count: number
          evidence_refs: string[]
          evidence_sources: string[]
          id: string
          kind: string
          last_conflict_at: string | null
          last_evidence_at: string | null
          metadata: Json
          negative_evidence_count: number
          negative_evidence_refs: string[]
          negative_evidence_weight: number
          positive_evidence_count: number
          positive_evidence_refs: string[]
          positive_evidence_weight: number
          promoted_memory_id: string | null
          proposal_summary: string
          requires_user_confirmation: boolean
          review_at: string | null
          search_terms: string[]
          sensitivity: string
          status: string
          updated_at: string
          user_id: string
          valid_until: string | null
        }
        Insert: {
          basis: string
          canonical_key: string
          confidence: number
          created_at?: string
          decided_at?: string | null
          decision_reason?: string | null
          evidence_count?: number
          evidence_refs?: string[]
          evidence_sources?: string[]
          id?: string
          kind: string
          last_conflict_at?: string | null
          last_evidence_at?: string | null
          metadata?: Json
          negative_evidence_count?: number
          negative_evidence_refs?: string[]
          negative_evidence_weight?: number
          positive_evidence_count?: number
          positive_evidence_refs?: string[]
          positive_evidence_weight?: number
          promoted_memory_id?: string | null
          proposal_summary: string
          requires_user_confirmation?: boolean
          review_at?: string | null
          search_terms?: string[]
          sensitivity?: string
          status?: string
          updated_at?: string
          user_id: string
          valid_until?: string | null
        }
        Update: {
          basis?: string
          canonical_key?: string
          confidence?: number
          created_at?: string
          decided_at?: string | null
          decision_reason?: string | null
          evidence_count?: number
          evidence_refs?: string[]
          evidence_sources?: string[]
          id?: string
          kind?: string
          last_conflict_at?: string | null
          last_evidence_at?: string | null
          metadata?: Json
          negative_evidence_count?: number
          negative_evidence_refs?: string[]
          negative_evidence_weight?: number
          positive_evidence_count?: number
          positive_evidence_refs?: string[]
          positive_evidence_weight?: number
          promoted_memory_id?: string | null
          proposal_summary?: string
          requires_user_confirmation?: boolean
          review_at?: string | null
          search_terms?: string[]
          sensitivity?: string
          status?: string
          updated_at?: string
          user_id?: string
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "learning_candidates_promoted_memory_id_fkey"
            columns: ["promoted_memory_id"]
            isOneToOne: false
            referencedRelation: "financial_memory_items"
            referencedColumns: ["id"]
          },
        ]
      }
      learning_evidence: {
        Row: {
          candidate_id: string | null
          claim_value: Json | null
          created_at: string
          evidence_ref: string
          id: string
          memory_id: string | null
          metadata: Json
          observed_at: string
          polarity: string
          sensitivity: string
          source_entity_id: string | null
          source_entity_type: string | null
          source_type: string
          user_id: string
          weight: number
        }
        Insert: {
          candidate_id?: string | null
          claim_value?: Json | null
          created_at?: string
          evidence_ref: string
          id?: string
          memory_id?: string | null
          metadata?: Json
          observed_at: string
          polarity: string
          sensitivity?: string
          source_entity_id?: string | null
          source_entity_type?: string | null
          source_type: string
          user_id: string
          weight: number
        }
        Update: {
          candidate_id?: string | null
          claim_value?: Json | null
          created_at?: string
          evidence_ref?: string
          id?: string
          memory_id?: string | null
          metadata?: Json
          observed_at?: string
          polarity?: string
          sensitivity?: string
          source_entity_id?: string | null
          source_entity_type?: string | null
          source_type?: string
          user_id?: string
          weight?: number
        }
        Relationships: [
          {
            foreignKeyName: "learning_evidence_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "learning_candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "learning_evidence_memory_id_fkey"
            columns: ["memory_id"]
            isOneToOne: false
            referencedRelation: "financial_memory_items"
            referencedColumns: ["id"]
          },
        ]
      }
      learning_memory_events: {
        Row: {
          actor_type: string
          candidate_id: string | null
          created_at: string
          event_type: string
          id: string
          idempotency_key: string
          memory_id: string | null
          metadata: Json
          next_state: Json | null
          previous_state: Json | null
          reason: string
          source_ref: string | null
          user_id: string
        }
        Insert: {
          actor_type: string
          candidate_id?: string | null
          created_at?: string
          event_type: string
          id?: string
          idempotency_key: string
          memory_id?: string | null
          metadata?: Json
          next_state?: Json | null
          previous_state?: Json | null
          reason: string
          source_ref?: string | null
          user_id: string
        }
        Update: {
          actor_type?: string
          candidate_id?: string | null
          created_at?: string
          event_type?: string
          id?: string
          idempotency_key?: string
          memory_id?: string | null
          metadata?: Json
          next_state?: Json | null
          previous_state?: Json | null
          reason?: string
          source_ref?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "learning_memory_events_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "learning_candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "learning_memory_events_memory_id_fkey"
            columns: ["memory_id"]
            isOneToOne: false
            referencedRelation: "financial_memory_items"
            referencedColumns: ["id"]
          },
        ]
      }
      learning_preferences: {
        Row: {
          allow_narrative_memory: boolean
          allow_sensitive_memory: boolean
          consent_version: string
          created_at: string
          enabled: boolean
          metadata: Json
          updated_at: string
          updated_by: string
          user_id: string
        }
        Insert: {
          allow_narrative_memory?: boolean
          allow_sensitive_memory?: boolean
          consent_version?: string
          created_at?: string
          enabled?: boolean
          metadata?: Json
          updated_at?: string
          updated_by?: string
          user_id: string
        }
        Update: {
          allow_narrative_memory?: boolean
          allow_sensitive_memory?: boolean
          consent_version?: string
          created_at?: string
          enabled?: boolean
          metadata?: Json
          updated_at?: string
          updated_by?: string
          user_id?: string
        }
        Relationships: []
      }
      memory_events: {
        Row: {
          action: string
          actor: string
          created_at: string
          id: string
          idempotency_key: string | null
          metadata: Json
          next: Json | null
          previous: Json | null
          scope: Database["public"]["Enums"]["memory_scope"]
          subject_id: string
          subject_key: string
          user_id: string
        }
        Insert: {
          action: string
          actor: string
          created_at?: string
          id?: string
          idempotency_key?: string | null
          metadata?: Json
          next?: Json | null
          previous?: Json | null
          scope: Database["public"]["Enums"]["memory_scope"]
          subject_id: string
          subject_key: string
          user_id: string
        }
        Update: {
          action?: string
          actor?: string
          created_at?: string
          id?: string
          idempotency_key?: string | null
          metadata?: Json
          next?: Json | null
          previous?: Json | null
          scope?: Database["public"]["Enums"]["memory_scope"]
          subject_id?: string
          subject_key?: string
          user_id?: string
        }
        Relationships: []
      }
      memory_operation_receipts: {
        Row: {
          created_at: string
          id: string
          idempotency_key: string
          request_fingerprint: string
          response: Json
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          idempotency_key: string
          request_fingerprint: string
          response: Json
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          idempotency_key?: string
          request_fingerprint?: string
          response?: Json
          user_id?: string
        }
        Relationships: []
      }
      memory_tombstones: {
        Row: {
          created_at: string
          id: string
          lifted_at: string | null
          lifted_by: string | null
          metadata: Json
          reason: string | null
          scope: Database["public"]["Enums"]["memory_scope"]
          subject_key: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          lifted_at?: string | null
          lifted_by?: string | null
          metadata?: Json
          reason?: string | null
          scope: Database["public"]["Enums"]["memory_scope"]
          subject_key: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          lifted_at?: string | null
          lifted_by?: string | null
          metadata?: Json
          reason?: string | null
          scope?: Database["public"]["Enums"]["memory_scope"]
          subject_key?: string
          user_id?: string
        }
        Relationships: []
      }
      movement_audit_log: {
        Row: {
          action: string
          actor_id: string | null
          actor_type: string
          created_at: string
          entity_id: string
          entity_type: string
          field_name: string | null
          id: string
          metadata: Json
          movement_id: string | null
          new_value: Json | null
          old_value: Json | null
          source: string
          trace_id: string | null
          user_id: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          actor_type: string
          created_at?: string
          entity_id: string
          entity_type: string
          field_name?: string | null
          id?: string
          metadata?: Json
          movement_id?: string | null
          new_value?: Json | null
          old_value?: Json | null
          source: string
          trace_id?: string | null
          user_id: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          actor_type?: string
          created_at?: string
          entity_id?: string
          entity_type?: string
          field_name?: string | null
          id?: string
          metadata?: Json
          movement_id?: string | null
          new_value?: Json | null
          old_value?: Json | null
          source?: string
          trace_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "movement_audit_log_movement_id_fkey"
            columns: ["movement_id"]
            isOneToOne: false
            referencedRelation: "movements"
            referencedColumns: ["id"]
          },
        ]
      }
      movement_tags: {
        Row: {
          confidence: number | null
          created_at: string
          metadata: Json
          movement_id: string
          source: string
          tag_id: string
        }
        Insert: {
          confidence?: number | null
          created_at?: string
          metadata?: Json
          movement_id: string
          source: string
          tag_id: string
        }
        Update: {
          confidence?: number | null
          created_at?: string
          metadata?: Json
          movement_id?: string
          source?: string
          tag_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "movement_tags_movement_id_fkey"
            columns: ["movement_id"]
            isOneToOne: false
            referencedRelation: "movements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "movement_tags_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "tags"
            referencedColumns: ["id"]
          },
        ]
      }
      movement_templates: {
        Row: {
          account_id: string | null
          amount: number | null
          box_id: string | null
          category_id: string | null
          created_at: string
          deleted_at: string | null
          description: string | null
          id: string
          last_used_at: string | null
          merchant: string | null
          metadata: Json
          name: string
          origin: Database["public"]["Enums"]["template_origin"]
          subcategory_id: string | null
          type: Database["public"]["Enums"]["movement_type"]
          updated_at: string
          use_count: number
          user_id: string
        }
        Insert: {
          account_id?: string | null
          amount?: number | null
          box_id?: string | null
          category_id?: string | null
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          id?: string
          last_used_at?: string | null
          merchant?: string | null
          metadata?: Json
          name: string
          origin?: Database["public"]["Enums"]["template_origin"]
          subcategory_id?: string | null
          type: Database["public"]["Enums"]["movement_type"]
          updated_at?: string
          use_count?: number
          user_id: string
        }
        Update: {
          account_id?: string | null
          amount?: number | null
          box_id?: string | null
          category_id?: string | null
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          id?: string
          last_used_at?: string | null
          merchant?: string | null
          metadata?: Json
          name?: string
          origin?: Database["public"]["Enums"]["template_origin"]
          subcategory_id?: string | null
          type?: Database["public"]["Enums"]["movement_type"]
          updated_at?: string
          use_count?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "movement_templates_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "movement_templates_box_id_fkey"
            columns: ["box_id"]
            isOneToOne: false
            referencedRelation: "boxes"
            referencedColumns: ["id"]
          },
        ]
      }
      movements: {
        Row: {
          account_destination_id: string | null
          account_origin_id: string | null
          affects_account_balance: boolean
          affects_total_balance: boolean
          amount: number
          box_destination_id: string | null
          box_origin_id: string | null
          category_id: string | null
          confidence: number | null
          created_at: string
          currency: string
          debt_id: string | null
          deleted_at: string | null
          description: string | null
          id: string
          idempotency_key: string
          merchant: string | null
          metadata: Json
          occurred_at: string
          recurring_occurrence_id: string | null
          recurring_rule_id: string | null
          related_person_id: string | null
          requires_review: boolean
          search_vector: unknown
          source: Database["public"]["Enums"]["movement_source"]
          source_ref: string | null
          status: Database["public"]["Enums"]["movement_status"]
          subcategory_id: string | null
          type: Database["public"]["Enums"]["movement_type"]
          updated_at: string
          user_id: string
        }
        Insert: {
          account_destination_id?: string | null
          account_origin_id?: string | null
          affects_account_balance?: boolean
          affects_total_balance?: boolean
          amount: number
          box_destination_id?: string | null
          box_origin_id?: string | null
          category_id?: string | null
          confidence?: number | null
          created_at?: string
          currency?: string
          debt_id?: string | null
          deleted_at?: string | null
          description?: string | null
          id?: string
          idempotency_key: string
          merchant?: string | null
          metadata?: Json
          occurred_at: string
          recurring_occurrence_id?: string | null
          recurring_rule_id?: string | null
          related_person_id?: string | null
          requires_review?: boolean
          search_vector?: unknown
          source: Database["public"]["Enums"]["movement_source"]
          source_ref?: string | null
          status?: Database["public"]["Enums"]["movement_status"]
          subcategory_id?: string | null
          type: Database["public"]["Enums"]["movement_type"]
          updated_at?: string
          user_id: string
        }
        Update: {
          account_destination_id?: string | null
          account_origin_id?: string | null
          affects_account_balance?: boolean
          affects_total_balance?: boolean
          amount?: number
          box_destination_id?: string | null
          box_origin_id?: string | null
          category_id?: string | null
          confidence?: number | null
          created_at?: string
          currency?: string
          debt_id?: string | null
          deleted_at?: string | null
          description?: string | null
          id?: string
          idempotency_key?: string
          merchant?: string | null
          metadata?: Json
          occurred_at?: string
          recurring_occurrence_id?: string | null
          recurring_rule_id?: string | null
          related_person_id?: string | null
          requires_review?: boolean
          search_vector?: unknown
          source?: Database["public"]["Enums"]["movement_source"]
          source_ref?: string | null
          status?: Database["public"]["Enums"]["movement_status"]
          subcategory_id?: string | null
          type?: Database["public"]["Enums"]["movement_type"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "movements_account_destination_id_fkey"
            columns: ["account_destination_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "movements_account_origin_id_fkey"
            columns: ["account_origin_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "movements_box_destination_id_fkey"
            columns: ["box_destination_id"]
            isOneToOne: false
            referencedRelation: "boxes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "movements_box_origin_id_fkey"
            columns: ["box_origin_id"]
            isOneToOne: false
            referencedRelation: "boxes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "movements_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "movements_debt_id_fkey"
            columns: ["debt_id"]
            isOneToOne: false
            referencedRelation: "debts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "movements_recurring_occurrence_id_fkey"
            columns: ["recurring_occurrence_id"]
            isOneToOne: false
            referencedRelation: "recurring_occurrences"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "movements_recurring_rule_id_fkey"
            columns: ["recurring_rule_id"]
            isOneToOne: false
            referencedRelation: "recurring_rules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "movements_subcategory_id_fkey"
            columns: ["subcategory_id"]
            isOneToOne: false
            referencedRelation: "user_subcategories"
            referencedColumns: ["id"]
          },
        ]
      }
      nudge_candidates: {
        Row: {
          created_at: string
          id: string
          metadata: Json
          priority: number
          risk_level: Database["public"]["Enums"]["risk_level"]
          scheduled_for: string | null
          source_entity_id: string
          source_entity_type: string
          status: Database["public"]["Enums"]["nudge_status"]
          type: Database["public"]["Enums"]["nudge_type"]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          metadata?: Json
          priority: number
          risk_level?: Database["public"]["Enums"]["risk_level"]
          scheduled_for?: string | null
          source_entity_id: string
          source_entity_type: string
          status?: Database["public"]["Enums"]["nudge_status"]
          type: Database["public"]["Enums"]["nudge_type"]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          metadata?: Json
          priority?: number
          risk_level?: Database["public"]["Enums"]["risk_level"]
          scheduled_for?: string | null
          source_entity_id?: string
          source_entity_type?: string
          status?: Database["public"]["Enums"]["nudge_status"]
          type?: Database["public"]["Enums"]["nudge_type"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      nudge_deliveries: {
        Row: {
          channel: string
          created_at: string
          delivered_at: string | null
          id: string
          metadata: Json
          nudge_candidate_id: string | null
          responded_at: string | null
          response_summary: string | null
          sent_at: string | null
          status: Database["public"]["Enums"]["nudge_status"]
          user_id: string
        }
        Insert: {
          channel: string
          created_at?: string
          delivered_at?: string | null
          id?: string
          metadata?: Json
          nudge_candidate_id?: string | null
          responded_at?: string | null
          response_summary?: string | null
          sent_at?: string | null
          status: Database["public"]["Enums"]["nudge_status"]
          user_id: string
        }
        Update: {
          channel?: string
          created_at?: string
          delivered_at?: string | null
          id?: string
          metadata?: Json
          nudge_candidate_id?: string | null
          responded_at?: string | null
          response_summary?: string | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["nudge_status"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "nudge_deliveries_nudge_candidate_id_fkey"
            columns: ["nudge_candidate_id"]
            isOneToOne: false
            referencedRelation: "nudge_candidates"
            referencedColumns: ["id"]
          },
        ]
      }
      nudge_preferences: {
        Row: {
          channel: string
          created_at: string
          enabled: boolean
          id: string
          metadata: Json
          nudge_type: Database["public"]["Enums"]["nudge_type"]
          paused_until: string | null
          quiet_hours_override: Json | null
          updated_at: string
          user_id: string
        }
        Insert: {
          channel?: string
          created_at?: string
          enabled?: boolean
          id?: string
          metadata?: Json
          nudge_type: Database["public"]["Enums"]["nudge_type"]
          paused_until?: string | null
          quiet_hours_override?: Json | null
          updated_at?: string
          user_id: string
        }
        Update: {
          channel?: string
          created_at?: string
          enabled?: boolean
          id?: string
          metadata?: Json
          nudge_type?: Database["public"]["Enums"]["nudge_type"]
          paused_until?: string | null
          quiet_hours_override?: Json | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      pending_items: {
        Row: {
          confirm_command: Json | null
          confirmable: boolean
          created_at: string
          dedup_status: string | null
          expires_at: string | null
          id: string
          metadata: Json
          normalized_summary: Json
          proposed_action: Json
          resolved_at: string | null
          resolved_by: string | null
          risk_level: Database["public"]["Enums"]["risk_level"]
          sent_for_confirmation_at: string | null
          source: Database["public"]["Enums"]["pending_source"]
          source_ref: string | null
          status: Database["public"]["Enums"]["pending_status"]
          type: Database["public"]["Enums"]["pending_type"]
          updated_at: string
          user_id: string
        }
        Insert: {
          confirm_command?: Json | null
          confirmable?: boolean
          created_at?: string
          dedup_status?: string | null
          expires_at?: string | null
          id?: string
          metadata?: Json
          normalized_summary?: Json
          proposed_action: Json
          resolved_at?: string | null
          resolved_by?: string | null
          risk_level?: Database["public"]["Enums"]["risk_level"]
          sent_for_confirmation_at?: string | null
          source: Database["public"]["Enums"]["pending_source"]
          source_ref?: string | null
          status?: Database["public"]["Enums"]["pending_status"]
          type: Database["public"]["Enums"]["pending_type"]
          updated_at?: string
          user_id: string
        }
        Update: {
          confirm_command?: Json | null
          confirmable?: boolean
          created_at?: string
          dedup_status?: string | null
          expires_at?: string | null
          id?: string
          metadata?: Json
          normalized_summary?: Json
          proposed_action?: Json
          resolved_at?: string | null
          resolved_by?: string | null
          risk_level?: Database["public"]["Enums"]["risk_level"]
          sent_for_confirmation_at?: string | null
          source?: Database["public"]["Enums"]["pending_source"]
          source_ref?: string | null
          status?: Database["public"]["Enums"]["pending_status"]
          type?: Database["public"]["Enums"]["pending_type"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          default_currency: string
          display_name: string | null
          id: string
          locale: string
          onboarding_status: Database["public"]["Enums"]["onboarding_status"]
          phone_e164: string | null
          timezone: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          default_currency?: string
          display_name?: string | null
          id: string
          locale?: string
          onboarding_status?: Database["public"]["Enums"]["onboarding_status"]
          phone_e164?: string | null
          timezone?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          default_currency?: string
          display_name?: string | null
          id?: string
          locale?: string
          onboarding_status?: Database["public"]["Enums"]["onboarding_status"]
          phone_e164?: string | null
          timezone?: string
          updated_at?: string
        }
        Relationships: []
      }
      recurring_candidates: {
        Row: {
          category_id: string | null
          confidence: number
          created_at: string
          evidence: Json
          id: string
          merchant_key: string
          metadata: Json
          status: Database["public"]["Enums"]["recurring_candidate_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          category_id?: string | null
          confidence: number
          created_at?: string
          evidence?: Json
          id?: string
          merchant_key: string
          metadata?: Json
          status?: Database["public"]["Enums"]["recurring_candidate_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          category_id?: string | null
          confidence?: number
          created_at?: string
          evidence?: Json
          id?: string
          merchant_key?: string
          metadata?: Json
          status?: Database["public"]["Enums"]["recurring_candidate_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "recurring_candidates_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      recurring_occurrences: {
        Row: {
          created_at: string
          expected_amount: number | null
          expected_date: string
          id: string
          metadata: Json
          paid_at: string | null
          paid_movement_id: string | null
          recurring_rule_id: string
          status: Database["public"]["Enums"]["recurring_occurrence_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          expected_amount?: number | null
          expected_date: string
          id?: string
          metadata?: Json
          paid_at?: string | null
          paid_movement_id?: string | null
          recurring_rule_id: string
          status?: Database["public"]["Enums"]["recurring_occurrence_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          expected_amount?: number | null
          expected_date?: string
          id?: string
          metadata?: Json
          paid_at?: string | null
          paid_movement_id?: string | null
          recurring_rule_id?: string
          status?: Database["public"]["Enums"]["recurring_occurrence_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "recurring_occurrences_paid_movement_id_fkey"
            columns: ["paid_movement_id"]
            isOneToOne: false
            referencedRelation: "movements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recurring_occurrences_recurring_rule_id_fkey"
            columns: ["recurring_rule_id"]
            isOneToOne: false
            referencedRelation: "recurring_rules"
            referencedColumns: ["id"]
          },
        ]
      }
      recurring_rules: {
        Row: {
          amount_variability: string
          cancelled_at: string | null
          category_id: string | null
          confidence: number | null
          created_at: string
          creation_idempotency_key: string | null
          creation_request_hash: string | null
          currency: string
          date_window_end_day: number | null
          date_window_start_day: number | null
          day_of_month: number | null
          default_account_id: string | null
          deleted_at: string | null
          expected_amount: number | null
          frequency: string
          id: string
          last_paid_amount: number | null
          last_paid_at: string | null
          linked_box_id: string | null
          linked_debt_id: string | null
          merchant_pattern: string | null
          metadata: Json
          name: string
          next_expected_date: string | null
          requires_confirmation_for_payment: boolean
          source: string
          status: Database["public"]["Enums"]["recurring_status"]
          subcategory_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          amount_variability?: string
          cancelled_at?: string | null
          category_id?: string | null
          confidence?: number | null
          created_at?: string
          creation_idempotency_key?: string | null
          creation_request_hash?: string | null
          currency?: string
          date_window_end_day?: number | null
          date_window_start_day?: number | null
          day_of_month?: number | null
          default_account_id?: string | null
          deleted_at?: string | null
          expected_amount?: number | null
          frequency?: string
          id?: string
          last_paid_amount?: number | null
          last_paid_at?: string | null
          linked_box_id?: string | null
          linked_debt_id?: string | null
          merchant_pattern?: string | null
          metadata?: Json
          name: string
          next_expected_date?: string | null
          requires_confirmation_for_payment?: boolean
          source?: string
          status?: Database["public"]["Enums"]["recurring_status"]
          subcategory_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          amount_variability?: string
          cancelled_at?: string | null
          category_id?: string | null
          confidence?: number | null
          created_at?: string
          creation_idempotency_key?: string | null
          creation_request_hash?: string | null
          currency?: string
          date_window_end_day?: number | null
          date_window_start_day?: number | null
          day_of_month?: number | null
          default_account_id?: string | null
          deleted_at?: string | null
          expected_amount?: number | null
          frequency?: string
          id?: string
          last_paid_amount?: number | null
          last_paid_at?: string | null
          linked_box_id?: string | null
          linked_debt_id?: string | null
          merchant_pattern?: string | null
          metadata?: Json
          name?: string
          next_expected_date?: string | null
          requires_confirmation_for_payment?: boolean
          source?: string
          status?: Database["public"]["Enums"]["recurring_status"]
          subcategory_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "recurring_rules_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recurring_rules_default_account_id_fkey"
            columns: ["default_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recurring_rules_linked_box_id_fkey"
            columns: ["linked_box_id"]
            isOneToOne: false
            referencedRelation: "boxes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recurring_rules_linked_debt_id_fkey"
            columns: ["linked_debt_id"]
            isOneToOne: false
            referencedRelation: "debts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recurring_rules_subcategory_id_fkey"
            columns: ["subcategory_id"]
            isOneToOne: false
            referencedRelation: "user_subcategories"
            referencedColumns: ["id"]
          },
        ]
      }
      related_persons: {
        Row: {
          created_at: string
          deleted_at: string | null
          display_name: string
          id: string
          kind: string
          metadata: Json
          normalized_name: string
          relationship_label: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          display_name: string
          id?: string
          kind?: string
          metadata?: Json
          normalized_name: string
          relationship_label?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          display_name?: string
          id?: string
          kind?: string
          metadata?: Json
          normalized_name?: string
          relationship_label?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      sender_suggestions: {
        Row: {
          created_at: string
          email_connection_id: string
          id: string
          resolved_at: string | null
          sender: string
          signal: Json
          status: string
          suggested_institution: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          email_connection_id: string
          id?: string
          resolved_at?: string | null
          sender: string
          signal?: Json
          status?: string
          suggested_institution?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          email_connection_id?: string
          id?: string
          resolved_at?: string | null
          sender?: string
          signal?: Json
          status?: string
          suggested_institution?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sender_suggestions_email_connection_id_fkey"
            columns: ["email_connection_id"]
            isOneToOne: false
            referencedRelation: "email_connections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sender_suggestions_suggested_institution_fkey"
            columns: ["suggested_institution"]
            isOneToOne: false
            referencedRelation: "email_institutions"
            referencedColumns: ["institution_key"]
          },
        ]
      }
      tags: {
        Row: {
          created_at: string
          deleted_at: string | null
          id: string
          is_system: boolean
          key: string
          label: string
          metadata: Json
          type: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          id?: string
          is_system?: boolean
          key: string
          label: string
          metadata?: Json
          type: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          id?: string
          is_system?: boolean
          key?: string
          label?: string
          metadata?: Json
          type?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      transactional_outbox: {
        Row: {
          aggregate_id: string
          aggregate_type: string
          attempt_count: number
          created_at: string
          event_type: string
          id: string
          last_error: string | null
          max_attempts: number
          metadata: Json
          next_attempt_at: string
          payload: Json
          payload_version: number
          processing_started_at: string | null
          published_at: string | null
          status: string
          trace_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          aggregate_id: string
          aggregate_type: string
          attempt_count?: number
          created_at?: string
          event_type: string
          id?: string
          last_error?: string | null
          max_attempts?: number
          metadata?: Json
          next_attempt_at?: string
          payload: Json
          payload_version?: number
          processing_started_at?: string | null
          published_at?: string | null
          status?: string
          trace_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          aggregate_id?: string
          aggregate_type?: string
          attempt_count?: number
          created_at?: string
          event_type?: string
          id?: string
          last_error?: string | null
          max_attempts?: number
          metadata?: Json
          next_attempt_at?: string
          payload?: Json
          payload_version?: number
          processing_started_at?: string | null
          published_at?: string | null
          status?: string
          trace_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_email_sources: {
        Row: {
          created_at: string
          deleted_at: string | null
          email_connection_id: string
          id: string
          institution_key: string
          last_matched_at: string | null
          metadata: Json
          notification_sender: string
          origin: string
          status: string
          updated_at: string
          user_id: string
          verification_status: string
          verified_at: string | null
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          email_connection_id: string
          id?: string
          institution_key: string
          last_matched_at?: string | null
          metadata?: Json
          notification_sender: string
          origin?: string
          status?: string
          updated_at?: string
          user_id: string
          verification_status?: string
          verified_at?: string | null
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          email_connection_id?: string
          id?: string
          institution_key?: string
          last_matched_at?: string | null
          metadata?: Json
          notification_sender?: string
          origin?: string
          status?: string
          updated_at?: string
          user_id?: string
          verification_status?: string
          verified_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_email_sources_email_connection_id_fkey"
            columns: ["email_connection_id"]
            isOneToOne: false
            referencedRelation: "email_connections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_email_sources_institution_key_fkey"
            columns: ["institution_key"]
            isOneToOne: false
            referencedRelation: "email_institutions"
            referencedColumns: ["institution_key"]
          },
        ]
      }
      user_preferences: {
        Row: {
          created_at: string
          default_account_id: string | null
          discreet_mode_enabled: boolean
          email_opt_in: boolean
          metadata: Json
          nudge_opt_in: Json
          quiet_hours_end: string | null
          quiet_hours_start: string | null
          tone_style: string | null
          updated_at: string
          user_id: string
          whatsapp_opt_in: boolean
        }
        Insert: {
          created_at?: string
          default_account_id?: string | null
          discreet_mode_enabled?: boolean
          email_opt_in?: boolean
          metadata?: Json
          nudge_opt_in?: Json
          quiet_hours_end?: string | null
          quiet_hours_start?: string | null
          tone_style?: string | null
          updated_at?: string
          user_id: string
          whatsapp_opt_in?: boolean
        }
        Update: {
          created_at?: string
          default_account_id?: string | null
          discreet_mode_enabled?: boolean
          email_opt_in?: boolean
          metadata?: Json
          nudge_opt_in?: Json
          quiet_hours_end?: string | null
          quiet_hours_start?: string | null
          tone_style?: string | null
          updated_at?: string
          user_id?: string
          whatsapp_opt_in?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "user_preferences_default_account_fk"
            columns: ["default_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      user_profile_candidates: {
        Row: {
          ask_count: number
          created_at: string
          decided_at: string | null
          evidence_refs: string[]
          id: string
          last_asked_at: string | null
          metadata: Json
          statement: string
          status: string
          subject_key: string
          updated_at: string
          user_id: string
        }
        Insert: {
          ask_count?: number
          created_at?: string
          decided_at?: string | null
          evidence_refs?: string[]
          id?: string
          last_asked_at?: string | null
          metadata?: Json
          statement: string
          status?: string
          subject_key: string
          updated_at?: string
          user_id: string
        }
        Update: {
          ask_count?: number
          created_at?: string
          decided_at?: string | null
          evidence_refs?: string[]
          id?: string
          last_asked_at?: string | null
          metadata?: Json
          statement?: string
          status?: string
          subject_key?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_profile_facts: {
        Row: {
          created_at: string
          expires_at: string | null
          id: string
          last_confirmed_at: string | null
          metadata: Json
          negative_evidence_count: number
          negative_evidence_refs: string[]
          origin: string
          positive_evidence_count: number
          positive_evidence_refs: string[]
          statement: string
          status: string
          subject_key: string
          supersedes_fact_id: string | null
          updated_at: string
          user_id: string
          validity: string
        }
        Insert: {
          created_at?: string
          expires_at?: string | null
          id?: string
          last_confirmed_at?: string | null
          metadata?: Json
          negative_evidence_count?: number
          negative_evidence_refs?: string[]
          origin: string
          positive_evidence_count?: number
          positive_evidence_refs?: string[]
          statement: string
          status?: string
          subject_key: string
          supersedes_fact_id?: string | null
          updated_at?: string
          user_id: string
          validity?: string
        }
        Update: {
          created_at?: string
          expires_at?: string | null
          id?: string
          last_confirmed_at?: string | null
          metadata?: Json
          negative_evidence_count?: number
          negative_evidence_refs?: string[]
          origin?: string
          positive_evidence_count?: number
          positive_evidence_refs?: string[]
          statement?: string
          status?: string
          subject_key?: string
          supersedes_fact_id?: string | null
          updated_at?: string
          user_id?: string
          validity?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_profile_facts_supersedes_fact_id_fkey"
            columns: ["supersedes_fact_id"]
            isOneToOne: false
            referencedRelation: "user_profile_facts"
            referencedColumns: ["id"]
          },
        ]
      }
      user_subcategories: {
        Row: {
          category_id: string
          created_at: string
          created_by: string
          deleted_at: string | null
          id: string
          label: string
          metadata: Json
          normalized_label: string
          updated_at: string
          user_id: string
        }
        Insert: {
          category_id: string
          created_at?: string
          created_by: string
          deleted_at?: string | null
          id?: string
          label: string
          metadata?: Json
          normalized_label: string
          updated_at?: string
          user_id: string
        }
        Update: {
          category_id?: string
          created_at?: string
          created_by?: string
          deleted_at?: string | null
          id?: string
          label?: string
          metadata?: Json
          normalized_label?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_subcategories_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_delivery_attempts: {
        Row: {
          created_at: string
          direction: string
          error_code: string | null
          error_message: string | null
          http_status: number | null
          id: string
          idempotency_key: string
          latency_ms: number | null
          message_kind: string
          metadata: Json
          provider: string
          provider_message_id: string | null
          request_summary: Json
          response_summary: Json
          status: string
          template_name: string | null
          to_phone: string
          trace_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          direction?: string
          error_code?: string | null
          error_message?: string | null
          http_status?: number | null
          id?: string
          idempotency_key: string
          latency_ms?: number | null
          message_kind: string
          metadata?: Json
          provider?: string
          provider_message_id?: string | null
          request_summary?: Json
          response_summary?: Json
          status?: string
          template_name?: string | null
          to_phone: string
          trace_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          direction?: string
          error_code?: string | null
          error_message?: string | null
          http_status?: number | null
          id?: string
          idempotency_key?: string
          latency_ms?: number | null
          message_kind?: string
          metadata?: Json
          provider?: string
          provider_message_id?: string | null
          request_summary?: Json
          response_summary?: Json
          status?: string
          template_name?: string | null
          to_phone?: string
          trace_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      whatsapp_window_states: {
        Row: {
          created_at: string
          id: string
          last_paid_template_at: string | null
          last_user_message_at: string | null
          last_window_continuation_prompt_at: string | null
          last_window_final_prompt_at: string | null
          metadata: Json
          paid_templates_this_month: number
          paid_templates_today: number
          phone: string
          status: string
          updated_at: string
          user_id: string
          window_expires_at: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          last_paid_template_at?: string | null
          last_user_message_at?: string | null
          last_window_continuation_prompt_at?: string | null
          last_window_final_prompt_at?: string | null
          metadata?: Json
          paid_templates_this_month?: number
          paid_templates_today?: number
          phone: string
          status?: string
          updated_at?: string
          user_id: string
          window_expires_at?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          last_paid_template_at?: string | null
          last_user_message_at?: string | null
          last_window_continuation_prompt_at?: string | null
          last_window_final_prompt_at?: string | null
          metadata?: Json
          paid_templates_this_month?: number
          paid_templates_today?: number
          phone?: string
          status?: string
          updated_at?: string
          user_id?: string
          window_expires_at?: string | null
        }
        Relationships: []
      }
      worker_job_runs: {
        Row: {
          claimed_count: number
          created_at: string
          duration_ms: number | null
          failed_count: number
          finished_at: string | null
          id: string
          job_name: string
          last_error: string | null
          metadata: Json
          processed_count: number
          result: Json
          skipped_count: number
          started_at: string
          status: string
          trace_id: string
          trigger: string
          updated_at: string
        }
        Insert: {
          claimed_count?: number
          created_at?: string
          duration_ms?: number | null
          failed_count?: number
          finished_at?: string | null
          id?: string
          job_name: string
          last_error?: string | null
          metadata?: Json
          processed_count?: number
          result?: Json
          skipped_count?: number
          started_at?: string
          status?: string
          trace_id: string
          trigger: string
          updated_at?: string
        }
        Update: {
          claimed_count?: number
          created_at?: string
          duration_ms?: number | null
          failed_count?: number
          finished_at?: string | null
          id?: string
          job_name?: string
          last_error?: string | null
          metadata?: Json
          processed_count?: number
          result?: Json
          skipped_count?: number
          started_at?: string
          status?: string
          trace_id?: string
          trigger?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      advance_onboarding_stage: {
        Args: {
          p_source: string
          p_target_status: Database["public"]["Enums"]["onboarding_status"]
          p_trace_id: string
          p_trigger: string
          p_user_id: string
        }
        Returns: Json
      }
      apply_user_memory_lifecycle: {
        Args: { p_now?: string; p_user_id: string }
        Returns: Json
      }
      check_and_increment_rate_limit: {
        Args: {
          p_key: string
          p_max_count: number
          p_now?: string
          p_window_seconds: number
        }
        Returns: Json
      }
      claim_outbox_events: {
        Args: { p_limit?: number }
        Returns: {
          aggregate_id: string
          aggregate_type: string
          attempt_count: number
          created_at: string
          event_type: string
          id: string
          last_error: string | null
          max_attempts: number
          metadata: Json
          next_attempt_at: string
          payload: Json
          payload_version: number
          processing_started_at: string | null
          published_at: string | null
          status: string
          trace_id: string
          updated_at: string
          user_id: string
        }[]
        SetofOptions: {
          from: "*"
          to: "transactional_outbox"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      commit_budget_operation: {
        Args: {
          p_budget_id: string | null
          p_idempotency_key: string
          p_operation: string
          p_payload: Json
        }
        Returns: Json
      }
      commit_classification_bulk: {
        Args: {
          p_category_id: string | null
          p_excluded_ids: string[]
          p_idempotency_key: string
          p_include_manually_corrected: boolean
          p_movement_ids: string[]
          p_now?: string
          p_preview: boolean
          p_subcategory_id: string | null
          p_user_id: string
        }
        Returns: Json
      }
      commit_debt_creation: {
        Args: {
          p_account_deltas: Json
          p_box_deltas: Json
          p_debt: Json
          p_debt_outbox_events: Json
          p_installments: Json
          p_movement: Json
          p_movement_audit_logs: Json
          p_movement_outbox_events: Json
          p_related_person_normalized_name: string | null
        }
        Returns: Json
      }
      commit_debt_operation: {
        Args: {
          p_debt_id: string
          p_idempotency_key: string
          p_operation: string
          p_payload: Json
          p_trace_id: string
          p_user_id: string
        }
        Returns: Json
      }
      commit_debt_payment: {
        Args: {
          p_account_deltas: Json
          p_audit_logs: Json
          p_box_deltas: Json
          p_debt_id: string
          p_debt_outbox_events: Json
          p_movement: Json
          p_movement_outbox_events: Json
          p_payment: Json
        }
        Returns: Json
      }
      commit_email_message_outcome: {
        Args: {
          p_connection_id: string
          p_content_hash: string
          p_metadata: Json
          p_parsed_status: string
          p_pending: Json
          p_provider_message_id: string
          p_provider_thread_id: string
          p_received_at: string
          p_sender: string
          p_subject_hash: string
          p_trace_id: string
          p_user_id: string
        }
        Returns: Json
      }
      commit_financial_memory_operation: {
        Args: {
          p_idempotency_key: string
          p_memory_id: string
          p_now?: string
          p_operation: string
          p_reason: string
          p_summary: string
          p_user_id: string
        }
        Returns: Json
      }
      commit_gmail_connection: {
        Args: {
          p_email_address: string
          p_encrypted_refresh_token: string
          p_history_id: string
          p_scopes: string[]
          p_trace_id: string
          p_user_id: string
          p_watch_expiration: string
        }
        Returns: {
          created_at: string
          deleted_at: string | null
          email_address: string
          encrypted_refresh_token: string | null
          id: string
          last_history_id: string | null
          last_watch_renewed_at: string | null
          metadata: Json
          provider: string
          provider_account_id: string | null
          scopes: string[]
          status: string
          updated_at: string
          user_id: string
          watch_expiration: string | null
          watch_status: string
        }
        SetofOptions: {
          from: "*"
          to: "email_connections"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      commit_goal_operation: {
        Args: {
          p_goal_id: string | null
          p_idempotency_key: string
          p_operation: string
          p_payload: Json
        }
        Returns: Json
      }
      commit_insight_action: {
        Args: {
          p_idempotency_key: string
          p_insight_id: string
          p_operation: string
          p_trace_id: string
          p_user_id: string
          p_value: string
        }
        Returns: Json
      }
      commit_movement_classification: {
        Args: {
          p_category_id: string | null
          p_idempotency_key: string
          p_movement_id: string
          p_now?: string
          p_subcategory_id: string | null
          p_trace_id: string
          p_user_id: string
        }
        Returns: Json
      }
      commit_pending_debt_payment: {
        Args: {
          p_account_deltas: Json
          p_actor_id: string
          p_audit_logs: Json
          p_box_deltas: Json
          p_debt_id: string
          p_debt_outbox_events: Json
          p_movement: Json
          p_movement_outbox_events: Json
          p_payment: Json
          p_pending_id: string
          p_trace_id: string
        }
        Returns: Json
      }
      commit_pending_recurring_payment: {
        Args: {
          p_account_deltas: Json
          p_actor_id: string
          p_audit_logs: Json
          p_box_deltas: Json
          p_movement: Json
          p_movement_outbox_events: Json
          p_occurrence_id: string
          p_pending_id: string
          p_recurring_outbox_events: Json
          p_recurring_rule_id: string
          p_trace_id: string
        }
        Returns: Json
      }
      commit_preference_memory_operation: {
        Args: {
          p_idempotency_key: string
          p_now?: string
          p_operation: string
          p_preference_id: string
          p_reason: string
          p_user_id: string
          p_value: Json
        }
        Returns: Json
      }
      commit_profile_memory_operation: {
        Args: {
          p_fact_id: string
          p_idempotency_key: string
          p_now?: string
          p_operation: string
          p_reason: string
          p_statement: string
          p_user_id: string
        }
        Returns: Json
      }
      commit_recurring_occurrence_skip: {
        Args: {
          p_occurrence_id: string
          p_recurring_rule_id: string
          p_trace_id: string
          p_user_id: string
        }
        Returns: Json
      }
      commit_recurring_payment: {
        Args: {
          p_account_deltas: Json
          p_audit_logs: Json
          p_box_deltas: Json
          p_movement: Json
          p_movement_outbox_events: Json
          p_occurrence_id: string
          p_recurring_outbox_events: Json
          p_recurring_rule_id: string
        }
        Returns: Json
      }
      commit_subcategory_merge: {
        Args: {
          p_idempotency_key: string
          p_now?: string
          p_preview: boolean
          p_source_id: string
          p_target_id: string
          p_user_id: string
        }
        Returns: Json
      }
      confirm_pending_with_movement: {
        Args: {
          p_account_deltas: Json
          p_actor_id: string
          p_audit_logs: Json
          p_box_deltas: Json
          p_movement: Json
          p_movement_outbox_events: Json
          p_pending_id: string
          p_trace_id: string
          p_user_id: string
        }
        Returns: Json
      }
      core_commit_movement_create:
        | {
            Args: {
              p_account_deltas: Json
              p_audit_logs: Json
              p_box_deltas: Json
              p_movement: Json
            }
            Returns: {
              account_destination_id: string | null
              account_origin_id: string | null
              affects_account_balance: boolean
              affects_total_balance: boolean
              amount: number
              box_destination_id: string | null
              box_origin_id: string | null
              category_id: string | null
              confidence: number | null
              created_at: string
              currency: string
              debt_id: string | null
              deleted_at: string | null
              description: string | null
              id: string
              idempotency_key: string
              merchant: string | null
              metadata: Json
              occurred_at: string
              recurring_occurrence_id: string | null
              recurring_rule_id: string | null
              related_person_id: string | null
              requires_review: boolean
              search_vector: unknown
              source: Database["public"]["Enums"]["movement_source"]
              source_ref: string | null
              status: Database["public"]["Enums"]["movement_status"]
              subcategory_id: string | null
              type: Database["public"]["Enums"]["movement_type"]
              updated_at: string
              user_id: string
            }
            SetofOptions: {
              from: "*"
              to: "movements"
              isOneToOne: true
              isSetofReturn: false
            }
          }
        | {
            Args: {
              p_account_deltas: Json
              p_audit_logs: Json
              p_box_deltas: Json
              p_movement: Json
              p_outbox_events: Json
            }
            Returns: {
              account_destination_id: string | null
              account_origin_id: string | null
              affects_account_balance: boolean
              affects_total_balance: boolean
              amount: number
              box_destination_id: string | null
              box_origin_id: string | null
              category_id: string | null
              confidence: number | null
              created_at: string
              currency: string
              debt_id: string | null
              deleted_at: string | null
              description: string | null
              id: string
              idempotency_key: string
              merchant: string | null
              metadata: Json
              occurred_at: string
              recurring_occurrence_id: string | null
              recurring_rule_id: string | null
              related_person_id: string | null
              requires_review: boolean
              search_vector: unknown
              source: Database["public"]["Enums"]["movement_source"]
              source_ref: string | null
              status: Database["public"]["Enums"]["movement_status"]
              subcategory_id: string | null
              type: Database["public"]["Enums"]["movement_type"]
              updated_at: string
              user_id: string
            }
            SetofOptions: {
              from: "*"
              to: "movements"
              isOneToOne: true
              isSetofReturn: false
            }
          }
      core_commit_movement_update:
        | {
            Args: {
              p_account_deltas: Json
              p_audit_logs: Json
              p_box_deltas: Json
              p_movement: Json
            }
            Returns: {
              account_destination_id: string | null
              account_origin_id: string | null
              affects_account_balance: boolean
              affects_total_balance: boolean
              amount: number
              box_destination_id: string | null
              box_origin_id: string | null
              category_id: string | null
              confidence: number | null
              created_at: string
              currency: string
              debt_id: string | null
              deleted_at: string | null
              description: string | null
              id: string
              idempotency_key: string
              merchant: string | null
              metadata: Json
              occurred_at: string
              recurring_occurrence_id: string | null
              recurring_rule_id: string | null
              related_person_id: string | null
              requires_review: boolean
              search_vector: unknown
              source: Database["public"]["Enums"]["movement_source"]
              source_ref: string | null
              status: Database["public"]["Enums"]["movement_status"]
              subcategory_id: string | null
              type: Database["public"]["Enums"]["movement_type"]
              updated_at: string
              user_id: string
            }
            SetofOptions: {
              from: "*"
              to: "movements"
              isOneToOne: true
              isSetofReturn: false
            }
          }
        | {
            Args: {
              p_account_deltas: Json
              p_audit_logs: Json
              p_box_deltas: Json
              p_movement: Json
              p_outbox_events: Json
            }
            Returns: {
              account_destination_id: string | null
              account_origin_id: string | null
              affects_account_balance: boolean
              affects_total_balance: boolean
              amount: number
              box_destination_id: string | null
              box_origin_id: string | null
              category_id: string | null
              confidence: number | null
              created_at: string
              currency: string
              debt_id: string | null
              deleted_at: string | null
              description: string | null
              id: string
              idempotency_key: string
              merchant: string | null
              metadata: Json
              occurred_at: string
              recurring_occurrence_id: string | null
              recurring_rule_id: string | null
              related_person_id: string | null
              requires_review: boolean
              search_vector: unknown
              source: Database["public"]["Enums"]["movement_source"]
              source_ref: string | null
              status: Database["public"]["Enums"]["movement_status"]
              subcategory_id: string | null
              type: Database["public"]["Enums"]["movement_type"]
              updated_at: string
              user_id: string
            }
            SetofOptions: {
              from: "*"
              to: "movements"
              isOneToOne: true
              isSetofReturn: false
            }
          }
      count_movements_by_subcategory: {
        Args: never
        Returns: {
          movement_count: number
          subcategory_id: string
        }[]
      }
      decide_learning_candidate: {
        Args: {
          p_actor_type: string
          p_candidate_id: string
          p_idempotency_key: string
          p_reason: string
          p_status: string
          p_user_id: string
        }
        Returns: {
          basis: string
          canonical_key: string
          confidence: number
          created_at: string
          decided_at: string | null
          decision_reason: string | null
          evidence_count: number
          evidence_refs: string[]
          evidence_sources: string[]
          id: string
          kind: string
          last_conflict_at: string | null
          last_evidence_at: string | null
          metadata: Json
          negative_evidence_count: number
          negative_evidence_refs: string[]
          negative_evidence_weight: number
          positive_evidence_count: number
          positive_evidence_refs: string[]
          positive_evidence_weight: number
          promoted_memory_id: string | null
          proposal_summary: string
          requires_user_confirmation: boolean
          review_at: string | null
          search_terms: string[]
          sensitivity: string
          status: string
          updated_at: string
          user_id: string
          valid_until: string | null
        }
        SetofOptions: {
          from: "*"
          to: "learning_candidates"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      delete_user_email_source: {
        Args: { p_source_id: string; p_trace_id: string; p_user_id: string }
        Returns: Json
      }
      disconnect_gmail_connection: {
        Args: {
          p_connection_id?: string
          p_trace_id: string
          p_user_id: string
        }
        Returns: Json
      }
      enqueue_gmail_history_notification: {
        Args: {
          p_email_address: string
          p_history_id: string
          p_payload_hash: string
          p_publish_time: string
          p_pubsub_message_id: string
          p_subscription: string
          p_trace_id: string
        }
        Returns: Json
      }
      expire_financial_learning: { Args: { p_now?: string }; Returns: Json }
      forget_all_user_memory: {
        Args: {
          p_confirmation: string
          p_idempotency_key: string
          p_user_id: string
        }
        Returns: Json
      }
      get_budget_suggestions: {
        Args: {
          p_as_of?: string
          p_period_kind?: Database["public"]["Enums"]["budget_period"]
        }
        Returns: Json
      }
      get_email_capture_health: { Args: { p_days?: number }; Returns: Json }
      get_email_extraction_agent_health: {
        Args: { p_days?: number }
        Returns: Json
      }
      get_email_sender_authentication_health: {
        Args: { p_days?: number }
        Returns: Json
      }
      get_learning_governance_metrics: {
        Args: { p_days?: number }
        Returns: Json
      }
      list_recurring_generation_user_ids: {
        Args: { p_limit?: number | null }
        Returns: {
          user_id: string
        }[]
      }
      manage_financial_memory: {
        Args: {
          p_action: string
          p_idempotency_key: string
          p_memory_id: string
          p_reason: string
          p_summary: string
          p_user_id: string
        }
        Returns: Json
      }
      mark_outbox_failed: {
        Args: {
          p_dead_letter?: boolean
          p_error: string
          p_next_attempt_at: string
          p_outbox_id: string
        }
        Returns: {
          aggregate_id: string
          aggregate_type: string
          attempt_count: number
          created_at: string
          event_type: string
          id: string
          last_error: string | null
          max_attempts: number
          metadata: Json
          next_attempt_at: string
          payload: Json
          payload_version: number
          processing_started_at: string | null
          published_at: string | null
          status: string
          trace_id: string
          updated_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "transactional_outbox"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      mark_outbox_published: {
        Args: { p_outbox_id: string }
        Returns: {
          aggregate_id: string
          aggregate_type: string
          attempt_count: number
          created_at: string
          event_type: string
          id: string
          last_error: string | null
          max_attempts: number
          metadata: Json
          next_attempt_at: string
          payload: Json
          payload_version: number
          processing_started_at: string | null
          published_at: string | null
          status: string
          trace_id: string
          updated_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "transactional_outbox"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      prepare_user_account_deletion: {
        Args: { p_trace_id: string; p_user_id: string }
        Returns: Json
      }
      promote_learning_candidate: {
        Args: {
          p_actor_type: string
          p_candidate_id: string
          p_idempotency_key: string
          p_user_id: string
        }
        Returns: {
          canonical_key: string
          confidence: number
          confirmation_status: string
          created_at: string
          evidence_ref: string
          evidence_source: string
          explanation: string | null
          id: string
          kind: string
          last_used_at: string | null
          lifecycle_status: string
          metadata: Json
          negative_evidence_count: number
          negative_evidence_refs: string[]
          positive_evidence_count: number
          positive_evidence_refs: string[]
          review_at: string | null
          revoked_at: string | null
          revoked_reason: string | null
          search_terms: string[]
          sensitive_confirmed_at: string | null
          sensitivity: string
          source_candidate_id: string | null
          summary: string
          superseded_at: string | null
          supersedes_memory_id: string | null
          suspended_at: string | null
          updated_at: string
          user_id: string
          valid_until: string | null
        }
        SetofOptions: {
          from: "*"
          to: "financial_memory_items"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      record_classification_correction_evidence: {
        Args: {
          p_evidence_ref: string
          p_movement: Database["public"]["Tables"]["movements"]["Row"]
          p_next_category_id: string
          p_next_subcategory_id: string
          p_observed_at?: string
          p_previous_category_id: string
          p_previous_subcategory_id: string
          p_user_id: string
        }
        Returns: undefined
      }
      record_internal_event_processing: {
        Args: {
          p_consumer_name: string
          p_event_type: string
          p_last_error?: string
          p_metadata?: Json
          p_outbox_id: string
          p_status: string
        }
        Returns: {
          attempt_count: number
          consumer_name: string
          created_at: string
          event_type: string
          id: string
          last_error: string | null
          metadata: Json
          outbox_id: string
          processed_at: string | null
          status: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "internal_event_log"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      record_learning_candidate: {
        Args: {
          p_basis: string
          p_canonical_key: string
          p_confidence: number
          p_evidence_ref: string
          p_evidence_source: string
          p_kind: string
          p_metadata: Json
          p_proposal_summary: string
          p_requires_user_confirmation: boolean
          p_search_terms: string[]
          p_sensitivity: string
          p_user_id: string
          p_valid_until: string
        }
        Returns: {
          basis: string
          canonical_key: string
          confidence: number
          created_at: string
          decided_at: string | null
          decision_reason: string | null
          evidence_count: number
          evidence_refs: string[]
          evidence_sources: string[]
          id: string
          kind: string
          last_conflict_at: string | null
          last_evidence_at: string | null
          metadata: Json
          negative_evidence_count: number
          negative_evidence_refs: string[]
          negative_evidence_weight: number
          positive_evidence_count: number
          positive_evidence_refs: string[]
          positive_evidence_weight: number
          promoted_memory_id: string | null
          proposal_summary: string
          requires_user_confirmation: boolean
          review_at: string | null
          search_terms: string[]
          sensitivity: string
          status: string
          updated_at: string
          user_id: string
          valid_until: string | null
        }
        SetofOptions: {
          from: "*"
          to: "learning_candidates"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      record_learning_evidence: {
        Args: {
          p_basis: string
          p_canonical_key: string
          p_claim_value: Json
          p_evidence_ref: string
          p_evidence_source: string
          p_evidence_weight: number
          p_kind: string
          p_metadata: Json
          p_observed_at: string
          p_polarity: string
          p_proposal_summary: string
          p_requires_user_confirmation: boolean
          p_search_terms: string[]
          p_sensitivity: string
          p_source_entity_id: string
          p_source_entity_type: string
          p_user_id: string
          p_valid_until: string
        }
        Returns: {
          basis: string
          canonical_key: string
          confidence: number
          created_at: string
          decided_at: string | null
          decision_reason: string | null
          evidence_count: number
          evidence_refs: string[]
          evidence_sources: string[]
          id: string
          kind: string
          last_conflict_at: string | null
          last_evidence_at: string | null
          metadata: Json
          negative_evidence_count: number
          negative_evidence_refs: string[]
          negative_evidence_weight: number
          positive_evidence_count: number
          positive_evidence_refs: string[]
          positive_evidence_weight: number
          promoted_memory_id: string | null
          proposal_summary: string
          requires_user_confirmation: boolean
          review_at: string | null
          search_terms: string[]
          sensitivity: string
          status: string
          updated_at: string
          user_id: string
          valid_until: string | null
        }
        SetofOptions: {
          from: "*"
          to: "learning_candidates"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      refresh_debt_installment_lifecycle: {
        Args: {
          p_as_of_date: string
          p_due_soon_days: number
          p_trace_id: string
          p_user_id: string
        }
        Returns: Json
      }
      requeue_outbox_event: {
        Args: {
          p_outbox_id: string
          p_reason: string
          p_requested_by?: string
          p_trace_id: string
        }
        Returns: {
          aggregate_id: string
          aggregate_type: string
          attempt_count: number
          created_at: string
          event_type: string
          id: string
          last_error: string | null
          max_attempts: number
          metadata: Json
          next_attempt_at: string
          payload: Json
          payload_version: number
          processing_started_at: string | null
          published_at: string | null
          status: string
          trace_id: string
          updated_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "transactional_outbox"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      resolve_budget_suggestion: {
        Args: {
          p_idempotency_key: string
          p_payload: Json
          p_resolution: string
          p_suggestion_key: string
        }
        Returns: Json
      }
      resolve_profile_candidate: {
        Args: {
          p_candidate_id: string
          p_idempotency_key: string
          p_resolution: string
          p_statement: string
          p_user_id: string
        }
        Returns: Json
      }
      reverse_debt_payment: {
        Args: {
          p_mode: string
          p_movement_id: string
          p_reason: string
          p_trace_id: string
          p_user_id: string
        }
        Returns: Json
      }
      reverse_recurring_payment: {
        Args: {
          p_mode: string
          p_movement_id: string
          p_reason: string
          p_trace_id: string
          p_user_id: string
        }
        Returns: Json
      }
      run_budget_daily_lifecycle: {
        Args: { p_as_of: string | null; p_user_id?: string | null }
        Returns: Json
      }
      set_dashboard_nudge_preference: {
        Args: {
          p_enabled: boolean
          p_nudge_type: Database["public"]["Enums"]["nudge_type"]
          p_user_id: string
        }
        Returns: {
          channel: string
          created_at: string
          enabled: boolean
          id: string
          metadata: Json
          nudge_type: Database["public"]["Enums"]["nudge_type"]
          paused_until: string | null
          quiet_hours_override: Json | null
          updated_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "nudge_preferences"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      set_experience_preferences: {
        Args: {
          p_discreet_mode_enabled: boolean
          p_idempotency_key: string
          p_insights_whatsapp_opt_in: boolean
          p_theme_preference?: string
          p_user_id: string
          p_weekly_summary_channel: string
          p_weekly_summary_enabled: boolean
        }
        Returns: Json
      }
      set_insight_type_muted: {
        Args: {
          p_idempotency_key: string
          p_insight_type: Database["public"]["Enums"]["insight_type"]
          p_muted: boolean
          p_trace_id: string
          p_user_id: string
        }
        Returns: Json
      }
      set_learning_preferences: {
        Args: {
          p_allow_narrative_memory: boolean
          p_allow_sensitive_memory: boolean
          p_consent_version: string
          p_enabled: boolean
          p_idempotency_key: string
          p_user_id: string
        }
        Returns: {
          allow_narrative_memory: boolean
          allow_sensitive_memory: boolean
          consent_version: string
          created_at: string
          enabled: boolean
          metadata: Json
          updated_at: string
          updated_by: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "learning_preferences"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      set_whatsapp_nudge_consent: {
        Args: {
          p_debt_due: boolean
          p_enabled: boolean
          p_payment_due: boolean
          p_quiet_hours_end: string
          p_quiet_hours_start: string
          p_trace_id: string
          p_user_id: string
        }
        Returns: Json
      }
      undo_classification_batch: {
        Args: {
          p_batch_id: string
          p_expected_kind: string
          p_expected_source_id: string
          p_idempotency_key: string
          p_now?: string
          p_user_id: string
        }
        Returns: Json
      }
      upsert_user_email_source: {
        Args: {
          p_connection_id: string
          p_institution_key: string
          p_notification_sender: string
          p_trace_id: string
          p_user_id: string
        }
        Returns: {
          created_at: string
          deleted_at: string | null
          email_connection_id: string
          id: string
          institution_key: string
          last_matched_at: string | null
          metadata: Json
          notification_sender: string
          origin: string
          status: string
          updated_at: string
          user_id: string
          verification_status: string
          verified_at: string | null
        }
        SetofOptions: {
          from: "*"
          to: "user_email_sources"
          isOneToOne: true
          isSetofReturn: false
        }
      }
    }
    Enums: {
      account_type: "digital" | "banco" | "fisico" | "tarjeta"
      box_type: "compromiso" | "objetivo" | "emergencia"
      budget_kind: "presupuesto" | "limite_blando" | "limite_duro"
      budget_period: "semanal" | "quincenal" | "mensual"
      budget_source: "manual" | "sugerido"
      budget_status: "activo" | "pausado" | "archivado"
      debt_direction: "i_owe" | "they_owe_me"
      debt_kind:
        | "personal"
        | "bank_loan"
        | "credit_card"
        | "installment_purchase"
        | "service_or_bill"
        | "other"
      debt_status:
        | "draft"
        | "active"
        | "due_soon"
        | "overdue"
        | "paid"
        | "cancelled"
        | "archived"
      goal_status: "activa" | "alcanzada" | "pausada" | "archivada"
      insight_feedback: "util" | "no_util"
      insight_status:
        | "candidate"
        | "validated"
        | "ranked"
        | "narrated"
        | "displayed"
        | "sent"
        | "acted"
        | "dismissed"
        | "ignored"
        | "outdated"
        | "expired"
      insight_type:
        | "learning_progress"
        | "comparative"
        | "category_concentration"
        | "temporal_pattern"
        | "anomaly"
        | "projection"
        | "free_money"
        | "recurring"
        | "debt"
        | "box_saving"
        | "contextual"
        | "progress"
        | "data_quality"
        | "budget_risk"
        | "goal_pace"
        | "commitment_uncovered"
        | "merchant_pattern"
      installment_status:
        | "pending"
        | "due_soon"
        | "overdue"
        | "paid"
        | "rescheduled"
        | "skipped"
      memory_scope: "clasificacion" | "perfil" | "preferencia"
      movement_source:
        | "whatsapp"
        | "dashboard_manual"
        | "email_confirmed"
        | "recurring_confirmed"
        | "backfill_confirmed"
        | "system_adjustment"
      movement_status:
        | "confirmed"
        | "needs_review"
        | "corrected"
        | "deleted"
        | "reversed"
      movement_type:
        | "gasto"
        | "ingreso"
        | "transferencia"
        | "asignacion_interna"
        | "deuda_adquirida"
        | "pago_deuda"
        | "prestamo_dado"
        | "prestamo_recibido"
        | "devolucion_recibida"
        | "pago_recurrente"
        | "ajuste"
      nudge_status:
        | "candidate"
        | "approved"
        | "deferred"
        | "rejected"
        | "scheduled"
        | "sent"
        | "delivered"
        | "responded"
        | "acted"
        | "dismissed"
        | "expired"
        | "failed"
      nudge_type:
        | "daily_reconstruction"
        | "missing_activity"
        | "payment_due"
        | "debt_due"
        | "overdue_payment"
        | "pending_review"
        | "weekly_review"
        | "insight_prompt"
        | "anomaly_alert"
        | "progress_positive"
        | "budget_goal"
        | "reengagement"
      onboarding_status:
        | "not_started"
        | "started"
        | "first_value_reached"
        | "activated_light"
        | "activated_strong"
        | "completed"
        | "paused"
      pending_source:
        | "email_pending"
        | "backfill_pending"
        | "recurring_candidate"
        | "ambiguous_movement"
        | "risk_confirmation"
      pending_status:
        | "pending"
        | "sent_for_confirmation"
        | "user_confirmed"
        | "user_edited"
        | "discarded"
        | "auto_resolved_duplicate"
        | "expired"
        | "archived"
        | "already_registered"
      pending_type:
        | "email_detected"
        | "ambiguous_movement"
        | "recurring_candidate"
        | "backfill_item"
        | "data_quality"
        | "risk_confirmation"
      recurring_candidate_status:
        | "candidate"
        | "ready_to_suggest"
        | "suggested"
        | "confirmed"
        | "dismissed"
        | "expired"
      recurring_occurrence_status:
        | "expected"
        | "due_soon"
        | "pending_confirmation"
        | "paid"
        | "skipped"
        | "overdue"
        | "rejected"
      recurring_status:
        | "suggested"
        | "active"
        | "paused"
        | "cancelled"
        | "archived"
      risk_level: "low" | "medium" | "high" | "sensitive"
      template_origin: "usuario" | "sugerida"
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
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
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
      account_type: ["digital", "banco", "fisico", "tarjeta"],
      box_type: ["compromiso", "objetivo", "emergencia"],
      budget_kind: ["presupuesto", "limite_blando", "limite_duro"],
      budget_period: ["semanal", "quincenal", "mensual"],
      budget_source: ["manual", "sugerido"],
      budget_status: ["activo", "pausado", "archivado"],
      debt_direction: ["i_owe", "they_owe_me"],
      debt_kind: [
        "personal",
        "bank_loan",
        "credit_card",
        "installment_purchase",
        "service_or_bill",
        "other",
      ],
      debt_status: [
        "draft",
        "active",
        "due_soon",
        "overdue",
        "paid",
        "cancelled",
        "archived",
      ],
      goal_status: ["activa", "alcanzada", "pausada", "archivada"],
      insight_feedback: ["util", "no_util"],
      insight_status: [
        "candidate",
        "validated",
        "ranked",
        "narrated",
        "displayed",
        "sent",
        "acted",
        "dismissed",
        "ignored",
        "outdated",
        "expired",
      ],
      insight_type: [
        "learning_progress",
        "comparative",
        "category_concentration",
        "temporal_pattern",
        "anomaly",
        "projection",
        "free_money",
        "recurring",
        "debt",
        "box_saving",
        "contextual",
        "progress",
        "data_quality",
        "budget_risk",
        "goal_pace",
        "commitment_uncovered",
        "merchant_pattern",
      ],
      installment_status: [
        "pending",
        "due_soon",
        "overdue",
        "paid",
        "rescheduled",
        "skipped",
      ],
      memory_scope: ["clasificacion", "perfil", "preferencia"],
      movement_source: [
        "whatsapp",
        "dashboard_manual",
        "email_confirmed",
        "recurring_confirmed",
        "backfill_confirmed",
        "system_adjustment",
      ],
      movement_status: [
        "confirmed",
        "needs_review",
        "corrected",
        "deleted",
        "reversed",
      ],
      movement_type: [
        "gasto",
        "ingreso",
        "transferencia",
        "asignacion_interna",
        "deuda_adquirida",
        "pago_deuda",
        "prestamo_dado",
        "prestamo_recibido",
        "devolucion_recibida",
        "pago_recurrente",
        "ajuste",
      ],
      nudge_status: [
        "candidate",
        "approved",
        "deferred",
        "rejected",
        "scheduled",
        "sent",
        "delivered",
        "responded",
        "acted",
        "dismissed",
        "expired",
        "failed",
      ],
      nudge_type: [
        "daily_reconstruction",
        "missing_activity",
        "payment_due",
        "debt_due",
        "overdue_payment",
        "pending_review",
        "weekly_review",
        "insight_prompt",
        "anomaly_alert",
        "progress_positive",
        "budget_goal",
        "reengagement",
      ],
      onboarding_status: [
        "not_started",
        "started",
        "first_value_reached",
        "activated_light",
        "activated_strong",
        "completed",
        "paused",
      ],
      pending_source: [
        "email_pending",
        "backfill_pending",
        "recurring_candidate",
        "ambiguous_movement",
        "risk_confirmation",
      ],
      pending_status: [
        "pending",
        "sent_for_confirmation",
        "user_confirmed",
        "user_edited",
        "discarded",
        "auto_resolved_duplicate",
        "expired",
        "archived",
        "already_registered",
      ],
      pending_type: [
        "email_detected",
        "ambiguous_movement",
        "recurring_candidate",
        "backfill_item",
        "data_quality",
        "risk_confirmation",
      ],
      recurring_candidate_status: [
        "candidate",
        "ready_to_suggest",
        "suggested",
        "confirmed",
        "dismissed",
        "expired",
      ],
      recurring_occurrence_status: [
        "expected",
        "due_soon",
        "pending_confirmation",
        "paid",
        "skipped",
        "overdue",
        "rejected",
      ],
      recurring_status: [
        "suggested",
        "active",
        "paused",
        "cancelled",
        "archived",
      ],
      risk_level: ["low", "medium", "high", "sensitive"],
      template_origin: ["usuario", "sugerida"],
    },
  },
} as const
