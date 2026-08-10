'use client'

import { createPortal } from 'react-dom'
import { useLayoutEffect, type ReactNode } from 'react'

type ModalAlign = 'center' | 'start' | 'end'

type ModalProps = {
  children: ReactNode
  onClose?: () => void
  zIndex?: number
  align?: ModalAlign
  /** Overrides default align positioning, e.g. "items-end sm:items-center" */
  positionClassName?: string
  contentClassName?: string
  backdropClassName?: string
}

const alignClasses: Record<ModalAlign, string> = {
  center: '',
  start: 'items-start',
  end: 'items-end',
}

export function Modal({
  children,
  onClose,
  zIndex = 50,
  align = 'center',
  positionClassName,
  contentClassName = 'p-4',
  backdropClassName = 'bg-black/50',
}: ModalProps) {
  const positionClass = positionClassName ?? alignClasses[align]

  useLayoutEffect(() => {
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth
    const previousOverflow = document.body.style.overflow
    const previousPaddingRight = document.body.style.paddingRight

    document.body.style.overflow = 'hidden'
    if (scrollbarWidth > 0) {
      document.body.style.paddingRight = `${scrollbarWidth}px`
    }

    return () => {
      document.body.style.overflow = previousOverflow
      document.body.style.paddingRight = previousPaddingRight
    }
  }, [])

  if (typeof document === 'undefined') return null

  return createPortal(
    <div className="fixed inset-0" style={{ zIndex }} role="presentation">
      <div
        className={`fixed inset-0 ${backdropClassName}`}
        onClick={onClose}
        aria-hidden="true"
      />
      <div className="fixed inset-0 overflow-y-auto overscroll-contain pointer-events-none">
        <div
          className={`flex min-h-full w-full justify-center pointer-events-auto ${positionClass} ${contentClassName}`}
          onClick={onClose}
        >
          <div
            className={`w-full flex justify-center${align === 'center' ? ' my-auto' : ''}`}
            onClick={(e) => e.stopPropagation()}
          >
            {children}
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}
