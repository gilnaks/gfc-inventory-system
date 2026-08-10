import {
  getPoPaymentFieldConfig,
  type PoPaymentMethod,
} from '../../lib/po-purchaser-template'

type PoPaymentAccountFieldsProps = {
  paymentMethod: PoPaymentMethod | string | null | undefined
  accountName: string
  accountNumber: string
  onAccountNameChange: (value: string) => void
  onAccountNumberChange: (value: string) => void
  labelClassName?: string
  inputClassName?: string
}

export function PoPaymentAccountFields({
  paymentMethod,
  accountName,
  accountNumber,
  onAccountNameChange,
  onAccountNumberChange,
  labelClassName = 'block text-sm font-medium mb-1',
  inputClassName = 'w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500',
}: PoPaymentAccountFieldsProps) {
  const config = getPoPaymentFieldConfig(paymentMethod)

  if (!config.showAccountName && !config.showAccountNumber) {
    return (
      <p className="col-span-2 text-sm text-gray-500">
        No payee or account details are required for cash payments.
      </p>
    )
  }

  return (
    <>
      {config.showAccountName && (
        <div>
          <label className={labelClassName}>
            {config.accountNameLabel}
            {config.requireAccountName && ' *'}
          </label>
          <input
            type="text"
            value={accountName}
            onChange={(e) => onAccountNameChange(e.target.value)}
            className={`${inputClassName}${
              config.requireAccountName && !accountName.trim() ? ' border-red-300' : ''
            }`}
            placeholder={config.accountNamePlaceholder}
            required={config.requireAccountName}
          />
        </div>
      )}
      {config.showAccountNumber && (
        <div>
          <label className={labelClassName}>
            {config.accountNumberLabel}
            {config.requireAccountNumber && ' *'}
          </label>
          <input
            type="text"
            value={accountNumber}
            onChange={(e) => onAccountNumberChange(e.target.value)}
            className={`${inputClassName}${
              config.requireAccountNumber && !accountNumber.trim() ? ' border-red-300' : ''
            }`}
            placeholder={config.accountNumberPlaceholder}
            required={config.requireAccountNumber}
          />
        </div>
      )}
    </>
  )
}

export function applyPoPaymentMethodChange<
  T extends {
    payment_method: PoPaymentMethod
    payment_account_name: string
    payment_account_number: string
  },
>(prev: T, paymentMethod: PoPaymentMethod): T {
  const config = getPoPaymentFieldConfig(paymentMethod)
  return {
    ...prev,
    payment_method: paymentMethod,
    payment_account_name: config.showAccountName ? prev.payment_account_name : '',
    payment_account_number: config.showAccountNumber ? prev.payment_account_number : '',
  }
}
