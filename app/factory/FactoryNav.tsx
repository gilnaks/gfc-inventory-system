'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Barcode, ClipboardList, History, Layers, Puzzle } from 'lucide-react'

const TABS = [
  { id: 'schedule', href: '/factory', label: 'Schedule', icon: ClipboardList, exact: true },
  { id: 'scan', href: '/factory/scan', label: 'Scan', icon: Barcode, exact: false },
  { id: 'history', href: '/factory/history', label: 'History', icon: History, exact: false },
  { id: 'components', href: '/factory/components', label: 'Components', icon: Puzzle, exact: false },
  { id: 'inventory', href: '/factory/inventory', label: 'Inventory', icon: Layers, exact: false },
] as const

function isTabActive(pathname: string, href: string, exact: boolean) {
  if (exact) return pathname === href
  return pathname === href || pathname.startsWith(`${href}/`)
}

export function FactoryNav() {
  const pathname = usePathname()

  return (
    <div className="sticky top-0 z-20 shrink-0 bg-slate-100 border-b border-slate-200 shadow-sm">
      <div className="max-w-4xl mx-auto px-3 sm:px-4 py-2">
        <nav
          className="grid grid-cols-5 gap-1.5 p-1 rounded-xl bg-white border border-slate-200"
          aria-label="Factory sections"
        >
          {TABS.map(({ id, href, label, icon: Icon, exact }) => {
            const active = isTabActive(pathname, href, exact)
            return (
              <Link
                key={id}
                href={href}
                className={`inline-flex flex-col items-center justify-center gap-1 min-h-[52px] px-1 py-2 rounded-lg text-[11px] sm:text-xs font-medium text-center leading-tight touch-manipulation transition-colors ${
                  active
                    ? 'bg-slate-800 text-white shadow-sm'
                    : 'text-gray-600 hover:bg-slate-50 active:bg-slate-100'
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span>{label}</span>
              </Link>
            )
          })}
        </nav>
      </div>
    </div>
  )
}
