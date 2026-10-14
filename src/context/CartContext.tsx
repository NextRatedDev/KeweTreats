import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import type { CartItem, Product } from '../types'

const CART_STORAGE_KEY = 'kewe-treats-cart'

type CartContextValue = {
  cart: CartItem[]
  addToCart: (product: Product, quantity: number, variantLabel: string) => void
  updateQuantity: (itemId: string, variant: string, quantity: number) => void
  removeFromCart: (itemId: string, variant: string) => void
  clearCart: () => void
  itemCount: number
  subtotal: number
}

const CartContext = createContext<CartContextValue | undefined>(undefined)

const getInitialCart = (): CartItem[] => {
  if (typeof window === 'undefined') {
    return []
  }

  try {
    const saved = window.localStorage.getItem(CART_STORAGE_KEY)
    return saved ? (JSON.parse(saved) as CartItem[]) : []
  } catch {
    return []
  }
}

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [cart, setCart] = useState<CartItem[]>(getInitialCart)

  useEffect(() => {
    window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart))
  }, [cart])

  const addToCart = (product: Product, quantity: number, variantLabel: string) => {
    const selectedVariant = product.variants?.find((variant) => variant.label === variantLabel) ?? {
      label: 'Standard',
      price: product.price,
    }

    setCart((current) => {
      const key = `${product.id}-${variantLabel}`
      const existing = current.find((item) => `${item.id}-${item.variant}` === key)

      if (existing) {
        return current.map((item) =>
          `${item.id}-${item.variant}` === key
            ? { ...item, quantity: item.quantity + quantity }
            : item,
        )
      }

      return [
        ...current,
        {
          id: product.id,
          name: product.name,
          category: product.category,
          image: product.image,
          variant: selectedVariant.label,
          unitPrice: selectedVariant.price,
          quantity,
        },
      ]
    })
  }

  const updateQuantity = (itemId: string, variant: string, quantity: number) => {
    if (quantity <= 0) {
      removeFromCart(itemId, variant)
      return
    }

    setCart((current) =>
      current.map((item) =>
        item.id === itemId && item.variant === variant ? { ...item, quantity } : item,
      ),
    )
  }

  const removeFromCart = (itemId: string, variant: string) => {
    setCart((current) => current.filter((item) => !(item.id === itemId && item.variant === variant)))
  }

  const clearCart = () => {
    setCart([])
  }

  const itemCount = useMemo(
    () => cart.reduce((total, item) => total + item.quantity, 0),
    [cart],
  )

  const subtotal = useMemo(
    () => cart.reduce((total, item) => total + item.unitPrice * item.quantity, 0),
    [cart],
  )

  const value = useMemo<CartContextValue>(
    () => ({ cart, addToCart, updateQuantity, removeFromCart, clearCart, itemCount, subtotal }),
    [cart, itemCount, subtotal],
  )

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>
}

export function useCart() {
  const context = useContext(CartContext)

  if (!context) {
    throw new Error('useCart must be used inside CartProvider')
  }

  return context
}
