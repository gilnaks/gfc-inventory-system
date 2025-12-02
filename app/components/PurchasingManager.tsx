'use client'
import { useState } from 'react'
import { Brand } from '../../lib/supabase'

interface PurchasingManagerProps {
  selectedBrand?: Brand | null
  theme?: string
}

export function PurchasingManager({ selectedBrand, theme = 'blue' }: PurchasingManagerProps) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Purchase Order</h1>
        <p className="text-sm text-gray-600">Manage purchase orders and supplier transactions</p>
      </div>

      {/* Content will be added here */}
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <p className="text-gray-500 text-center py-8">Purchase Order management coming soon...</p>
      </div>
    </div>
  )
}

