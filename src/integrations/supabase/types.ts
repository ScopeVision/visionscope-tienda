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
          booking_id: string
          changes: Json
          created_at: string
          id: string
        }
        Insert: {
          action: string
          actor_user_id?: string | null
          booking_id: string
          changes?: Json
          created_at?: string
          id?: string
        }
        Update: {
          action?: string
          actor_user_id?: string | null
          booking_id?: string
          changes?: Json
          created_at?: string
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
          booking_id: string
          created_at: string
          days: number
          deposit: number
          discount_type: string
          discount_value: number
          id: string
          price_day: number
          price_override: number | null
          price_week: number | null
          product_id: string | null
          product_name: string
          quantity: number
          subtotal: number
          variant_id: string | null
        }
        Insert: {
          booking_id: string
          created_at?: string
          days?: number
          deposit?: number
          discount_type?: string
          discount_value?: number
          id?: string
          price_day?: number
          price_override?: number | null
          price_week?: number | null
          product_id?: string | null
          product_name: string
          quantity?: number
          subtotal?: number
          variant_id?: string | null
        }
        Update: {
          booking_id?: string
          created_at?: string
          days?: number
          deposit?: number
          discount_type?: string
          discount_value?: number
          id?: string
          price_day?: number
          price_override?: number | null
          price_week?: number | null
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
          payment_status: Database["public"]["Enums"]["payment_status"]
          reference: string
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
          payment_status?: Database["public"]["Enums"]["payment_status"]
          reference?: string
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
          payment_status?: Database["public"]["Enums"]["payment_status"]
          reference?: string
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
          orders_email: string
          updated_at: string
          whatsapp_url: string
        }
        Insert: {
          contact_email?: string
          id?: boolean
          instagram_url?: string
          orders_email?: string
          updated_at?: string
          whatsapp_url?: string
        }
        Update: {
          contact_email?: string
          id?: boolean
          instagram_url?: string
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
      [_ in never]: never
    }
    Functions: {
      available_stock: {
        Args: { _end: string; _product_id: string; _start: string }
        Returns: number
      }
      bootstrap_first_admin: { Args: { _user_id: string }; Returns: undefined }
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
      payment_status:
        | "unpaid"
        | "deposit_pending"
        | "partially_paid"
        | "paid"
        | "refunded"
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
      payment_status: [
        "unpaid",
        "deposit_pending",
        "partially_paid",
        "paid",
        "refunded",
      ],
    },
  },
} as const
