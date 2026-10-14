export type Category = 'Cakes' | 'Pastries' | 'Desserts' | 'Special Treats'

export type ProductVariant = {
  label: string
  price: number
  sku?: string
}

export type Product = {
  id: string
  name: string
  slug: string
  category: Category
  description: string
  longDescription: string
  price: number
  image: string
  images?: string[]
  featured?: boolean
  bestseller?: boolean
  available: boolean
  stock: number
  variants?: ProductVariant[]
  customisationPrompt?: string
}

export type CartItem = {
  id: string
  name: string
  category: Category
  image: string
  variant: string
  unitPrice: number
  quantity: number
}

export type CheckoutFormValues = {
  fullName: string
  phone: string
  email?: string
  deliveryMethod: 'delivery' | 'pickup'
  address?: string
  preferredDate: string
  preferredTime: string
  notes?: string
}

export type CustomCakeFormValues = {
  eventType: string
  servings: string
  flavour: string
  design: string
  referenceImage?: string
  budget: string
  requiredDate: string
  customerName: string
  phone: string
  email?: string
  instructions?: string
}
