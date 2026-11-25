'use client'

import { useMemo, useState } from 'react'
import type { RecipeBook as RecipeBookData, RecipeMethod } from '../../../lib/recipes/types'

const METHOD_STYLES: Record<RecipeMethod, string> = {
  mix: 'bg-amber-100 text-amber-900',
  blend: 'bg-violet-100 text-violet-900',
  machine: 'bg-green-100 text-green-900',
  drizzle: 'bg-rose-100 text-rose-900',
  fold: 'bg-sky-100 text-sky-900',
}

function MethodChip({
  method,
  label,
}: {
  method: RecipeMethod
  label: string
}) {
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-1 text-xs font-semibold uppercase tracking-wide ${METHOD_STYLES[method]}`}
    >
      {label}
    </span>
  )
}

export function RecipeBook({ book }: { book: RecipeBookData }) {
  const [query, setQuery] = useState('')
  const labels = useMemo(() => {
    return Object.fromEntries(book.methods.map((method) => [method.method, method.label])) as Record<
      RecipeMethod,
      string
    >
  }, [book.methods])

  const flavors = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return book.flavors
    return book.flavors.filter((flavor) => flavor.name.toLowerCase().includes(q))
  }, [book.flavors, query])

  return (
    <div className="min-h-screen bg-stone-50 text-stone-900">
      <header className="bg-green-700 text-white">
        <div className="mx-auto max-w-5xl px-4 py-6 sm:py-8">
          <p className="text-sm font-semibold uppercase tracking-wider text-green-100">
            {book.brand}
          </p>
          <div className="mt-1 flex items-center gap-3">
            <h1 className="text-3xl font-bold sm:text-4xl">Recipes</h1>
            <p className="rounded-full bg-white/15 px-3 py-1 text-lg font-semibold">
              {book.yieldLabel}
            </p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-6">
        <section aria-label="Methods" className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
          {book.methods.map((method) => (
            <div key={method.method} className="rounded-xl border border-stone-200 bg-white p-3">
              <MethodChip method={method.method} label={method.label} />
              <p className="mt-2 text-sm leading-snug text-stone-700">{method.description}</p>
            </div>
          ))}
        </section>

        <section className="mt-6 rounded-2xl border border-green-200 bg-white p-4 shadow-sm sm:p-5">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-2xl font-bold">{book.base.name}</h2>
            <MethodChip method={book.base.method} label={labels[book.base.method]} />
          </div>
          <ul className="mt-4 space-y-3">
            {book.base.ingredients.map((item) => (
              <li key={item.name} className="flex flex-wrap items-baseline gap-x-3">
                <span className="text-xl font-bold text-green-800">{item.quantity}</span>
                <span className="text-lg">{item.name}</span>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-sm text-stone-600">{book.baseNote}</p>
        </section>

        <div className="sticky top-0 z-10 -mx-4 mt-6 border-b border-stone-200 bg-stone-50/95 px-4 py-3 backdrop-blur">
          <label className="block">
            <span className="sr-only">Search flavors</span>
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search flavors"
              className="w-full rounded-xl border border-stone-300 bg-white px-4 py-3 text-base text-stone-900 placeholder:text-stone-400"
            />
          </label>
          <p className="mt-2 text-sm text-stone-600">
            {flavors.length} {flavors.length === 1 ? 'flavor' : 'flavors'}
          </p>
        </div>

        {flavors.length === 0 ? (
          <p className="py-10 text-center text-stone-600">No flavor matches “{query.trim()}”.</p>
        ) : (
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            {flavors.map((flavor) => (
              <article
                key={flavor.name}
                className="rounded-2xl border border-stone-200 bg-white shadow-sm"
              >
                <h2 className="border-b border-stone-100 px-4 py-3 text-xl font-bold">{flavor.name}</h2>
                <ol className="space-y-2 p-3">
                  {flavor.steps.map((step, index) => {
                    const number = index + 1
                    if (step.kind === 'action') {
                      return (
                        <li
                          key={`${flavor.name}-${number}`}
                          className="flex items-center gap-3 rounded-xl bg-green-50 px-3 py-3"
                        >
                          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-green-700 text-sm font-bold text-white">
                            {number}
                          </span>
                          <span className="text-base font-semibold text-green-950">{step.label}</span>
                        </li>
                      )
                    }

                    return (
                      <li
                        key={`${flavor.name}-${number}`}
                        className="flex items-center gap-3 rounded-xl px-3 py-2"
                      >
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-stone-200 text-sm font-bold text-stone-800">
                          {number}
                        </span>
                        <div className="min-w-0 flex-1">
                          {step.quantity ? (
                            <p className="leading-tight">
                              <span className="text-lg font-bold">{step.quantity}</span>{' '}
                              <span className="text-base">{step.name}</span>
                            </p>
                          ) : (
                            <p className="text-base font-semibold">{step.name}</p>
                          )}
                        </div>
                        <MethodChip method={step.method} label={labels[step.method]} />
                      </li>
                    )
                  })}
                </ol>
              </article>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
