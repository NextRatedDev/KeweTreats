import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import { BrowserRouter, Link, NavLink, Outlet, Route, Routes, useNavigate, useParams } from 'react-router-dom'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { ChevronRight, Clock3, Gift, MapPin, Menu, MessageCircle, Minus, PackageCheck, Phone, Plus, Search, ShieldCheck, ShoppingBag, Sparkles, Store, Truck, X } from 'lucide-react'
import { Toaster, toast } from 'sonner'
import { CartProvider, useCart } from './context/CartContext'
import { mockProducts } from './data/mockProducts'
import { calculateOrderTotals } from './lib/commerce'
import { supabase } from './lib/supabase'
import type { Category, CheckoutFormValues, CustomCakeFormValues, Product } from './types'

const AdminPage = lazy(() => import('./admin/AdminPage'))
const WHATSAPP_NUMBER = '2349010468216'
const WHATSAPP_URL = `https://wa.me/${WHATSAPP_NUMBER}`
const INSTAGRAM_HANDLE = 'kewetreatsbakery'
const INSTAGRAM_URL = `https://www.instagram.com/${INSTAGRAM_HANDLE}/`

const navigation = [
  { label: 'Home', to: '/' },
  { label: 'Shop', to: '/shop' },
  { label: 'Cakes', to: '/shop?category=Cakes' },
  { label: 'Pastries', to: '/shop?category=Pastries' },
  { label: 'Desserts', to: '/shop?category=Desserts' },
  { label: 'Custom Orders', to: '/custom-cake' },
]

const categories: Category[] = ['Cakes', 'Pastries', 'Desserts', 'Special Treats']

const formatPrice = (value: number) =>
  new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    maximumFractionDigits: 0,
  }).format(value)

const getProductPrice = (product: Product, variantLabel?: string) => {
  const variant = product.variants?.find((item) => item.label === variantLabel)
  return variant ? variant.price : product.price
}

const computeOrderTotal = (items: ReturnType<typeof useCart>['cart'], deliveryMethod: 'delivery' | 'pickup') => {
  return calculateOrderTotals(items, deliveryMethod)
}

const productSchema = z.object({
  fullName: z.string().min(2, 'Please add your full name.'),
  phone: z.string().min(8, 'Please add a valid phone number.'),
  email: z.string().email('Please add a valid email address.').optional().or(z.literal('')),
  deliveryMethod: z.enum(['delivery', 'pickup']),
  address: z.string().optional().or(z.literal('')),
  preferredDate: z.string().min(1, 'Choose a preferred date.'),
  preferredTime: z.string().min(1, 'Choose a preferred time.'),
  notes: z.string().optional().or(z.literal('')),
})

const customCakeSchema = z.object({
  eventType: z.string().min(1, 'Choose an event type.'),
  servings: z.string().min(1, 'Tell us how many servings you need.'),
  flavour: z.string().min(1, 'Pick a preferred flavour.'),
  design: z.string().min(1, 'Please add your design preferences.'),
  referenceImage: z.string().optional().or(z.literal('')),
  budget: z.string().min(1, 'Choose a budget range.'),
  requiredDate: z.string().min(1, 'Choose the required date.'),
  customerName: z.string().min(2, 'Please add your name.'),
  phone: z.string().min(8, 'Please add a phone number.'),
  email: z.string().email('Please add a valid email address.').optional().or(z.literal('')),
  instructions: z.string().optional().or(z.literal('')),
})

async function fetchProducts(): Promise<Product[]> {
  if (!supabase) return mockProducts

  const { data, error } = await supabase.from('products').select('*').order('created_at', { ascending: false })
  if (error) throw error

  return (data ?? []).map((product) => ({
    id: product.id,
    name: product.name,
    slug: product.slug ?? product.name.toLowerCase().replace(/\s+/g, '-'),
    category: product.category ?? 'Cakes',
    description: product.description ?? 'Freshly made to order.',
    longDescription: product.long_description ?? product.description ?? 'Freshly made to order.',
    price: Number(product.price ?? 0),
    image: product.image ?? product.images?.[0] ?? 'https://images.unsplash.com/photo-1559620192-032c4bc4674e',
    images: product.images ?? [],
    featured: Boolean(product.featured),
    bestseller: Boolean(product.bestseller),
    available: product.available ?? true,
    stock: Number(product.stock ?? 0),
    variants: Array.isArray(product.variants) ? product.variants : [{ label: 'Standard', price: Number(product.price ?? 0) }],
    customisationPrompt: product.customisation_prompt ?? undefined,
  }))
}

function App() {
  return (
    <BrowserRouter>
      <CartProvider>
        <div className="min-h-screen bg-cream text-ink antialiased">
          <Toaster position="top-right" richColors closeButton theme="light" />
          <Routes>
            <Route path="/" element={<Layout />}>
              <Route index element={<HomePage />} />
              <Route path="shop" element={<ShopPage />} />
              <Route path="shop/:slug" element={<ProductPage />} />
              <Route path="cart" element={<CartPage />} />
              <Route path="checkout/:orderRef" element={<OrderConfirmationPage />} />
              <Route path="custom-cake" element={<CustomCakePage />} />
              <Route path="about" element={<AboutPage />} />
              <Route path="contact" element={<ContactPage />} />
              <Route path="privacy-policy" element={<PolicyPage />} />
              <Route path="terms" element={<PolicyPage />} />
              <Route
                path="admin"
                element={
                  <Suspense fallback={<div className="mx-auto max-w-7xl px-4 py-16 text-center text-red-800">Loading staff portal…</div>}>
                    <AdminPage />
                  </Suspense>
                }
              />
              <Route path="*" element={<NotFoundPage />} />
            </Route>
          </Routes>
        </div>
      </CartProvider>
    </BrowserRouter>
  )
}

function Layout() {
  const [menuOpen, setMenuOpen] = useState(false)
  const { itemCount } = useCart()

  return (
    <>
      <div className="bg-deepRed px-4 py-2 text-center text-sm font-medium text-white">
        Free delivery on orders above ₦60,000 in Lagos, or collect from our bakery.
      </div>

      <header className="sticky top-0 z-50 border-b border-red-100 bg-white/95 backdrop-blur-sm">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
          <Link to="/" className="flex items-center gap-3">
            <img
              src="/kewe-treats-logo.jpeg"
              alt=""
              className="h-12 w-12 rounded-xl object-cover shadow-md ring-2 ring-brandGold"
            />
            <div className="leading-none">
              <div className="font-brand text-3xl font-bold italic tracking-tight text-red-700 sm:text-4xl">Kewe Treats</div>
              <div className="mt-1 font-brand italic text-xs tracking-wide text-red-500">Lingering Satisfaction. Memories Made</div>
            </div>
          </Link>

          <nav className="hidden items-center gap-6 lg:flex">
            {navigation.map((item) => (
              <NavLink
                key={item.label}
                to={item.to}
                className={({ isActive }) =>
                  `text-sm font-medium transition ${isActive ? 'text-red-600' : 'text-ink hover:text-red-500'}`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>

          <div className="hidden items-center gap-3 lg:flex">
            <button type="button" aria-label="Search products" className="rounded-full border border-red-100 p-2 text-red-600 transition hover:border-red-200 hover:bg-red-50">
              <Search className="h-5 w-5" />
            </button>
            <Link to="/cart" aria-label="Shopping cart" className="relative rounded-full border border-red-100 bg-red-50 p-2 text-red-700 transition hover:bg-red-100">
              <ShoppingBag className="h-5 w-5" />
              <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-brandGold px-1 text-[10px] font-bold text-red-700">
                {itemCount}
              </span>
            </Link>
          </div>

          <button
            type="button"
            aria-label="Open menu"
            className="rounded-full border border-red-100 p-2 text-red-700 lg:hidden"
            onClick={() => setMenuOpen((state) => !state)}
          >
            {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>

        {menuOpen && (
          <div className="border-t border-red-100 bg-white px-4 py-4 lg:hidden">
            <nav className="flex flex-col gap-3">
              {navigation.map((item) => (
                <NavLink
                  key={item.label}
                  to={item.to}
                  className={({ isActive }) =>
                    `rounded-md px-2 py-2 text-sm font-medium ${isActive ? 'bg-red-50 text-red-700' : 'text-ink hover:bg-red-50 hover:text-red-600'}`
                  }
                  onClick={() => setMenuOpen(false)}
                >
                  {item.label}
                </NavLink>
              ))}
            </nav>
            <div className="mt-4 flex items-center justify-between border-t border-red-100 pt-4">
              <button type="button" className="rounded-full border border-red-100 p-2 text-red-600">
                <Search className="h-4 w-4" />
              </button>
              <Link to="/cart" onClick={() => setMenuOpen(false)} className="flex items-center gap-2 rounded-full bg-red-100 px-3 py-2 text-sm font-medium text-red-700">
                Cart <span className="rounded-full bg-brandGold px-2 py-0.5 text-[10px] text-red-700">{itemCount}</span>
              </Link>
            </div>
          </div>
        )}
      </header>

      <main>
        <Outlet />
      </main>

      <footer className="bg-deepRed text-white">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 py-12 sm:px-6 lg:grid-cols-5 lg:px-8">
          <div className="lg:col-span-2">
            <div className="mb-4 flex items-center gap-3">
              <img
                src="/kewe-treats-logo.jpeg"
                alt=""
                className="h-12 w-12 rounded-xl object-cover shadow-md ring-2 ring-brandGold"
              />
              <div className="leading-none">
                <div className="font-brand text-3xl font-bold italic tracking-tight text-red-600 sm:text-4xl">Kewe Treats</div>
                <div className="mt-1 font-brand italic text-xs tracking-wide text-red-300">Lingering Satisfaction. Memories Made</div>
              </div>
            </div>
            <p className="max-w-md text-sm text-red-100">
              Handcrafted cakes, pastries, and desserts made to turn sweet moments into unforgettable memories.
            </p>
            <div className="mt-4 flex items-center gap-4 text-sm text-red-100">
              <a href={`tel:+${WHATSAPP_NUMBER}`} className="hover:text-white">+234 901 046 8216</a>
              <a href={WHATSAPP_URL} target="_blank" rel="noreferrer" className="hover:text-white">WhatsApp</a>
              <a href={INSTAGRAM_URL} target="_blank" rel="noreferrer" className="hover:text-white">Instagram</a>
            </div>
          </div>

          <div>
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-[0.2em] text-brandGold">Explore</h3>
            <ul className="space-y-2 text-sm text-red-100">
              <li><Link to="/shop">Shop</Link></li>
              <li><Link to="/about">About</Link></li>
              <li><Link to="/contact">Contact</Link></li>
              <li><Link to="/custom-cake">Custom orders</Link></li>
            </ul>
          </div>

          <div>
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-[0.2em] text-brandGold">Policies</h3>
            <ul className="space-y-2 text-sm text-red-100">
              <li><Link to="/privacy-policy">Privacy policy</Link></li>
              <li><Link to="/terms">Terms & conditions</Link></li>
              <li><Link to="/admin">Staff portal</Link></li>
            </ul>
          </div>

          <div>
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-[0.2em] text-brandGold">Visit us</h3>
            <ul className="space-y-2 text-sm text-red-100">
              <li>12 Broad Street, Lagos</li>
              <li>Mon - Sat: 8:00 AM - 7:00 PM</li>
              <li>Sun: 9:00 AM - 4:00 PM</li>
            </ul>
          </div>
        </div>

        <div className="border-t border-white/10 py-4 text-center text-sm text-red-100">
          © 2026 Kewe Treats. Crafted with love and a little sparkle.
        </div>
      </footer>

      <a
        href={`${WHATSAPP_URL}?text=Hello%20Kewe%20Treats%2C%20I%20would%20like%20to%20place%20an%20order.`}
        target="_blank"
        rel="noreferrer"
        aria-label="Chat on WhatsApp"
        className="fixed bottom-5 right-5 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-[#25D366] text-white shadow-xl transition hover:scale-105"
      >
        <MessageCircle className="h-6 w-6" />
      </a>
    </>
  )
}

function HomePage() {
  const [products, setProducts] = useState<Product[]>([])

  useEffect(() => {
    fetchProducts()
      .then(setProducts)
      .catch((error: unknown) => toast.error(`Could not load featured products: ${error instanceof Error ? error.message : 'Please try again.'}`))
  }, [])

  const bestsellers = products.filter((product) => product.bestseller).slice(0, 4)

  return (
    <>
      <section className="relative overflow-hidden bg-hero-pattern">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 py-16 sm:px-6 lg:grid-cols-[1.1fr_0.9fr] lg:px-8 lg:py-20">
          <div className="flex flex-col justify-center">
            <div className="mb-4 inline-flex w-fit items-center gap-2 rounded-full bg-red-50 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.2em] text-red-700">
              <Sparkles className="h-3.5 w-3.5" />
              Freshly baked daily
            </div>
            <h1 className="font-display text-4xl leading-tight text-ink sm:text-5xl lg:text-6xl">
              Every Celebration Deserves Something Special.
            </h1>
            <p className="mt-6 max-w-xl text-lg text-red-950/80">
              Handcrafted cakes, irresistible pastries, and delightful desserts made to turn your sweetest moments into lasting memories.
            </p>
            <div className="mt-8 flex flex-wrap gap-4">
              <Link to="/shop" className="inline-flex items-center gap-2 rounded-full bg-red-600 px-6 py-3 text-sm font-semibold text-white shadow-soft transition hover:bg-red-700">
                Explore Our Treats <ChevronRight className="h-4 w-4" />
              </Link>
              <Link to="/custom-cake" className="inline-flex items-center gap-2 rounded-full border border-red-200 bg-white px-6 py-3 text-sm font-semibold text-red-700 transition hover:border-red-300 hover:bg-red-50">
                Order a Custom Cake
              </Link>
            </div>
          </div>

          <div className="relative">
            <div className="absolute -left-7 top-10 h-40 w-40 rounded-full bg-brandGold/30 blur-3xl" />
            <div className="absolute -right-6 bottom-6 h-40 w-40 rounded-full bg-red-200/40 blur-3xl" />
            <div className="relative overflow-hidden rounded-[2rem] border border-red-100 bg-white p-3 shadow-soft">
              <img
                src="https://images.unsplash.com/photo-1559620192-032c4bc4674e?auto=format&fit=crop&w=1200&q=80"
                alt="Celebration cake"
                className="h-[500px] w-full rounded-[1.6rem] object-cover"
              />
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="mb-8 flex items-end justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-red-600">Shop by category</p>
            <h2 className="mt-2 font-display text-3xl text-ink">Our signature collections</h2>
          </div>
        </div>

        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
          {[
            { title: 'Cakes', text: 'Statement pieces for milestones and celebrations.', image: 'https://images.unsplash.com/photo-1559620192-032c4bc4674e' },
            { title: 'Pastries', text: 'Buttery, flaky, and baked to order.', image: 'https://images.unsplash.com/photo-1555507036-ab1f4038808a' },
            { title: 'Desserts', text: 'Sweet finales with beautiful finishing touches.', image: 'https://images.unsplash.com/photo-1533134242443-d4fd215305ad' },
            { title: 'Special Treats', text: 'Curated sweets designed for gifting and sharing.', image: 'https://images.unsplash.com/photo-1464306076886-da185f6a9d8d' },
          ].map((item) => (
            <Link key={item.title} to={`/shop?category=${encodeURIComponent(item.title)}`} className="group overflow-hidden rounded-[1.5rem] border border-red-100 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-soft">
              <div className="overflow-hidden">
                <img src={item.image} alt={item.title} className="h-56 w-full object-cover transition duration-500 group-hover:scale-105" />
              </div>
              <div className="p-5">
                <h3 className="font-display text-2xl text-ink">{item.title}</h3>
                <p className="mt-2 text-sm text-red-900/70">{item.text}</p>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section className="bg-white py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mb-8 flex items-end justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-red-600">Bestsellers</p>
              <h2 className="mt-2 font-display text-3xl text-ink">Customer favourites this week</h2>
            </div>
            <Link to="/shop" className="text-sm font-semibold text-red-700">Browse all treats</Link>
          </div>

          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
            {bestsellers.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="overflow-hidden rounded-[2rem] bg-red-700 text-white">
          <div className="grid gap-8 lg:grid-cols-[1fr_0.9fr]">
            <div className="p-8 lg:p-12">
              <p className="text-sm font-semibold uppercase tracking-[0.22em] text-brandGold">Celebrations made easy</p>
              <h2 className="mt-3 font-display text-3xl text-white sm:text-4xl">From intimate birthdays to grand celebrations</h2>
              <p className="mt-4 max-w-lg text-red-100">
                Bring your vision to life with tailored cake designs, elegant finishing touches, and seasonal flavour combinations.
              </p>
              <Link to="/custom-cake" className="mt-8 inline-flex items-center gap-2 rounded-full bg-brandGold px-5 py-3 text-sm font-semibold text-red-800 transition hover:bg-yellow-300">
                Request a custom cake <ChevronRight className="h-4 w-4" />
              </Link>
            </div>

            <div className="relative h-full min-h-[260px]">
              <img
                src="https://images.unsplash.com/photo-1521305916504-4a1121188589?auto=format&fit=crop&w=1200&q=80"
                alt="Celebration cake"
                className="h-full w-full object-cover"
              />
            </div>
          </div>
        </div>
      </section>

      <section className="bg-[#FFF1D7] py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mb-8 text-center">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-red-600">Why choose us</p>
            <h2 className="mt-2 font-display text-3xl text-ink">A bakery experience worth celebrating</h2>
          </div>

          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
            {[
              { title: 'Quality ingredients', icon: <Gift className="h-6 w-6" />, text: 'Carefully selected ingredients for flavour that feels indulgent and fresh.' },
              { title: 'Beautiful presentation', icon: <Sparkles className="h-6 w-6" />, text: 'Every order is styled to look as delicious as it tastes.' },
              { title: 'Freshly prepared', icon: <PackageCheck className="h-6 w-6" />, text: 'Made in small batches so your treats feel personal and handcrafted.' },
              { title: 'Personalised orders', icon: <ShieldCheck className="h-6 w-6" />, text: 'We work with you on flavour, style, and finishing details.' },
            ].map((feature) => (
              <div key={feature.title} className="rounded-[1.5rem] border border-red-100 bg-white p-6 text-center shadow-sm">
                <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-50 text-red-700">{feature.icon}</div>
                <h3 className="font-display text-2xl text-ink">{feature.title}</h3>
                <p className="mt-3 text-sm text-red-900/75">{feature.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="mb-8 flex items-end justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-red-600">Featured treats</p>
            <h2 className="mt-2 font-display text-3xl text-ink">A little something for every craving</h2>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          {products.slice(0, 3).map((product) => (
            <ProductCard key={product.id} product={product} compact />
          ))}
        </div>
      </section>

      <section className="bg-white py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid gap-8 lg:grid-cols-[1.2fr_0.8fr]">
            <div className="rounded-[2rem] bg-red-50 p-8 lg:p-10">
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-red-600">Need something custom?</p>
              <h2 className="mt-3 font-display text-3xl text-ink">Tell us about your dream cake.</h2>
              <p className="mt-4 max-w-xl text-red-900/75">
                Whether it is a birthday, anniversary, wedding, or a thoughtful gift, we will help you shape the perfect design and flavour combination.
              </p>
              <Link to="/custom-cake" className="mt-7 inline-flex items-center gap-2 rounded-full bg-red-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-red-700">
                Start your enquiry <ChevronRight className="h-4 w-4" />
              </Link>
            </div>

            <div className="rounded-[2rem] border border-red-100 bg-white p-8 shadow-soft">
              <div className="mb-6 flex items-center gap-3">
                <Store className="h-5 w-5 text-red-600" />
                <h3 className="font-display text-2xl text-ink">@{INSTAGRAM_HANDLE}</h3>
              </div>
              <div className="grid grid-cols-3 gap-3">
                {[
                  'https://images.unsplash.com/photo-1517433670267-08bbd4be890f',
                  'https://images.unsplash.com/photo-1521305916504-4a1121188589',
                  'https://images.unsplash.com/photo-1559620192-032c4bc4674e',
                ].map((image, index) => (
                  <img key={image + index} src={image} alt="Kewe Treats social post" className="h-28 w-full rounded-xl object-cover" />
                ))}
              </div>
              <a href={INSTAGRAM_URL} target="_blank" rel="noreferrer" className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-red-700">
                View on Instagram <ChevronRight className="h-4 w-4" />
              </a>
            </div>
          </div>
        </div>
      </section>
    </>
  )
}

function ShopPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('All')
  const [sortBy, setSortBy] = useState('featured')
  const [page, setPage] = useState(1)

  useEffect(() => {
    let ignore = false
    setLoading(true)
    fetchProducts()
      .then((catalogue) => {
        if (!ignore) {
          setProducts(catalogue)
          setError(null)
        }
      })
      .catch(() => {
        if (!ignore) {
          setError('We could not load the bakery catalogue right now. Please try again in a moment.')
        }
      })
      .finally(() => {
        if (!ignore) setLoading(false)
      })

    return () => {
      ignore = true
    }
  }, [])

  const params = new URLSearchParams(window.location.search)
  const categoryFromUrl = params.get('category')

  useEffect(() => {
    if (categoryFromUrl) {
      setSelectedCategory(categoryFromUrl)
    }
  }, [categoryFromUrl])

  const filteredProducts = useMemo(() => {
    const lowerQuery = query.trim().toLowerCase()
    const byCategory = selectedCategory === 'All' ? products : products.filter((product) => product.category === selectedCategory)

    const bySearch = lowerQuery
      ? byCategory.filter((product) => product.name.toLowerCase().includes(lowerQuery))
      : byCategory

    const sorted = [...bySearch].sort((left, right) => {
      if (sortBy === 'price-low') return left.price - right.price
      if (sortBy === 'price-high') return right.price - left.price
      if (sortBy === 'newest') return Number(right.id.replace(/\D/g, '')) - Number(left.id.replace(/\D/g, ''))
      return Number(right.featured) - Number(left.featured)
    })

    return sorted
  }, [query, products, selectedCategory, sortBy])

  const pageSize = 6
  const displayedProducts = filteredProducts.slice(0, page * pageSize)
  const hasMore = displayedProducts.length < filteredProducts.length

  if (loading) {
    return <PageShell title="Shop" subtitle="Handcrafted treats made fresh each day"><ProductSkeletons /></PageShell>
  }

  return (
    <PageShell title="Shop" subtitle="Browse our handcrafted breads, cakes, pastries and desserts.">
      <div className="mb-8 rounded-[1.5rem] border border-red-100 bg-white p-4 shadow-sm">
        <div className="grid gap-4 lg:grid-cols-[1fr_auto_auto]">
          <label className="flex items-center gap-3 rounded-full border border-red-100 bg-cream px-4 py-3 text-sm text-red-900">
            <Search className="h-4 w-4 text-red-500" />
            <input
              value={query}
              onChange={(event) => {
                setQuery(event.target.value)
                setPage(1)
              }}
              placeholder="Search treats"
              aria-label="Search products"
              className="w-full border-0 bg-transparent text-sm text-red-900 outline-none placeholder:text-red-400"
            />
          </label>

          <select
            value={selectedCategory}
            onChange={(event) => {
              setSelectedCategory(event.target.value)
              setPage(1)
            }}
            className="rounded-full border border-red-100 bg-cream px-4 py-3 text-sm text-red-900 outline-none"
            aria-label="Filter by category"
          >
            <option value="All">All categories</option>
            {categories.map((category) => (
              <option key={category} value={category}>{category}</option>
            ))}
          </select>

          <select
            value={sortBy}
            onChange={(event) => setSortBy(event.target.value)}
            aria-label="Sort products"
            className="rounded-full border border-red-100 bg-cream px-4 py-3 text-sm text-red-900 outline-none"
          >
            <option value="featured">Featured first</option>
            <option value="newest">Newest additions</option>
            <option value="price-low">Price: low to high</option>
            <option value="price-high">Price: high to low</option>
          </select>
        </div>
      </div>

      {error ? (
        <div className="rounded-[1.5rem] border border-red-200 bg-red-50 px-4 py-6 text-red-800">{error}</div>
      ) : filteredProducts.length === 0 ? (
        <div className="rounded-[1.5rem] border border-dashed border-red-200 bg-white px-6 py-12 text-center">
          <h3 className="font-display text-2xl text-ink">No treats matched your search.</h3>
          <p className="mt-2 text-red-900/70">Try another keyword or switch back to all categories.</p>
        </div>
      ) : (
        <>
          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {displayedProducts.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>

          {hasMore && (
            <div className="mt-8 text-center">
              <button
                type="button"
                className="rounded-full bg-red-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-red-700"
                onClick={() => setPage((current) => current + 1)}
              >
                Load more treats
              </button>
            </div>
          )}
        </>
      )}
    </PageShell>
  )
}

function ProductPage() {
  const { slug } = useParams()
  const navigate = useNavigate()
  const { addToCart } = useCart()
  const [products, setProducts] = useState<Product[]>([])
  const [selectedVariant, setSelectedVariant] = useState('')
  const [quantity, setQuantity] = useState(1)

  useEffect(() => {
    fetchProducts()
      .then(setProducts)
      .catch((error: unknown) => toast.error(`Could not load this product: ${error instanceof Error ? error.message : 'Please try again.'}`))
  }, [])

  const product = products.find((item) => item.slug === slug)

  useEffect(() => {
    if (product?.variants && product.variants.length > 0) {
      setSelectedVariant(product.variants[0].label)
    }
  }, [product])

  if (!product) {
    return (
      <PageShell title="Product not found" subtitle="The item you were after is not available right now.">
        <div className="rounded-[1.5rem] border border-dashed border-red-200 bg-white px-6 py-12 text-center">
          <p className="text-red-900/80">This product does not exist or has been removed.</p>
          <button type="button" onClick={() => navigate('/shop')} className="mt-5 rounded-full bg-red-600 px-5 py-3 text-sm font-semibold text-white">
            Back to shop
          </button>
        </div>
      </PageShell>
    )
  }

  const price = getProductPrice(product, selectedVariant)
  const relatedProducts = products.filter((item) => item.category === product.category && item.id !== product.id).slice(0, 3)

  return (
    <PageShell title={product.name} subtitle={product.category}>
      <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
        <div>
          <div className="overflow-hidden rounded-[2rem] border border-red-100 bg-white p-3 shadow-sm">
            <img src={product.image} alt={product.name} className="h-[430px] w-full rounded-[1.5rem] object-cover" />
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3">
            {(product.images?.length ? product.images : [product.image]).map((image) => (
              <img key={image} src={image} alt={product.name} className="h-32 w-full rounded-[1.2rem] object-cover" />
            ))}
          </div>
        </div>

        <div className="rounded-[2rem] border border-red-100 bg-white p-6 shadow-soft sm:p-8">
          <div className="mb-4 flex items-center justify-between gap-3">
            <span className="rounded-full bg-red-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-red-700">
              {product.category}
            </span>
            {product.available ? (
              <span className="rounded-full bg-green-50 px-2.5 py-1 text-xs font-semibold text-green-700">Available</span>
            ) : (
              <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700">Sold out</span>
            )}
          </div>

          <h2 className="font-display text-4xl text-ink">{product.name}</h2>
          <p className="mt-4 text-red-900/80">{product.longDescription}</p>

          <div className="mt-6 flex items-baseline gap-2">
            <span className="font-display text-4xl text-red-700">{formatPrice(price)}</span>
            <span className="text-sm text-red-900/60">{product.stock} available</span>
          </div>

          {product.variants && product.variants.length > 0 && (
            <div className="mt-6">
              <p className="mb-2 text-sm font-semibold uppercase tracking-[0.2em] text-red-700">Choose a size</p>
              <div className="flex flex-wrap gap-2">
                {product.variants.map((variant) => (
                  <button
                    key={variant.label}
                    type="button"
                    onClick={() => setSelectedVariant(variant.label)}
                    className={`rounded-full border px-4 py-2 text-sm font-medium transition ${selectedVariant === variant.label ? 'border-red-600 bg-red-600 text-white' : 'border-red-200 bg-white text-red-700'}`}
                  >
                    {variant.label} · {formatPrice(variant.price)}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="mt-6 flex items-center gap-4">
            <div className="flex items-center rounded-full border border-red-200 bg-cream">
              <button type="button" className="p-3 text-red-700" aria-label="Decrease quantity" onClick={() => setQuantity((value) => Math.max(1, value - 1))}>
                <Minus className="h-4 w-4" />
              </button>
              <span className="min-w-10 text-center text-sm font-semibold text-red-700">{quantity}</span>
              <button type="button" className="p-3 text-red-700" aria-label="Increase quantity" disabled={quantity >= product.stock} onClick={() => setQuantity((value) => Math.min(product.stock, value + 1))}>
                <Plus className="h-4 w-4" />
              </button>
            </div>

            <button
              type="button"
              onClick={() => {
                if (!product.available || product.stock < quantity) {
                  toast.error('This item is not available right now.')
                  return
                }
                addToCart(product, quantity, selectedVariant || 'Standard')
                toast.success(`${product.name} added to cart.`)
              }}
              disabled={!product.available || product.stock < quantity}
              className="flex-1 rounded-full bg-red-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Add to cart
            </button>
          </div>

          <div className="mt-5 flex flex-wrap gap-3">
            <a
              href={`${WHATSAPP_URL}?text=${encodeURIComponent(`Hello Kewe Treats, I would like to order ${product.name} (${selectedVariant || 'Standard'}) for ${quantity} item(s).`)}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-full border border-green-200 bg-green-50 px-5 py-3 text-sm font-semibold text-green-700"
            >
              <MessageCircle className="h-4 w-4" />
              Order via WhatsApp
            </a>
          </div>

          {product.customisationPrompt && (
            <div className="mt-6 rounded-[1.2rem] border border-dashed border-red-200 bg-red-50 p-4 text-sm text-red-900/85">
              {product.customisationPrompt}
            </div>
          )}
        </div>
      </div>

      <div className="mt-14">
        <h3 className="mb-6 font-display text-3xl text-ink">Related products</h3>
        <div className="grid gap-6 md:grid-cols-3">
          {relatedProducts.map((item) => (
            <ProductCard key={item.id} product={item} compact />
          ))}
        </div>
      </div>
    </PageShell>
  )
}

function CartPage() {
  const { cart, subtotal, removeFromCart, updateQuantity, clearCart } = useCart()
  const navigate = useNavigate()
  const [catalogue, setCatalogue] = useState<Product[]>([])
  const [catalogueStatus, setCatalogueStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [catalogueError, setCatalogueError] = useState<string | null>(null)
  const [submissionError, setSubmissionError] = useState<string | null>(null)

  const refreshCatalogue = useCallback(async () => {
    setCatalogueStatus('loading')
    setCatalogueError(null)
    try {
      setCatalogue(await fetchProducts())
      setCatalogueStatus('ready')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Please try again.'
      setCatalogueError(`Could not verify current product prices: ${message}`)
      setCatalogueStatus('error')
    }
  }, [])

  useEffect(() => {
    void refreshCatalogue()
  }, [refreshCatalogue])

  const checkoutSchema = useMemo(
    () =>
      productSchema.superRefine((values, ctx) => {
        if (values.deliveryMethod === 'delivery' && !(values.address ?? '').trim()) {
          ctx.addIssue({
            path: ['address'],
            code: 'custom',
            message: 'Delivery address is required for delivery orders.',
          })
        }
      }),
    [],
  )

  const { register, handleSubmit, watch, formState: { errors, isSubmitting } } = useForm<CheckoutFormValues>({
    resolver: zodResolver(checkoutSchema),
    defaultValues: {
      fullName: '',
      phone: '',
      email: '',
      deliveryMethod: 'pickup',
      address: '',
      preferredDate: '',
      preferredTime: '',
      notes: '',
    },
  })
  const deliveryMethod = watch('deliveryMethod')
  const deliveryAddress = watch('address')
  const { deliveryFee, total } = computeOrderTotal(cart, deliveryMethod)

  const validateAgainstDatabase = () => {
    const productMap = new Map(catalogue.map((product) => [product.id, product]))
    let valid = true

    cart.forEach((item) => {
      const product = productMap.get(item.id)
      if (!product || !product.available || product.stock < item.quantity) {
        valid = false
        return
      }

      const expectedPrice = getProductPrice(product, item.variant)
      if (expectedPrice !== item.unitPrice) {
        valid = false
      }
    })

    return valid
  }

  const submitWebsiteOrder = async (values: CheckoutFormValues) => {
    setSubmissionError(null)
    if (catalogueStatus !== 'ready') {
      setSubmissionError(catalogueError ?? 'Please wait while we verify current product prices.')
      return
    }

    if (!validateAgainstDatabase()) {
      const message = 'A product is unavailable, out of stock, or its price changed. Please refresh the catalogue and review your cart.'
      setSubmissionError(message)
      toast.error(message)
      return
    }

    try {
      let orderReference = `KT-${Date.now().toString().slice(-6)}`
      if (supabase) {
        const { data, error } = await supabase.rpc('submit_customer_order', {
          p_customer_name: values.fullName,
          p_phone: values.phone,
          p_email: values.email || null,
          p_delivery_method: values.deliveryMethod,
          p_address: values.deliveryMethod === 'delivery' ? values.address || null : null,
          p_preferred_date: values.preferredDate,
          p_preferred_time: values.preferredTime,
          p_notes: values.notes || null,
          p_items: cart.map((item) => ({
            product_id: item.id,
            variant: item.variant,
            quantity: item.quantity,
          })),
        })
        if (error) throw error
        if (!data || typeof data !== 'object' || !('order_reference' in data) || typeof data.order_reference !== 'string') {
          throw new Error('The order was saved but no order reference was returned.')
        }
        orderReference = data.order_reference
      } else {
        window.localStorage.setItem(
          `kewe-order-${orderReference}`,
          JSON.stringify({
            order_reference: orderReference,
            customer_name: values.fullName,
            phone: values.phone,
            email: values.email || null,
            delivery_method: values.deliveryMethod,
            address: values.deliveryMethod === 'delivery' ? values.address || null : null,
            preferred_date: values.preferredDate,
            preferred_time: values.preferredTime,
            notes: values.notes || null,
            subtotal,
            delivery_fee: deliveryFee,
            total,
            status: 'pending',
            paid: false,
            items: cart,
          }),
        )
      }

      toast.success(`Order ${orderReference} received. We'll confirm it shortly.`)
      clearCart()
      navigate(`/checkout/${orderReference}`)
    } catch (error) {
      const message = `Unable to save the order: ${error instanceof Error ? error.message : 'Please try again.'}`
      setSubmissionError(message)
      toast.error(message)
    }
  }

  const notifyInvalidOrder = (validationErrors: typeof errors) => {
    const firstError = Object.values(validationErrors).find((error) => error?.message)
    toast.error(typeof firstError?.message === 'string' ? firstError.message : 'Please check the required order details.')
  }

  const handleWhatsAppCheckout = () => {
    if (catalogueStatus !== 'ready') {
      toast.error(catalogueError ?? 'Please wait while we verify current product prices.')
      return
    }

    if (deliveryMethod === 'delivery' && !(deliveryAddress ?? '').trim()) {
      toast.error('Please enter a delivery address or choose pickup.')
      return
    }

    if (!validateAgainstDatabase()) {
      toast.error('Prices no longer match the current catalogue. Please refresh the cart and try again.')
      return
    }

    const orderReference = `KT-${Date.now().toString().slice(-6)}`
    const message = [
      'Hello Kewe Treats, I would like to place a fresh order.',
      `Order reference: ${orderReference}`,
      '',
      ...cart.map((item) => `• ${item.name} (${item.variant}) x${item.quantity} - ${formatPrice(item.unitPrice * item.quantity)}`),
      '',
      `Fulfilment: ${deliveryMethod === 'delivery' ? 'Delivery' : 'Pickup'}`,
      ...(deliveryMethod === 'delivery' ? [`Delivery address: ${deliveryAddress?.trim()}`] : []),
      `Subtotal: ${formatPrice(subtotal)}`,
      `Delivery fee: ${formatPrice(deliveryFee)}`,
      `Total: ${formatPrice(total)}`,
      '',
      'Please confirm the order and share the next steps.',
    ].join('\n')

    const url = `${WHATSAPP_URL}?text=${encodeURIComponent(message)}`
    window.open(url, '_blank', 'noopener,noreferrer')
    toast.info('Your WhatsApp order summary has been prepared.')
  }

  if (cart.length === 0) {
    return (
      <PageShell title="Your cart" subtitle="Everything you add here will be saved locally on this device.">
        <div className="rounded-[2rem] border border-dashed border-red-200 bg-white px-6 py-16 text-center">
          <h3 className="font-display text-3xl text-ink">Your cart is empty.</h3>
          <p className="mt-2 text-red-900/70">Add a few bakery favourites to begin your order.</p>
          <Link to="/shop" className="mt-6 inline-flex items-center gap-2 rounded-full bg-red-600 px-5 py-3 text-sm font-semibold text-white">
            Browse the menu <ChevronRight className="h-4 w-4" />
          </Link>
        </div>
      </PageShell>
    )
  }

  return (
    <PageShell title="Checkout" subtitle="Review your order and choose how you would like to receive it.">
      <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-5">
          {cart.map((item) => (
            <div key={`${item.id}-${item.variant}`} className="flex gap-4 rounded-[1.5rem] border border-red-100 bg-white p-4 shadow-sm">
              <img src={item.image} alt={item.name} className="h-28 w-28 rounded-[1.2rem] object-cover" />
              <div className="flex-1">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-display text-2xl text-ink">{item.name}</h3>
                    <p className="text-sm text-red-900/70">{item.category} · {item.variant}</p>
                  </div>
                  <button type="button" onClick={() => removeFromCart(item.id, item.variant)} className="text-sm font-medium text-red-700">Remove</button>
                </div>

                <div className="mt-4 flex items-center justify-between gap-4">
                  <div className="flex items-center rounded-full border border-red-200 bg-cream">
                    <button type="button" className="p-2 text-red-700" aria-label="Decrease item quantity" onClick={() => updateQuantity(item.id, item.variant, item.quantity - 1)}>
                      <Minus className="h-4 w-4" />
                    </button>
                    <span className="min-w-9 text-center text-sm font-semibold text-red-700">{item.quantity}</span>
                    <button type="button" className="p-2 text-red-700" aria-label="Increase item quantity" onClick={() => updateQuantity(item.id, item.variant, item.quantity + 1)}>
                      <Plus className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="font-display text-2xl text-red-700">{formatPrice(item.unitPrice * item.quantity)}</div>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="rounded-[2rem] border border-red-100 bg-white p-6 shadow-soft">
          <h3 className="font-display text-3xl text-ink">Order summary</h3>
          <div className="mt-6 space-y-3 text-sm text-red-900/80">
            <div className="flex justify-between"><span>Subtotal</span><span>{formatPrice(subtotal)}</span></div>
            <div className="flex justify-between"><span>Delivery fee</span><span>{formatPrice(deliveryFee)}</span></div>
            <div className="flex justify-between border-t border-red-100 pt-3 font-semibold text-ink"><span>Total</span><span>{formatPrice(total)}</span></div>
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <button type="button" onClick={handleWhatsAppCheckout} className="flex-1 rounded-full bg-[#25D366] px-5 py-3 text-sm font-semibold text-white transition hover:opacity-90">
              Checkout via WhatsApp
            </button>
            <button type="button" onClick={clearCart} className="rounded-full border border-red-200 px-5 py-3 text-sm font-semibold text-red-700">Clear cart</button>
          </div>
        </div>
      </div>

      <div className="mt-10 rounded-[2rem] border border-red-100 bg-white p-6 shadow-soft sm:p-8">
        <h3 className="font-display text-3xl text-ink">Order details</h3>
        {catalogueError && (
          <div role="alert" className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
            <span>{catalogueError}</span>
            <button type="button" onClick={() => void refreshCatalogue()} className="font-semibold underline">
              Retry price check
            </button>
          </div>
        )}
        {submissionError && <p role="alert" className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{submissionError}</p>}
        <form onSubmit={handleSubmit(submitWebsiteOrder, notifyInvalidOrder)} className="mt-6 grid gap-5 md:grid-cols-2">
          <label className="block">
            <span className="mb-2 block text-sm font-medium text-red-700">Full name</span>
            <input {...register('fullName')} className="w-full rounded-xl border border-red-100 bg-cream px-4 py-3 outline-none focus:border-red-300" />
            {errors.fullName && <span className="mt-1 block text-xs text-red-600">{errors.fullName.message}</span>}
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-medium text-red-700">Phone number</span>
            <input {...register('phone')} className="w-full rounded-xl border border-red-100 bg-cream px-4 py-3 outline-none focus:border-red-300" />
            {errors.phone && <span className="mt-1 block text-xs text-red-600">{errors.phone.message}</span>}
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-medium text-red-700">Email (optional)</span>
            <input {...register('email')} className="w-full rounded-xl border border-red-100 bg-cream px-4 py-3 outline-none focus:border-red-300" />
            {errors.email && <span className="mt-1 block text-xs text-red-600">{errors.email.message}</span>}
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-medium text-red-700">How would you like to receive your order?</span>
            <select {...register('deliveryMethod')} className="w-full rounded-xl border border-red-100 bg-cream px-4 py-3 outline-none focus:border-red-300">
              <option value="pickup">Pickup (no delivery fee)</option>
              <option value="delivery">Delivery (fee may apply)</option>
            </select>
          </label>

          {deliveryMethod === 'delivery' && (
            <label className="block md:col-span-2">
              <span className="mb-2 block text-sm font-medium text-red-700">Delivery address</span>
              <textarea {...register('address')} rows={3} className="w-full rounded-xl border border-red-100 bg-cream px-4 py-3 outline-none focus:border-red-300" />
              {errors.address && <span className="mt-1 block text-xs text-red-600">{errors.address.message}</span>}
            </label>
          )}

          <label className="block">
            <span className="mb-2 block text-sm font-medium text-red-700">Preferred date</span>
            <input type="date" {...register('preferredDate')} className="w-full rounded-xl border border-red-100 bg-cream px-4 py-3 outline-none focus:border-red-300" />
            {errors.preferredDate && <span className="mt-1 block text-xs text-red-600">{errors.preferredDate.message}</span>}
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-medium text-red-700">Preferred time</span>
            <input type="time" {...register('preferredTime')} className="w-full rounded-xl border border-red-100 bg-cream px-4 py-3 outline-none focus:border-red-300" />
            {errors.preferredTime && <span className="mt-1 block text-xs text-red-600">{errors.preferredTime.message}</span>}
          </label>

          <label className="block md:col-span-2">
            <span className="mb-2 block text-sm font-medium text-red-700">Order notes</span>
            <textarea {...register('notes')} rows={3} className="w-full rounded-xl border border-red-100 bg-cream px-4 py-3 outline-none focus:border-red-300" />
          </label>

          <div className="md:col-span-2 flex justify-end">
            <button type="submit" disabled={isSubmitting || catalogueStatus === 'loading'} className="rounded-full bg-red-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60">
              {isSubmitting ? 'Submitting order…' : catalogueStatus === 'loading' ? 'Checking prices…' : 'Submit website order'}
            </button>
          </div>
        </form>
      </div>
    </PageShell>
  )
}

function CustomCakePage() {
  const { register, handleSubmit, formState: { errors } } = useForm<CustomCakeFormValues>({
    resolver: zodResolver(customCakeSchema),
    defaultValues: {
      eventType: 'Birthday',
      servings: '',
      flavour: '',
      design: '',
      referenceImage: '',
      budget: '',
      requiredDate: '',
      customerName: '',
      phone: '',
      email: '',
      instructions: '',
    },
  })

  const onSubmit = async (values: CustomCakeFormValues) => {
    const payload = {
      ...values,
      status: 'enquiry',
      created_at: new Date().toISOString(),
    }

    try {
      if (supabase) {
        const { error } = await supabase.rpc('submit_custom_cake_enquiry', {
          p_enquiry: {
            eventType: values.eventType,
            servings: values.servings,
            flavour: values.flavour,
            design: values.design,
            referenceImage: values.referenceImage,
            budget: values.budget,
            requiredDate: values.requiredDate,
            customerName: values.customerName,
            phone: values.phone,
            email: values.email,
            instructions: values.instructions,
          },
        })
        if (error) throw error
      } else {
        window.localStorage.setItem(`kewe-custom-cake-${Date.now()}`, JSON.stringify(payload))
      }

      toast.success('Your custom cake enquiry has been sent successfully. We will confirm the next steps shortly.')
    } catch (error) {
      toast.error(`We could not submit your enquiry: ${error instanceof Error ? error.message : 'Please try again.'}`)
    }
  }

  return (
    <PageShell title="Custom cake enquiry" subtitle="Tell us about your event and we will help bring it to life.">
      <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="rounded-[2rem] bg-red-700 p-8 text-white shadow-soft">
          <h2 className="font-display text-3xl">Let us create your perfect celebration cake.</h2>
          <p className="mt-4 text-red-100">
            Share your event type, preferred flavours, number of servings, budget, and inspiration reference. We will respond with a confirmation and a personalised quote.
          </p>
          <div className="mt-8 space-y-4 text-sm text-red-100">
            <div className="flex items-center gap-3"><Gift className="h-4 w-4 text-brandGold" /> Birthday, wedding, anniversary, graduation, and more</div>
            <div className="flex items-center gap-3"><Clock3 className="h-4 w-4 text-brandGold" /> We recommend placing custom orders at least 2 weeks in advance</div>
            <div className="flex items-center gap-3"><Truck className="h-4 w-4 text-brandGold" /> Delivery and pickup options available</div>
          </div>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="rounded-[2rem] border border-red-100 bg-white p-6 shadow-soft sm:p-8">
          <div className="grid gap-5 md:grid-cols-2">
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-red-700">Event type</span>
              <select {...register('eventType')} className="w-full rounded-xl border border-red-100 bg-cream px-4 py-3 outline-none focus:border-red-300">
                <option value="Birthday">Birthday</option>
                <option value="Wedding">Wedding</option>
                <option value="Anniversary">Anniversary</option>
                <option value="Graduation">Graduation</option>
                <option value="Other">Other</option>
              </select>
              {errors.eventType && <span className="mt-1 block text-xs text-red-600">{errors.eventType.message}</span>}
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-medium text-red-700">Number of servings</span>
              <input {...register('servings')} className="w-full rounded-xl border border-red-100 bg-cream px-4 py-3 outline-none focus:border-red-300" />
              {errors.servings && <span className="mt-1 block text-xs text-red-600">{errors.servings.message}</span>}
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-medium text-red-700">Preferred flavour</span>
              <input {...register('flavour')} className="w-full rounded-xl border border-red-100 bg-cream px-4 py-3 outline-none focus:border-red-300" />
              {errors.flavour && <span className="mt-1 block text-xs text-red-600">{errors.flavour.message}</span>}
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-medium text-red-700">Budget range</span>
              <select {...register('budget')} className="w-full rounded-xl border border-red-100 bg-cream px-4 py-3 outline-none focus:border-red-300">
                <option value="">Select a range</option>
                <option value="₦20,000 - ₦40,000">₦20,000 - ₦40,000</option>
                <option value="₦40,000 - ₦80,000">₦40,000 - ₦80,000</option>
                <option value="₦80,000 - ₦150,000">₦80,000 - ₦150,000</option>
                <option value="₦150,000+">₦150,000+</option>
              </select>
              {errors.budget && <span className="mt-1 block text-xs text-red-600">{errors.budget.message}</span>}
            </label>

            <label className="block md:col-span-2">
              <span className="mb-2 block text-sm font-medium text-red-700">Frosting or design preferences</span>
              <textarea {...register('design')} rows={3} className="w-full rounded-xl border border-red-100 bg-cream px-4 py-3 outline-none focus:border-red-300" />
              {errors.design && <span className="mt-1 block text-xs text-red-600">{errors.design.message}</span>}
            </label>

            <label className="block md:col-span-2">
              <span className="mb-2 block text-sm font-medium text-red-700">Reference image URL (optional)</span>
              <input {...register('referenceImage')} className="w-full rounded-xl border border-red-100 bg-cream px-4 py-3 outline-none focus:border-red-300" />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-medium text-red-700">Required date</span>
              <input type="date" {...register('requiredDate')} className="w-full rounded-xl border border-red-100 bg-cream px-4 py-3 outline-none focus:border-red-300" />
              {errors.requiredDate && <span className="mt-1 block text-xs text-red-600">{errors.requiredDate.message}</span>}
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-medium text-red-700">Customer name</span>
              <input {...register('customerName')} className="w-full rounded-xl border border-red-100 bg-cream px-4 py-3 outline-none focus:border-red-300" />
              {errors.customerName && <span className="mt-1 block text-xs text-red-600">{errors.customerName.message}</span>}
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-medium text-red-700">Phone number</span>
              <input {...register('phone')} className="w-full rounded-xl border border-red-100 bg-cream px-4 py-3 outline-none focus:border-red-300" />
              {errors.phone && <span className="mt-1 block text-xs text-red-600">{errors.phone.message}</span>}
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-medium text-red-700">Email address</span>
              <input {...register('email')} className="w-full rounded-xl border border-red-100 bg-cream px-4 py-3 outline-none focus:border-red-300" />
              {errors.email && <span className="mt-1 block text-xs text-red-600">{errors.email.message}</span>}
            </label>

            <label className="block md:col-span-2">
              <span className="mb-2 block text-sm font-medium text-red-700">Additional instructions</span>
              <textarea {...register('instructions')} rows={3} className="w-full rounded-xl border border-red-100 bg-cream px-4 py-3 outline-none focus:border-red-300" />
            </label>
          </div>

          <div className="mt-6 flex justify-end">
            <button type="submit" className="rounded-full bg-red-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-red-700">
              Send enquiry
            </button>
          </div>
        </form>
      </div>
    </PageShell>
  )
}

function OrderConfirmationPage() {
  const { orderRef } = useParams()

  return (
    <PageShell title="Order received" subtitle="Your order has been successfully placed and is pending confirmation.">
      <div className="rounded-[2rem] border border-red-100 bg-white p-8 shadow-soft">
        <div className="mb-4 flex items-center gap-3 text-red-700"><PackageCheck className="h-6 w-6" /> Order reference: {orderRef}</div>
        <p className="text-red-900/80">
          Thank you for choosing Kewe Treats. Your order is currently pending confirmation and has not yet been marked paid. We will contact you to confirm delivery or pickup details.
        </p>
        <Link to="/shop" className="mt-6 inline-flex items-center gap-2 rounded-full bg-red-600 px-5 py-3 text-sm font-semibold text-white">
          Continue shopping <ChevronRight className="h-4 w-4" />
        </Link>
      </div>
    </PageShell>
  )
}

function AboutPage() {
  return (
    <PageShell title="About Kewe Treats" subtitle="Small-batch pastries and cakes made for meaningful moments.">
      <div className="grid gap-8 lg:grid-cols-[1fr_1fr]">
        <div className="rounded-[2rem] overflow-hidden border border-red-100 bg-white shadow-soft">
          <img src="https://images.unsplash.com/photo-1555507036-ab1f4038808a?auto=format&fit=crop&w=1200&q=80" alt="Bakery kitchen" className="h-full w-full object-cover" />
        </div>

        <div className="rounded-[2rem] border border-red-100 bg-white p-8 shadow-soft">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-red-600">Our story</p>
          <h2 className="mt-3 font-display text-4xl text-ink">Sweet memories, baked with care.</h2>
          <p className="mt-4 text-red-900/80">
            Kewe Treats was built around the idea that celebration deserves flavour, beauty, and warmth. From family birthdays to elegant soirées, we craft desserts that feel personal, premium, and memorable.
          </p>
          <p className="mt-4 text-red-900/80">
            Our kitchen blends classic techniques with contemporary presentation, bringing together soft sponge layers, buttery pastries, rich fillings, and thoughtful customisation for every order.
          </p>
        </div>
      </div>
    </PageShell>
  )
}

function ContactPage() {
  return (
    <PageShell title="Contact" subtitle="We would love to help with your next order or enquiry.">
      <div className="grid gap-8 lg:grid-cols-2">
        <div className="rounded-[2rem] border border-red-100 bg-white p-8 shadow-soft">
          <div className="space-y-4 text-red-900/80">
            <div className="flex items-center gap-3"><Phone className="h-5 w-5 text-red-700" /> +234 901 046 8216</div>
            <div className="flex items-center gap-3"><MapPin className="h-5 w-5 text-red-700" /> 12 Broad Street, Lagos</div>
            <div className="flex items-center gap-3"><Clock3 className="h-5 w-5 text-red-700" /> Mon-Sat: 8:00 AM - 7:00 PM</div>
          </div>
        </div>

        <div className="rounded-[2rem] border border-red-100 bg-white p-8 shadow-soft">
          <h3 className="font-display text-3xl text-ink">Send a message</h3>
          <div className="mt-6 flex flex-wrap gap-3">
            <a href={WHATSAPP_URL} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-full bg-[#25D366] px-5 py-3 text-sm font-semibold text-white">
              <MessageCircle className="h-4 w-4" />
              Chat on WhatsApp
            </a>
            <a href={INSTAGRAM_URL} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-full border border-red-200 px-5 py-3 text-sm font-semibold text-red-700 transition hover:bg-red-50">
              Instagram @{INSTAGRAM_HANDLE}
            </a>
          </div>
        </div>
      </div>
    </PageShell>
  )
}

function PolicyPage() {
  const title = window.location.pathname.includes('terms') ? 'Terms & conditions' : 'Privacy policy'
  return (
    <PageShell title={title} subtitle="This section can be completed with your business policies.">
      <div className="rounded-[2rem] border border-red-100 bg-white p-8 shadow-soft">
        <p className="text-red-900/80">
          Kewe Treats is committed to protecting your information and providing a smooth customer experience. Replace this page with your full legal and privacy terms, including delivery considerations, payment terminology, return conditions, and consent policies.
        </p>
      </div>
    </PageShell>
  )
}

function NotFoundPage() {
  return (
    <PageShell title="Page not found" subtitle="This page does not exist or may have moved.">
      <div className="rounded-[2rem] border border-dashed border-red-200 bg-white px-6 py-16 text-center">
        <h2 className="font-display text-4xl text-ink">404</h2>
        <p className="mt-3 text-red-900/75">The page you requested cannot be found.</p>
        <Link to="/" className="mt-6 inline-flex items-center gap-2 rounded-full bg-red-600 px-5 py-3 text-sm font-semibold text-white">
          Go home <ChevronRight className="h-4 w-4" />
        </Link>
      </div>
    </PageShell>
  )
}

function ProductCard({ product, compact = false }: { product: Product; compact?: boolean }) {
  const { addToCart } = useCart()

  return (
    <article className={`group overflow-hidden rounded-[1.5rem] border border-red-100 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-soft ${compact ? 'h-full' : ''}`}>
      <div className="relative overflow-hidden">
        <Link to={`/shop/${product.slug}`}>
          <img src={product.image} alt={product.name} className="h-64 w-full object-cover transition duration-500 group-hover:scale-105" />
        </Link>
        {product.featured && (
          <span className="absolute left-4 top-4 rounded-full bg-red-600 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-white">Featured</span>
        )}
      </div>
      <div className="p-5">
        <div className="flex items-center justify-between gap-3">
          <span className="rounded-full bg-red-50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-red-700">{product.category}</span>
          {product.available ? <span className="text-xs text-green-700">In stock</span> : <span className="text-xs text-amber-700">Sold out</span>}
        </div>
        <Link to={`/shop/${product.slug}`}><h3 className="mt-4 font-display text-2xl text-ink">{product.name}</h3></Link>
        <p className="mt-2 text-sm text-red-900/70">{product.description}</p>
        <div className="mt-5 flex items-center justify-between gap-3">
          <div className="font-display text-2xl text-red-700">{formatPrice(getProductPrice(product, product.variants?.[0]?.label))}</div>
          <button
            type="button"
            onClick={() => {
              if (!product.available || product.stock < 1) {
                toast.error('This item is not available right now.')
                return
              }
              addToCart(product, 1, product.variants?.[0]?.label ?? 'Standard')
              toast.success(`${product.name} added to cart.`)
            }}
            disabled={!product.available || product.stock < 1}
            className="rounded-full bg-red-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Add to cart
          </button>
        </div>
      </div>
    </article>
  )
}

function PageShell({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      <div className="mb-8">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-red-600">Kewe Treats</p>
        <h1 className="mt-3 font-display text-4xl text-ink sm:text-5xl">{title}</h1>
        <p className="mt-2 text-red-900/75">{subtitle}</p>
      </div>
      {children}
    </section>
  )
}

function ProductSkeletons() {
  return (
    <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: 6 }).map((_, index) => (
        <div key={index} className="overflow-hidden rounded-[1.5rem] border border-red-100 bg-white p-2 shadow-sm">
          <div className="h-64 animate-pulse rounded-[1.2rem] bg-red-50" />
          <div className="space-y-3 p-5">
            <div className="h-4 w-24 animate-pulse rounded-full bg-red-50" />
            <div className="h-7 w-3/4 animate-pulse rounded-full bg-red-50" />
            <div className="h-4 w-full animate-pulse rounded-full bg-red-50" />
            <div className="h-4 w-2/3 animate-pulse rounded-full bg-red-50" />
          </div>
        </div>
      ))}
    </div>
  )
}

export default App
