'use client'

import { Scanner } from '@yudiel/react-qr-scanner'
import { Modal } from './Modal'

type TransferSheetQrScannerModalProps = {
  onClose: () => void
  onScan: (raw: string) => void
}

export function TransferSheetQrScannerModal({
  onClose,
  onScan,
}: TransferSheetQrScannerModalProps) {
  return (
    <Modal
      onClose={onClose}
      align="start"
      contentClassName="p-0"
      positionClassName="items-stretch"
      backdropClassName="bg-black"
    >
      <div className="relative w-screen h-[100dvh] bg-black">
        <Scanner
          formats={['qr_code']}
          constraints={{ facingMode: 'environment' }}
          styles={{
            container: {
              width: '100%',
              height: '100%',
              aspectRatio: 'auto',
            },
            video: {
              width: '100%',
              height: '100%',
              objectFit: 'cover',
            },
          }}
          onScan={(codes) => {
            const raw = codes?.[0]?.rawValue
            if (!raw) return
            onScan(raw)
          }}
          onError={() => {
            alert('Unable to access camera. Check browser permissions.')
            onClose()
          }}
        />
        <button
          type="button"
          onClick={onClose}
          className="absolute top-3 right-3 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-black/50 text-white text-2xl leading-none"
          aria-label="Close"
        >
          &times;
        </button>
      </div>
    </Modal>
  )
}
