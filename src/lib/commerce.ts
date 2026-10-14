import type { CartItem } from '../types'

export const FREE_DELIVERY_THRESHOLD = 60_000
export const STANDARD_DELIVERY_FEE = 2_500

export function calculateOrderTotals(
  items: ReadonlyArray<Pick<CartItem, 'unitPrice' | 'quantity'>>,
  deliveryMethod: 'delivery' | 'pickup',
) {
  const subtotal = items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0)
  const deliveryFee =
    deliveryMethod === 'delivery' && subtotal <= FREE_DELIVERY_THRESHOLD
      ? STANDARD_DELIVERY_FEE
      : 0

  return { subtotal, deliveryFee, total: subtotal + deliveryFee }
}
