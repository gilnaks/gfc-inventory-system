'use client'

import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { FactoryNav } from '../FactoryNav'
import { FactoryBatchHistoryPanel } from '../../components/FactoryBatchHistoryPanel'

export default function FactoryHistoryPage() {
  return (
    <div className="min-h-[100dvh] min-h-screen bg-slate-100 flex flex-col overflow-x-hidden pb-[max(1rem,env(safe-area-inset-bottom))]">
      <header className="shrink-0 bg-slate-800 text-white">
        <div className="max-w-4xl mx-auto px-3 sm:px-4 py-3 sm:py-4 pt-[max(0.75rem,env(safe-area-inset-top))] flex items-center gap-3">
          <Link
            href="/dsir"
            className="flex items-center justify-center min-h-[44px] min-w-[44px] shrink-0 rounded-lg text-slate-300 hover:text-white hover:bg-slate-700/60 touch-manipulation"
            aria-label="Back"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div className="min-w-0 flex-1">
            <h1 className="text-lg sm:text-xl font-bold leading-tight">Batch history</h1>
            <p className="text-slate-300 text-xs sm:text-sm mt-0.5">
              All production batches, scans &amp; QR codes
            </p>
          </div>
        </div>
      </header>

      <FactoryNav />

      <main className="flex-1 max-w-4xl mx-auto w-full px-3 sm:px-4 py-4">
        <FactoryBatchHistoryPanel />
      </main>
    </div>
  )
}
