import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'

export const supabase = createClientComponentClient()

export type Brand = {
  id: string
  name: string
  slug: string
  logo_url?: string
  created_at?: string
  updated_at?: string
}

export type Product = {
  id?: string
  product_id?: string
  brand_id: string
  name?: string
  product_name?: string
  sku?: string
  category?: string
  unit: string
  price?: number
  initial_stock?: number
  production?: number
  released?: number
  reserved?: number
  final_stock?: number
  available_stock?: number
  brand_name?: string
  brand_slug?: string
  created_at?: string
  updated_at?: string
}

export type DailyInventory = {
  id: string
  product_id: string
  date: string
  initial_stock: number
  production: number
  released: number
  reserved: number
  created_at?: string
  updated_at?: string
}

export type InventorySummary = DailyInventory & {
  product_name: string
  sku?: string
  brand_name: string
  brand_slug: string
  final_stock: number
  available_stock: number
}
