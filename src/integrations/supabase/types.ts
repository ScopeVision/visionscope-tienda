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
      blog_posts: {
        Row: {
          content_ca: string | null
          content_en: string | null
          content_es: string | null
          content_fr: string | null
          cover_image: string | null
          created_at: string
          excerpt_ca: string | null
          excerpt_en: string | null
          excerpt_es: string | null
          excerpt_fr: string | null
          id: string
          published: boolean
          published_at: string | null
          slug: string
          title_ca: string | null
          title_en: string | null
          title_es: string
          title_fr: string | null
          updated_at: string
        }
        Insert: {
          content_ca?: string | null
          content_en?: string | null
          content_es?: string | null
          content_fr?: string | null
          cover_image?: string | null
          created_at?: string
          excerpt_ca?: string | null
          excerpt_en?: string | null
          excerpt_es?: string | null
          excerpt_fr?: string | null
          id?: string
          published?: boolean
          published_at?: string | null
          slug: string
          title_ca?: string | null
          title_en?: string | null
          title_es: string
          title_fr?: string | null
          updated_at?: string
        }
        Update: {
          content_ca?: string | null
          content_en?: string | null
          content_es?: string | null
          content_fr?: string | null
          cover_image?: string | null
          created_at?: string
          excerpt_ca?: string | null
          excerpt_en?: string | null
          excerpt_es?: string | null
          excerpt_fr?: string | null
          id?: string
          published?: boolean
          published_at?: string | null
          slug?: string
          title_ca?: string | null
          title_en?: string | null
          title_es?: string
          title_fr?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      booking_audit_log: {
        Row: {
          action: string
          actor_user_id: string | null
          booking_id: string | null
          changes: Json
          created_at: string
          entity_id: string | null
          entity_type: string | null
          id: string
        }
        Insert: {
          action: string
          actor_user_id?: string | null
          booking_id?: string | null
          changes?: Json
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
        }
        Update: {
          action?: string
          actor_user_id?: string | null
          booking_id?: string | null
          changes?: Json
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
        }
        Relationships: []
      }
      booking_communications: {
        Row: {
          body: string
          booking_id: string
          created_at: string
          created_by: string | null
          error_message: string | null
          id: string
          language: string
          recipient_email: string
          sent_at: string | null
          status: string
          subject: string
          type: string
        }
        Insert: {
          body: string
          booking_id: string
          created_at?: string
          created_by?: string | null
          error_message?: string | null
          id?: string
          language?: string
          recipient_email: string
          sent_at?: string | null
          status?: string
          subject: string
          type: string
        }
        Update: {
          body?: string
          booking_id?: string
          created_at?: string
          created_by?: string | null
          error_message?: string | null
          id?: string
          language?: string
          recipient_email?: string
          sent_at?: string | null
          status?: string
          subject?: string
          type?: string
        }
        Relationships: []
      }
      booking_items: {
        Row: {
          auto_subtotal: number | null
          booking_id: string
          created_at: string
          days: number
          deposit: number
          discount_type: string
          discount_value: number
          id: string
          inventory_unit_id: string | null
          overridden_at: string | null
          overridden_by: string | null
          override_reason: string | null
          price_day: number
          price_override: number | null
          price_week: number | null
          pricing_model: string | null
          product_id: string | null
          product_name: string
          quantity: number
          subtotal: number
          variant_id: string | null
        }
        Insert: {
          auto_subtotal?: number | null
          booking_id: string
          created_at?: string
          days?: number
          deposit?: number
          discount_type?: string
          discount_value?: number
          id?: string
          inventory_unit_id?: string | null
          overridden_at?: string | null
          overridden_by?: string | null
          override_reason?: string | null
          price_day?: number
          price_override?: number | null
          price_week?: number | null
          pricing_model?: string | null
          product_id?: string | null
          product_name: string
          quantity?: number
          subtotal?: number
          variant_id?: string | null
        }
        Update: {
          auto_subtotal?: number | null
          booking_id?: string
          created_at?: string
          days?: number
          deposit?: number
          discount_type?: string
          discount_value?: number
          id?: string
          inventory_unit_id?: string | null
          overridden_at?: string | null
          overridden_by?: string | null
          override_reason?: string | null
          price_day?: number
          price_override?: number | null
          price_week?: number | null
          pricing_model?: string | null
          product_id?: string | null
          product_name?: string
          quantity?: number
          subtotal?: number
          variant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "booking_items_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      bookings: {
        Row: {
          created_at: string
          customer_id: string | null
          deposit_total: number
          discount_type: string
          discount_value: number
          end_date: string
          extra_fees: Json
          id: string
          internal_notes: string | null
          notes: string | null
          paid_at: string | null
          payment_status: Database["public"]["Enums"]["payment_status"]
          reference: string
          refunded_at: string | null
          start_date: string
          status: Database["public"]["Enums"]["booking_status"]
          subtotal: number
          subtotal_override: number | null
          total: number
          total_override: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          customer_id?: string | null
          deposit_total?: number
          discount_type?: string
          discount_value?: number
          end_date: string
          extra_fees?: Json
          id?: string
          internal_notes?: string | null
          notes?: string | null
          paid_at?: string | null
          payment_status?: Database["public"]["Enums"]["payment_status"]
          reference?: string
          refunded_at?: string | null
          start_date: string
          status?: Database["public"]["Enums"]["booking_status"]
          subtotal?: number
          subtotal_override?: number | null
          total?: number
          total_override?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          customer_id?: string | null
          deposit_total?: number
          discount_type?: string
          discount_value?: number
          end_date?: string
          extra_fees?: Json
          id?: string
          internal_notes?: string | null
          notes?: string | null
          paid_at?: string | null
          payment_status?: Database["public"]["Enums"]["payment_status"]
          reference?: string
          refunded_at?: string | null
          start_date?: string
          status?: Database["public"]["Enums"]["booking_status"]
          subtotal?: number
          subtotal_override?: number | null
          total?: number
          total_override?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bookings_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      categories: {
        Row: {
          created_at: string
          default_pricing_model: Database["public"]["Enums"]["pricing_model"]
          id: string
          image_url: string | null
          link_url: string | null
          name_ca: string | null
          name_en: string | null
          name_es: string
          name_fr: string | null
          slug: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          default_pricing_model?: Database["public"]["Enums"]["pricing_model"]
          id?: string
          image_url?: string | null
          link_url?: string | null
          name_ca?: string | null
          name_en?: string | null
          name_es: string
          name_fr?: string | null
          slug: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          default_pricing_model?: Database["public"]["Enums"]["pricing_model"]
          id?: string
          image_url?: string | null
          link_url?: string | null
          name_ca?: string | null
          name_en?: string | null
          name_es?: string
          name_fr?: string | null
          slug?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      customers: {
        Row: {
          address_line1: string | null
          address_line2: string | null
          city: string | null
          company: string | null
          country: string | null
          created_at: string
          email: string
          full_name: string
          id: string
          notes: string | null
          phone: string | null
          postal_code: string | null
          tax_id: string | null
          updated_at: string
        }
        Insert: {
          address_line1?: string | null
          address_line2?: string | null
          city?: string | null
          company?: string | null
          country?: string | null
          created_at?: string
          email: string
          full_name: string
          id?: string
          notes?: string | null
          phone?: string | null
          postal_code?: string | null
          tax_id?: string | null
          updated_at?: string
        }
        Update: {
          address_line1?: string | null
          address_line2?: string | null
          city?: string | null
          company?: string | null
          country?: string | null
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          notes?: string | null
          phone?: string | null
          postal_code?: string | null
          tax_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      finance_asset_owner_history: {
        Row: {
          asset_id: string
          changed_at: string
          changed_by: string | null
          id: string
          new_owner_id: string | null
          note: string | null
          previous_owner_id: string | null
        }
        Insert: {
          asset_id: string
          changed_at?: string
          changed_by?: string | null
          id?: string
          new_owner_id?: string | null
          note?: string | null
          previous_owner_id?: string | null
        }
        Update: {
          asset_id?: string
          changed_at?: string
          changed_by?: string | null
          id?: string
          new_owner_id?: string | null
          note?: string | null
          previous_owner_id?: string | null
        }
        Relationships: []
      }
      finance_assets: {
        Row: {
          acquisition_value: number
          active: boolean
          agreement_type: Database["public"]["Enums"]["finance_agreement_type"]
          concession_rules: Json
          created_at: string
          custom_company_pct: number | null
          id: string
          name: string
          notes: string | null
          origin_type: Database["public"]["Enums"]["finance_origin_type"]
          owner_id: string | null
          owner_label: string | null
          owner_split_pct: number
          product_id: string | null
          revenue_model: Database["public"]["Enums"]["finance_revenue_model"]
          store_product_id: string | null
          target_recovery_value: number
          transition_status: Database["public"]["Enums"]["finance_transition_status"]
          updated_at: string
        }
        Insert: {
          acquisition_value?: number
          active?: boolean
          agreement_type?: Database["public"]["Enums"]["finance_agreement_type"]
          concession_rules?: Json
          created_at?: string
          custom_company_pct?: number | null
          id?: string
          name: string
          notes?: string | null
          origin_type?: Database["public"]["Enums"]["finance_origin_type"]
          owner_id?: string | null
          owner_label?: string | null
          owner_split_pct?: number
          product_id?: string | null
          revenue_model?: Database["public"]["Enums"]["finance_revenue_model"]
          store_product_id?: string | null
          target_recovery_value?: number
          transition_status?: Database["public"]["Enums"]["finance_transition_status"]
          updated_at?: string
        }
        Update: {
          acquisition_value?: number
          active?: boolean
          agreement_type?: Database["public"]["Enums"]["finance_agreement_type"]
          concession_rules?: Json
          created_at?: string
          custom_company_pct?: number | null
          id?: string
          name?: string
          notes?: string | null
          origin_type?: Database["public"]["Enums"]["finance_origin_type"]
          owner_id?: string | null
          owner_label?: string | null
          owner_split_pct?: number
          product_id?: string | null
          revenue_model?: Database["public"]["Enums"]["finance_revenue_model"]
          store_product_id?: string | null
          target_recovery_value?: number
          transition_status?: Database["public"]["Enums"]["finance_transition_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "finance_assets_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "finance_owner_balances"
            referencedColumns: ["owner_id"]
          },
          {
            foreignKeyName: "finance_assets_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "finance_owners"
            referencedColumns: ["id"]
          },
        ]
      }
      finance_cash_reserve: {
        Row: {
          id: boolean
          notes: string | null
          target_amount: number
          updated_at: string
        }
        Insert: {
          id?: boolean
          notes?: string | null
          target_amount?: number
          updated_at?: string
        }
        Update: {
          id?: boolean
          notes?: string | null
          target_amount?: number
          updated_at?: string
        }
        Relationships: []
      }
      finance_debt_repayments: {
        Row: {
          amount: number
          created_at: string
          created_by: string | null
          id: string
          notes: string | null
          paid_at: string
          partner_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          paid_at?: string
          partner_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          paid_at?: string
          partner_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "finance_debt_repayments_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "finance_equity_distribution"
            referencedColumns: ["partner_id"]
          },
          {
            foreignKeyName: "finance_debt_repayments_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "finance_partners"
            referencedColumns: ["id"]
          },
        ]
      }
      finance_entries: {
        Row: {
          agreement_type_snapshot:
            | Database["public"]["Enums"]["finance_agreement_type"]
            | null
          applied_company_pct: number | null
          asset_id: string | null
          booking_id: string | null
          booking_item_id: string | null
          company_amount: number
          created_at: string
          created_by: string | null
          currency: string
          gross_amount: number
          id: string
          inventory_unit_id: string | null
          is_manual_override: boolean
          is_reversed: boolean
          notes: string | null
          occurred_at: string
          origin_system: Database["public"]["Enums"]["finance_origin_system"]
          override_reason: string | null
          owner_id: string | null
          owner_split_pct_snapshot: number | null
          partner_id: string | null
          payout_amount: number
          source_type: Database["public"]["Enums"]["finance_source_type"]
          status: Database["public"]["Enums"]["finance_entry_status"]
          store_order_id: string | null
          subtotal_snapshot: number | null
        }
        Insert: {
          agreement_type_snapshot?:
            | Database["public"]["Enums"]["finance_agreement_type"]
            | null
          applied_company_pct?: number | null
          asset_id?: string | null
          booking_id?: string | null
          booking_item_id?: string | null
          company_amount?: number
          created_at?: string
          created_by?: string | null
          currency?: string
          gross_amount?: number
          id?: string
          inventory_unit_id?: string | null
          is_manual_override?: boolean
          is_reversed?: boolean
          notes?: string | null
          occurred_at?: string
          origin_system: Database["public"]["Enums"]["finance_origin_system"]
          override_reason?: string | null
          owner_id?: string | null
          owner_split_pct_snapshot?: number | null
          partner_id?: string | null
          payout_amount?: number
          source_type: Database["public"]["Enums"]["finance_source_type"]
          status?: Database["public"]["Enums"]["finance_entry_status"]
          store_order_id?: string | null
          subtotal_snapshot?: number | null
        }
        Update: {
          agreement_type_snapshot?:
            | Database["public"]["Enums"]["finance_agreement_type"]
            | null
          applied_company_pct?: number | null
          asset_id?: string | null
          booking_id?: string | null
          booking_item_id?: string | null
          company_amount?: number
          created_at?: string
          created_by?: string | null
          currency?: string
          gross_amount?: number
          id?: string
          inventory_unit_id?: string | null
          is_manual_override?: boolean
          is_reversed?: boolean
          notes?: string | null
          occurred_at?: string
          origin_system?: Database["public"]["Enums"]["finance_origin_system"]
          override_reason?: string | null
          owner_id?: string | null
          owner_split_pct_snapshot?: number | null
          partner_id?: string | null
          payout_amount?: number
          source_type?: Database["public"]["Enums"]["finance_source_type"]
          status?: Database["public"]["Enums"]["finance_entry_status"]
          store_order_id?: string | null
          subtotal_snapshot?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "finance_entries_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "finance_asset_kpis"
            referencedColumns: ["asset_id"]
          },
          {
            foreignKeyName: "finance_entries_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "finance_assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finance_entries_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "finance_owner_balances"
            referencedColumns: ["owner_id"]
          },
          {
            foreignKeyName: "finance_entries_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "finance_owners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finance_entries_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "finance_equity_distribution"
            referencedColumns: ["partner_id"]
          },
          {
            foreignKeyName: "finance_entries_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "finance_partners"
            referencedColumns: ["id"]
          },
        ]
      }
      finance_expenses: {
        Row: {
          amount: number
          asset_id: string | null
          asset_id_created: string | null
          booking_id: string | null
          category: string
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          kind: Database["public"]["Enums"]["finance_expense_kind"]
          occurred_at: string
          scope: Database["public"]["Enums"]["finance_expense_scope"]
        }
        Insert: {
          amount: number
          asset_id?: string | null
          asset_id_created?: string | null
          booking_id?: string | null
          category?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["finance_expense_kind"]
          occurred_at?: string
          scope?: Database["public"]["Enums"]["finance_expense_scope"]
        }
        Update: {
          amount?: number
          asset_id?: string | null
          asset_id_created?: string | null
          booking_id?: string | null
          category?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["finance_expense_kind"]
          occurred_at?: string
          scope?: Database["public"]["Enums"]["finance_expense_scope"]
        }
        Relationships: []
      }
      finance_owner_payments: {
        Row: {
          amount: number
          created_at: string
          created_by: string | null
          currency: string
          id: string
          method: string | null
          notes: string | null
          owner_id: string
          paid_at: string
          reference: string | null
          updated_at: string
        }
        Insert: {
          amount: number
          created_at?: string
          created_by?: string | null
          currency?: string
          id?: string
          method?: string | null
          notes?: string | null
          owner_id: string
          paid_at?: string
          reference?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string | null
          currency?: string
          id?: string
          method?: string | null
          notes?: string | null
          owner_id?: string
          paid_at?: string
          reference?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "finance_owner_payments_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "finance_owner_balances"
            referencedColumns: ["owner_id"]
          },
          {
            foreignKeyName: "finance_owner_payments_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "finance_owners"
            referencedColumns: ["id"]
          },
        ]
      }
      finance_owners: {
        Row: {
          active: boolean
          contact_email: string | null
          contact_phone: string | null
          created_at: string
          default_company_pct: number
          id: string
          name: string
          notes: string | null
          partner_id: string | null
          sort_order: number
          type: Database["public"]["Enums"]["finance_owner_type"]
          updated_at: string
        }
        Insert: {
          active?: boolean
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          default_company_pct?: number
          id?: string
          name: string
          notes?: string | null
          partner_id?: string | null
          sort_order?: number
          type?: Database["public"]["Enums"]["finance_owner_type"]
          updated_at?: string
        }
        Update: {
          active?: boolean
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          default_company_pct?: number
          id?: string
          name?: string
          notes?: string | null
          partner_id?: string | null
          sort_order?: number
          type?: Database["public"]["Enums"]["finance_owner_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "finance_owners_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "finance_equity_distribution"
            referencedColumns: ["partner_id"]
          },
          {
            foreignKeyName: "finance_owners_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "finance_partners"
            referencedColumns: ["id"]
          },
        ]
      }
      finance_partner_share_history: {
        Row: {
          created_at: string
          created_by: string | null
          effective_from: string
          effective_to: string | null
          id: string
          note: string | null
          partner_id: string
          pct: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          effective_from?: string
          effective_to?: string | null
          id?: string
          note?: string | null
          partner_id: string
          pct: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          effective_from?: string
          effective_to?: string | null
          id?: string
          note?: string | null
          partner_id?: string
          pct?: number
        }
        Relationships: [
          {
            foreignKeyName: "finance_partner_share_history_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "finance_equity_distribution"
            referencedColumns: ["partner_id"]
          },
          {
            foreignKeyName: "finance_partner_share_history_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "finance_partners"
            referencedColumns: ["id"]
          },
        ]
      }
      finance_partners: {
        Row: {
          created_at: string
          id: string
          initial_debt: number
          name: string
          notes: string | null
          profit_share_pct: number
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          initial_debt?: number
          name: string
          notes?: string | null
          profit_share_pct?: number
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          initial_debt?: number
          name?: string
          notes?: string | null
          profit_share_pct?: number
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      finance_payout_payments: {
        Row: {
          amount: number
          created_at: string
          created_by: string | null
          id: string
          method: string | null
          notes: string | null
          paid_at: string
          payout_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          created_by?: string | null
          id?: string
          method?: string | null
          notes?: string | null
          paid_at?: string
          payout_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string | null
          id?: string
          method?: string | null
          notes?: string | null
          paid_at?: string
          payout_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "finance_payout_payments_payout_id_fkey"
            columns: ["payout_id"]
            isOneToOne: false
            referencedRelation: "finance_payouts"
            referencedColumns: ["id"]
          },
        ]
      }
      finance_payouts: {
        Row: {
          agreement_type_snapshot:
            | Database["public"]["Enums"]["finance_agreement_type"]
            | null
          amount: number
          applied_pct: number | null
          asset_id: string | null
          created_at: string
          entry_id: string | null
          id: string
          inventory_unit_id: string | null
          is_manual_override: boolean
          notes: string | null
          owner_id: string | null
          owner_label: string | null
          owner_split_pct_snapshot: number | null
          paid_amount: number
          paid_at: string | null
          product_name: string | null
          status: Database["public"]["Enums"]["finance_payout_status"]
          updated_at: string
        }
        Insert: {
          agreement_type_snapshot?:
            | Database["public"]["Enums"]["finance_agreement_type"]
            | null
          amount?: number
          applied_pct?: number | null
          asset_id?: string | null
          created_at?: string
          entry_id?: string | null
          id?: string
          inventory_unit_id?: string | null
          is_manual_override?: boolean
          notes?: string | null
          owner_id?: string | null
          owner_label?: string | null
          owner_split_pct_snapshot?: number | null
          paid_amount?: number
          paid_at?: string | null
          product_name?: string | null
          status?: Database["public"]["Enums"]["finance_payout_status"]
          updated_at?: string
        }
        Update: {
          agreement_type_snapshot?:
            | Database["public"]["Enums"]["finance_agreement_type"]
            | null
          amount?: number
          applied_pct?: number | null
          asset_id?: string | null
          created_at?: string
          entry_id?: string | null
          id?: string
          inventory_unit_id?: string | null
          is_manual_override?: boolean
          notes?: string | null
          owner_id?: string | null
          owner_label?: string | null
          owner_split_pct_snapshot?: number | null
          paid_amount?: number
          paid_at?: string | null
          product_name?: string | null
          status?: Database["public"]["Enums"]["finance_payout_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "finance_payouts_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "finance_asset_kpis"
            referencedColumns: ["asset_id"]
          },
          {
            foreignKeyName: "finance_payouts_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "finance_assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finance_payouts_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "finance_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finance_payouts_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "finance_period_v"
            referencedColumns: ["entry_id"]
          },
          {
            foreignKeyName: "finance_payouts_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "finance_owner_balances"
            referencedColumns: ["owner_id"]
          },
          {
            foreignKeyName: "finance_payouts_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "finance_owners"
            referencedColumns: ["id"]
          },
        ]
      }
      finance_reconciliation_notes: {
        Row: {
          booking_id: string
          created_at: string
          created_by: string | null
          id: string
          note: string
          resolved: boolean
          resolved_at: string | null
          resolved_by: string | null
          updated_at: string
        }
        Insert: {
          booking_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          note: string
          resolved?: boolean
          resolved_at?: string | null
          resolved_by?: string | null
          updated_at?: string
        }
        Update: {
          booking_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          note?: string
          resolved?: boolean
          resolved_at?: string | null
          resolved_by?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      finance_settings: {
        Row: {
          aggressive_day7_multiplier: number
          default_currency: string
          default_split_company_pct: number
          id: boolean
          notes: string | null
          pricing_presets: Json
          updated_at: string
        }
        Insert: {
          aggressive_day7_multiplier?: number
          default_currency?: string
          default_split_company_pct?: number
          id?: boolean
          notes?: string | null
          pricing_presets?: Json
          updated_at?: string
        }
        Update: {
          aggressive_day7_multiplier?: number
          default_currency?: string
          default_split_company_pct?: number
          id?: boolean
          notes?: string | null
          pricing_presets?: Json
          updated_at?: string
        }
        Relationships: []
      }
      hero_slides: {
        Row: {
          created_at: string
          cta_label: string
          cta_url: string
          id: string
          image_url: string
          published: boolean
          sort_order: number
          subtitle: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          cta_label?: string
          cta_url?: string
          id?: string
          image_url: string
          published?: boolean
          sort_order?: number
          subtitle?: string
          title?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          cta_label?: string
          cta_url?: string
          id?: string
          image_url?: string
          published?: boolean
          sort_order?: number
          subtitle?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      image_settings: {
        Row: {
          focal_x: number
          focal_x_mobile: number | null
          focal_y: number
          focal_y_mobile: number | null
          updated_at: string
          url: string
          zoom: number
          zoom_mobile: number | null
        }
        Insert: {
          focal_x?: number
          focal_x_mobile?: number | null
          focal_y?: number
          focal_y_mobile?: number | null
          updated_at?: string
          url: string
          zoom?: number
          zoom_mobile?: number | null
        }
        Update: {
          focal_x?: number
          focal_x_mobile?: number | null
          focal_y?: number
          focal_y_mobile?: number | null
          updated_at?: string
          url?: string
          zoom?: number
          zoom_mobile?: number | null
        }
        Relationships: []
      }
      inventory_units: {
        Row: {
          acquisition_value: number
          active: boolean
          agreement_type: Database["public"]["Enums"]["finance_agreement_type"]
          created_at: string
          id: string
          internal_code: string | null
          maintenance_notes: string | null
          notes: string | null
          owner_id: string | null
          owner_split_pct: number
          product_id: string
          serial: string | null
          status: Database["public"]["Enums"]["inventory_unit_status"]
          target_recovery_value: number
          updated_at: string
        }
        Insert: {
          acquisition_value?: number
          active?: boolean
          agreement_type?: Database["public"]["Enums"]["finance_agreement_type"]
          created_at?: string
          id?: string
          internal_code?: string | null
          maintenance_notes?: string | null
          notes?: string | null
          owner_id?: string | null
          owner_split_pct?: number
          product_id: string
          serial?: string | null
          status?: Database["public"]["Enums"]["inventory_unit_status"]
          target_recovery_value?: number
          updated_at?: string
        }
        Update: {
          acquisition_value?: number
          active?: boolean
          agreement_type?: Database["public"]["Enums"]["finance_agreement_type"]
          created_at?: string
          id?: string
          internal_code?: string | null
          maintenance_notes?: string | null
          notes?: string | null
          owner_id?: string | null
          owner_split_pct?: number
          product_id?: string
          serial?: string | null
          status?: Database["public"]["Enums"]["inventory_unit_status"]
          target_recovery_value?: number
          updated_at?: string
        }
        Relationships: []
      }
      owner_product_agreements: {
        Row: {
          agreement_type: Database["public"]["Enums"]["finance_agreement_type"]
          created_at: string
          id: string
          notes: string | null
          owner_id: string
          owner_split_pct: number
          product_id: string
          updated_at: string
        }
        Insert: {
          agreement_type?: Database["public"]["Enums"]["finance_agreement_type"]
          created_at?: string
          id?: string
          notes?: string | null
          owner_id: string
          owner_split_pct?: number
          product_id: string
          updated_at?: string
        }
        Update: {
          agreement_type?: Database["public"]["Enums"]["finance_agreement_type"]
          created_at?: string
          id?: string
          notes?: string | null
          owner_id?: string
          owner_split_pct?: number
          product_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      product_components: {
        Row: {
          child_product_id: string
          created_at: string
          id: string
          parent_product_id: string
          price_day_override: number | null
          quantity: number
          sort_order: number
          updated_at: string
          variant_id: string | null
          variant_name: string | null
        }
        Insert: {
          child_product_id: string
          created_at?: string
          id?: string
          parent_product_id: string
          price_day_override?: number | null
          quantity?: number
          sort_order?: number
          updated_at?: string
          variant_id?: string | null
          variant_name?: string | null
        }
        Update: {
          child_product_id?: string
          created_at?: string
          id?: string
          parent_product_id?: string
          price_day_override?: number | null
          quantity?: number
          sort_order?: number
          updated_at?: string
          variant_id?: string | null
          variant_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_components_child_product_id_fkey"
            columns: ["child_product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_components_parent_product_id_fkey"
            columns: ["parent_product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_components_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      product_tags: {
        Row: {
          product_id: string
          tag_id: string
        }
        Insert: {
          product_id: string
          tag_id: string
        }
        Update: {
          product_id?: string
          tag_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_tags_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_tags_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "tags"
            referencedColumns: ["id"]
          },
        ]
      }
      product_variants: {
        Row: {
          created_at: string
          deposit: number
          id: string
          name: string
          price_day: number
          price_week: number | null
          product_id: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          deposit?: number
          id?: string
          name: string
          price_day?: number
          price_week?: number | null
          product_id: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          deposit?: number
          id?: string
          name?: string
          price_day?: number
          price_week?: number | null
          product_id?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_variants_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          accessory_type: string | null
          brand: string | null
          category_id: string | null
          coverage: string | null
          created_at: string
          deposit: number
          description_ca: string | null
          description_en: string | null
          description_es: string | null
          description_fr: string | null
          format: string | null
          grip_type: string | null
          id: string
          images: string[]
          internal_code: string | null
          is_anamorphic: boolean
          is_rehoused: boolean
          is_vintage: boolean
          kit_mode: string
          kit_type: string | null
          lens_type: string | null
          lighting_type: string | null
          model: string | null
          mount: string | null
          name_ca: string | null
          name_en: string | null
          name_es: string
          name_fr: string | null
          price_day: number
          price_week: number | null
          pricing_model: Database["public"]["Enums"]["pricing_model"]
          pricing_multipliers: Json | null
          published: boolean
          sensor_type: string | null
          series: string | null
          slug: string
          stock: number
          updated_at: string
          year: number | null
        }
        Insert: {
          accessory_type?: string | null
          brand?: string | null
          category_id?: string | null
          coverage?: string | null
          created_at?: string
          deposit?: number
          description_ca?: string | null
          description_en?: string | null
          description_es?: string | null
          description_fr?: string | null
          format?: string | null
          grip_type?: string | null
          id?: string
          images?: string[]
          internal_code?: string | null
          is_anamorphic?: boolean
          is_rehoused?: boolean
          is_vintage?: boolean
          kit_mode?: string
          kit_type?: string | null
          lens_type?: string | null
          lighting_type?: string | null
          model?: string | null
          mount?: string | null
          name_ca?: string | null
          name_en?: string | null
          name_es: string
          name_fr?: string | null
          price_day?: number
          price_week?: number | null
          pricing_model?: Database["public"]["Enums"]["pricing_model"]
          pricing_multipliers?: Json | null
          published?: boolean
          sensor_type?: string | null
          series?: string | null
          slug: string
          stock?: number
          updated_at?: string
          year?: number | null
        }
        Update: {
          accessory_type?: string | null
          brand?: string | null
          category_id?: string | null
          coverage?: string | null
          created_at?: string
          deposit?: number
          description_ca?: string | null
          description_en?: string | null
          description_es?: string | null
          description_fr?: string | null
          format?: string | null
          grip_type?: string | null
          id?: string
          images?: string[]
          internal_code?: string | null
          is_anamorphic?: boolean
          is_rehoused?: boolean
          is_vintage?: boolean
          kit_mode?: string
          kit_type?: string | null
          lens_type?: string | null
          lighting_type?: string | null
          model?: string | null
          mount?: string | null
          name_ca?: string | null
          name_en?: string | null
          name_es?: string
          name_fr?: string | null
          price_day?: number
          price_week?: number | null
          pricing_model?: Database["public"]["Enums"]["pricing_model"]
          pricing_multipliers?: Json | null
          published?: boolean
          sensor_type?: string | null
          series?: string | null
          slug?: string
          stock?: number
          updated_at?: string
          year?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      project_items: {
        Row: {
          category: string
          client: string
          cover_image: string
          created_at: string
          description: string
          gallery: string[]
          id: string
          link_url: string
          published: boolean
          slug: string
          sort_order: number
          title: string
          updated_at: string
          year: number | null
        }
        Insert: {
          category?: string
          client?: string
          cover_image?: string
          created_at?: string
          description?: string
          gallery?: string[]
          id?: string
          link_url?: string
          published?: boolean
          slug: string
          sort_order?: number
          title: string
          updated_at?: string
          year?: number | null
        }
        Update: {
          category?: string
          client?: string
          cover_image?: string
          created_at?: string
          description?: string
          gallery?: string[]
          id?: string
          link_url?: string
          published?: boolean
          slug?: string
          sort_order?: number
          title?: string
          updated_at?: string
          year?: number | null
        }
        Relationships: []
      }
      site_settings: {
        Row: {
          contact_email: string
          id: boolean
          instagram_url: string
          internal_code_pin: string | null
          orders_email: string
          updated_at: string
          whatsapp_url: string
        }
        Insert: {
          contact_email?: string
          id?: boolean
          instagram_url?: string
          internal_code_pin?: string | null
          orders_email?: string
          updated_at?: string
          whatsapp_url?: string
        }
        Update: {
          contact_email?: string
          id?: boolean
          instagram_url?: string
          internal_code_pin?: string | null
          orders_email?: string
          updated_at?: string
          whatsapp_url?: string
        }
        Relationships: []
      }
      store_categories: {
        Row: {
          created_at: string
          description: string
          id: string
          image_url: string
          name: string
          parent_id: string | null
          published: boolean
          slug: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string
          id?: string
          image_url?: string
          name: string
          parent_id?: string | null
          published?: boolean
          slug: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          image_url?: string
          name?: string
          parent_id?: string | null
          published?: boolean
          slug?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "store_categories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "store_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      store_product_tags: {
        Row: {
          product_id: string
          tag_id: string
        }
        Insert: {
          product_id: string
          tag_id: string
        }
        Update: {
          product_id?: string
          tag_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "store_product_tags_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "store_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "store_product_tags_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "store_tags"
            referencedColumns: ["id"]
          },
        ]
      }
      store_products: {
        Row: {
          category_id: string | null
          created_at: string
          description: string
          id: string
          images: string[]
          name: string
          price: number
          published: boolean
          short_description: string
          sku: string | null
          slug: string
          sort_order: number
          stock: number
          updated_at: string
        }
        Insert: {
          category_id?: string | null
          created_at?: string
          description?: string
          id?: string
          images?: string[]
          name: string
          price?: number
          published?: boolean
          short_description?: string
          sku?: string | null
          slug: string
          sort_order?: number
          stock?: number
          updated_at?: string
        }
        Update: {
          category_id?: string | null
          created_at?: string
          description?: string
          id?: string
          images?: string[]
          name?: string
          price?: number
          published?: boolean
          short_description?: string
          sku?: string | null
          slug?: string
          sort_order?: number
          stock?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "store_products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "store_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      store_tags: {
        Row: {
          created_at: string
          id: string
          name: string
          slug: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          slug: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          slug?: string
        }
        Relationships: []
      }
      store_variants: {
        Row: {
          created_at: string
          description: string
          id: string
          name: string
          price: number
          product_id: string
          sku: string | null
          sort_order: number
          stock: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string
          id?: string
          name: string
          price?: number
          product_id: string
          sku?: string | null
          sort_order?: number
          stock?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          name?: string
          price?: number
          product_id?: string
          sku?: string | null
          sort_order?: number
          stock?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "store_variants_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "store_products"
            referencedColumns: ["id"]
          },
        ]
      }
      tags: {
        Row: {
          created_at: string
          id: string
          name_ca: string | null
          name_en: string | null
          name_es: string
          name_fr: string | null
          slug: string
        }
        Insert: {
          created_at?: string
          id?: string
          name_ca?: string | null
          name_en?: string | null
          name_es: string
          name_fr?: string | null
          slug: string
        }
        Update: {
          created_at?: string
          id?: string
          name_ca?: string | null
          name_en?: string | null
          name_es?: string
          name_fr?: string | null
          slug?: string
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
      finance_asset_kpis: {
        Row: {
          asset_id: string | null
          company_revenue: number | null
          gross_revenue: number | null
          name: string | null
          owner_id: string | null
          owner_revenue: number | null
          recovered_value: number | null
          recovery_pct: number | null
          target_reached: boolean | null
          target_recovery_value: number | null
          transition_status:
            | Database["public"]["Enums"]["finance_transition_status"]
            | null
        }
        Relationships: [
          {
            foreignKeyName: "finance_assets_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "finance_owner_balances"
            referencedColumns: ["owner_id"]
          },
          {
            foreignKeyName: "finance_assets_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "finance_owners"
            referencedColumns: ["id"]
          },
        ]
      }
      finance_equity_distribution: {
        Row: {
          distributable: number | null
          equity_pct: number | null
          name: string | null
          partner_id: string | null
          would_receive: number | null
        }
        Relationships: []
      }
      finance_owner_balances: {
        Row: {
          active: boolean | null
          name: string | null
          owner_id: string | null
          remaining_unpaid: number | null
          total_generated_gross: number | null
          total_owed: number | null
          total_paid: number | null
          type: Database["public"]["Enums"]["finance_owner_type"] | null
        }
        Insert: {
          active?: boolean | null
          name?: string | null
          owner_id?: string | null
          remaining_unpaid?: never
          total_generated_gross?: never
          total_owed?: never
          total_paid?: never
          type?: Database["public"]["Enums"]["finance_owner_type"] | null
        }
        Update: {
          active?: boolean | null
          name?: string | null
          owner_id?: string | null
          remaining_unpaid?: never
          total_generated_gross?: never
          total_owed?: never
          total_paid?: never
          type?: Database["public"]["Enums"]["finance_owner_type"] | null
        }
        Relationships: []
      }
      finance_owner_monthly: {
        Row: {
          bookings_count: number | null
          generated_gross: number | null
          generated_payout: number | null
          owner_id: string | null
          period_month: string | null
        }
        Relationships: [
          {
            foreignKeyName: "finance_entries_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "finance_owner_balances"
            referencedColumns: ["owner_id"]
          },
          {
            foreignKeyName: "finance_entries_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "finance_owners"
            referencedColumns: ["id"]
          },
        ]
      }
      finance_period_v: {
        Row: {
          agreement_type_snapshot:
            | Database["public"]["Enums"]["finance_agreement_type"]
            | null
          applied_company_pct: number | null
          booking_id: string | null
          booking_reference: string | null
          booking_status: Database["public"]["Enums"]["booking_status"] | null
          booking_total: number | null
          company_amount: number | null
          entry_id: string | null
          entry_status:
            | Database["public"]["Enums"]["finance_entry_status"]
            | null
          gross_amount: number | null
          origin_system:
            | Database["public"]["Enums"]["finance_origin_system"]
            | null
          owner_id: string | null
          owner_split_pct_snapshot: number | null
          paid_at: string | null
          payment_status: Database["public"]["Enums"]["payment_status"] | null
          payout_amount: number | null
          period_date: string | null
          period_month: string | null
          source_type: Database["public"]["Enums"]["finance_source_type"] | null
        }
        Relationships: [
          {
            foreignKeyName: "finance_entries_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "finance_owner_balances"
            referencedColumns: ["owner_id"]
          },
          {
            foreignKeyName: "finance_entries_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "finance_owners"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      available_stock: {
        Args: { _end: string; _product_id: string; _start: string }
        Returns: number
      }
      bootstrap_first_admin: { Args: { _user_id: string }; Returns: undefined }
      calc_rental_unit_total: {
        Args: {
          _custom: Json
          _days: number
          _model: Database["public"]["Enums"]["pricing_model"]
          _price_day: number
          _price_week: number
        }
        Returns: number
      }
      create_booking_with_items: {
        Args: {
          _customer_id: string
          _end_date: string
          _items: Json
          _notes: string
          _start_date: string
        }
        Returns: {
          booking_id: string
          reference: string
        }[]
      }
      finance_summary: {
        Args: { _end: string; _start: string }
        Returns: {
          asset_purchases_total: number
          cash_balance: number
          cash_reserve_target: number
          debt_repaid: number
          distributable: number
          expenses_total: number
          owner_liability_open: number
          payouts_paid: number
          payouts_partial: number
          payouts_pending: number
          rental_income: number
          services_income: number
          store_income: number
        }[]
      }
      generate_internal_code: {
        Args: { p_category_id: string }
        Returns: string
      }
      get_pricing_multipliers: {
        Args: {
          _custom: Json
          _model: Database["public"]["Enums"]["pricing_model"]
          _price_day: number
          _price_week: number
        }
        Returns: number[]
      }
      get_public_contact: {
        Args: never
        Returns: {
          contact_email: string
          instagram_url: string
          whatsapp_url: string
        }[]
      }
      has_any_admin: { Args: never; Returns: boolean }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      internal_code_prefix: { Args: { p_category_id: string }; Returns: string }
      recompute_payout_status: {
        Args: { _payout_id: string }
        Returns: undefined
      }
      submit_checkout_request: {
        Args: {
          _address_line1: string
          _city: string
          _company: string
          _country: string
          _email: string
          _end_date: string
          _full_name: string
          _items: Json
          _notes: string
          _phone: string
          _postal_code: string
          _start_date: string
          _tax_id: string
        }
        Returns: {
          booking_id: string
          reference: string
        }[]
      }
      update_partner_equity: { Args: { _changes: Json }; Returns: undefined }
      validate_booking_finance_invariant: {
        Args: { _booking_id: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "user"
      booking_status:
        | "nuevo"
        | "confirmado"
        | "preparacion"
        | "alquiler"
        | "finalizado"
        | "cancelado"
        | "pending_review"
        | "awaiting_confirmation"
        | "ready_for_pickup"
        | "returned"
      finance_agreement_type:
        | "company_owned"
        | "split_70_30"
        | "custom_split"
        | "concession"
      finance_entry_status: "active" | "reversed" | "void"
      finance_expense_kind: "operational" | "asset_purchase"
      finance_expense_scope: "company" | "asset" | "rental"
      finance_origin_system: "rental" | "store" | "services"
      finance_origin_type: "socio" | "concession" | "external" | "company"
      finance_owner_type: "socio" | "external" | "concession" | "company"
      finance_payout_status:
        | "pending"
        | "paid"
        | "cancelled"
        | "unpaid"
        | "partially_paid"
      finance_revenue_model: "split_70_30" | "company_100" | "custom"
      finance_source_type:
        | "order_paid"
        | "refund"
        | "manual_adjustment"
        | "expense"
        | "debt_repayment"
        | "payout"
      finance_transition_status: "normal" | "in_transition" | "transferred"
      inventory_unit_status: "active" | "maintenance" | "retired" | "lost"
      payment_status:
        | "unpaid"
        | "deposit_pending"
        | "partially_paid"
        | "paid"
        | "refunded"
      pricing_model: "premium" | "aggressive" | "weekly_flat" | "custom"
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
  public: {
    Enums: {
      app_role: ["admin", "user"],
      booking_status: [
        "nuevo",
        "confirmado",
        "preparacion",
        "alquiler",
        "finalizado",
        "cancelado",
        "pending_review",
        "awaiting_confirmation",
        "ready_for_pickup",
        "returned",
      ],
      finance_agreement_type: [
        "company_owned",
        "split_70_30",
        "custom_split",
        "concession",
      ],
      finance_entry_status: ["active", "reversed", "void"],
      finance_expense_kind: ["operational", "asset_purchase"],
      finance_expense_scope: ["company", "asset", "rental"],
      finance_origin_system: ["rental", "store", "services"],
      finance_origin_type: ["socio", "concession", "external", "company"],
      finance_owner_type: ["socio", "external", "concession", "company"],
      finance_payout_status: [
        "pending",
        "paid",
        "cancelled",
        "unpaid",
        "partially_paid",
      ],
      finance_revenue_model: ["split_70_30", "company_100", "custom"],
      finance_source_type: [
        "order_paid",
        "refund",
        "manual_adjustment",
        "expense",
        "debt_repayment",
        "payout",
      ],
      finance_transition_status: ["normal", "in_transition", "transferred"],
      inventory_unit_status: ["active", "maintenance", "retired", "lost"],
      payment_status: [
        "unpaid",
        "deposit_pending",
        "partially_paid",
        "paid",
        "refunded",
      ],
      pricing_model: ["premium", "aggressive", "weekly_flat", "custom"],
    },
  },
} as const
