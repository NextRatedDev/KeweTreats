import { describe, expect, it } from 'vitest'
import { calculateOrderTotals } from './commerce'

describe('calculateOrderTotals', () => {
  it('adds the standard delivery fee when a delivery order is at the free-delivery threshold', () => {
    expect(calculateOrderTotals([{ unitPrice: 20_000, quantity: 3 }], 'delivery')).toEqual({
      subtotal: 60_000,
      deliveryFee: 2_500,
      total: 62_500,
    })
  })

  it('waives delivery fee for orders above the threshold', () => {
    expect(calculateOrderTotals([{ unitPrice: 30_001, quantity: 2 }], 'delivery')).toEqual({
      subtotal: 60_002,
      deliveryFee: 0,
      total: 60_002,
    })
  })

  it('does not charge delivery on pickup orders', () => {
    expect(calculateOrderTotals([{ unitPrice: 4_500, quantity: 2 }], 'pickup')).toEqual({
      subtotal: 9_000,
      deliveryFee: 0,
      total: 9_000,
    })
  })

  it('totals multiple product lines', () => {
    expect(
      calculateOrderTotals(
        [
          { unitPrice: 3_500, quantity: 2 },
          { unitPrice: 7_000, quantity: 1 },
        ],
        'delivery',
      ),
    ).toEqual({ subtotal: 14_000, deliveryFee: 2_500, total: 16_500 })
  })
})
