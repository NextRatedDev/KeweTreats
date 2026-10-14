import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import type { User } from '@supabase/supabase-js'
import { ImagePlus, LogOut, Pencil, Plus, RefreshCw, Trash2, X } from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '../lib/supabase'
import type { Category, Product } from '../types'
import SalesManagement from './SalesManagement'

const categories: Category[] = ['Cakes', 'Pastries', 'Desserts', 'Special Treats']
const imageBucket = 'product-images'
const maxImageSize = 5 * 1024 * 1024

type VariantDraft = { label: string; price: string }
type ProductDraft = {
  name: string
  category: Category
  description: string
  longDescription: string
  price: string
  stock: string
  available: boolean
  featured: boolean
  bestseller: boolean
  customisationPrompt: string
}

const emptyDraft: ProductDraft = {
  name: '',
  category: 'Cakes',
  description: '',
  longDescription: '',
  price: '',
  stock: '0',
  available: true,
  featured: false,
  bestseller: false,
  customisationPrompt: '',
}

function slugify(value: string) {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'An unexpected error occurred.'
}

function getStoragePath(imageUrl: string) {
  const marker = `/storage/v1/object/public/${imageBucket}/`
  const start = imageUrl.indexOf(marker)
  if (start < 0) return null

  return imageUrl
    .slice(start + marker.length)
    .split('/')
    .map((segment) => decodeURIComponent(segment))
    .join('/')
}

function mapProduct(row: Record<string, unknown>): Product {
  const images = Array.isArray(row.images) ? row.images.filter((image): image is string => typeof image === 'string') : []
  const price = Number(row.price ?? 0)

  return {
    id: String(row.id),
    name: String(row.name ?? ''),
    slug: String(row.slug ?? ''),
    category: (categories.includes(row.category as Category) ? row.category : 'Cakes') as Category,
    description: String(row.description ?? ''),
    longDescription: String(row.long_description ?? row.description ?? ''),
    price,
    image: String(row.image ?? images[0] ?? ''),
    images,
    featured: Boolean(row.featured),
    bestseller: Boolean(row.bestseller),
    available: Boolean(row.available),
    stock: Number(row.stock ?? 0),
    variants: Array.isArray(row.variants)
      ? row.variants as Product['variants']
      : [{ label: 'Standard', price }],
    customisationPrompt: typeof row.customisation_prompt === 'string' ? row.customisation_prompt : undefined,
  }
}

export default function AdminPage() {
  const [user, setUser] = useState<User | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [checkingSession, setCheckingSession] = useState(true)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [products, setProducts] = useState<Product[]>([])
  const [loadingProducts, setLoadingProducts] = useState(true)
  const [saving, setSaving] = useState(false)
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)
  const [draft, setDraft] = useState<ProductDraft>(emptyDraft)
  const [variants, setVariants] = useState<VariantDraft[]>([{ label: 'Standard', price: '' }])
  const [imageFile, setImageFile] = useState<File | null>(null)

  const loadProducts = async () => {
    if (!supabase) return
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .order('created_at', { ascending: false })
    setLoadingProducts(false)

    if (error) {
      toast.error(`Could not load products: ${error.message}`)
      return
    }
    setProducts((data ?? []).map((row) => mapProduct(row as Record<string, unknown>)))
  }

  useEffect(() => {
    const client = supabase
    if (!client) return

    let active = true
    const verifyAdmin = async (currentUser: User | null) => {
      if (!active) return
      setUser(currentUser)
      if (!currentUser) {
        setIsAdmin(false)
        setCheckingSession(false)
        return
      }

      const { data, error } = await client
        .from('admin_users')
        .select('user_id')
        .eq('user_id', currentUser.id)
        .maybeSingle()

      if (!active) return
      if (error) {
        toast.error(`Could not verify admin access: ${error.message}`)
        setIsAdmin(false)
      } else {
        setIsAdmin(Boolean(data))
      }
      setCheckingSession(false)
      if (!error && data) await loadProducts()
    }

    void client.auth.getSession().then(({ data, error }) => {
      if (!active) return
      if (error) toast.error(`Could not restore your session: ${error.message}`)
      void verifyAdmin(data.session?.user ?? null)
    })

    const { data: authListener } = client.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        setUser(null)
        setIsAdmin(false)
      } else if (event === 'SIGNED_IN' && session?.user) {
        void verifyAdmin(session.user)
      }
    })

    return () => {
      active = false
      authListener.subscription.unsubscribe()
    }
  }, [])

  const handleSignIn = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!supabase) return

    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      toast.error(`Sign in failed: ${error.message}`)
      return
    }
    setPassword('')
    if (data.user) {
      const { data: membership, error: membershipError } = await supabase
        .from('admin_users')
        .select('user_id')
        .eq('user_id', data.user.id)
        .maybeSingle()

      if (membershipError) {
        toast.error(`Could not verify admin access: ${membershipError.message}`)
        return
      }
      setUser(data.user)
      setIsAdmin(Boolean(membership))
      if (!membership) toast.error('This account does not have admin access.')
    }
  }

  const signOut = async () => {
    if (!supabase) return
    const { error } = await supabase.auth.signOut()
    if (error) {
      toast.error(`Could not sign out: ${error.message}`)
      return
    }
    setUser(null)
    setIsAdmin(false)
  }

  const resetForm = () => {
    setEditingProduct(null)
    setDraft(emptyDraft)
    setVariants([{ label: 'Standard', price: '' }])
    setImageFile(null)
  }

  const startEditing = (product: Product) => {
    setEditingProduct(product)
    setDraft({
      name: product.name,
      category: product.category,
      description: product.description,
      longDescription: product.longDescription,
      price: String(product.price),
      stock: String(product.stock),
      available: product.available,
      featured: Boolean(product.featured),
      bestseller: Boolean(product.bestseller),
      customisationPrompt: product.customisationPrompt ?? '',
    })
    setVariants(
      product.variants?.length
        ? product.variants.map((variant) => ({ label: variant.label, price: String(variant.price) }))
        : [{ label: 'Standard', price: String(product.price) }],
    )
    setImageFile(null)
    document.getElementById('product-form')?.scrollIntoView({ behavior: 'smooth' })
  }

  const handleSaveProduct = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!supabase || !isAdmin) return

    const basePrice = Number(draft.price)
    const stock = Number(draft.stock)
    if (!draft.name.trim() || !draft.description.trim() || !Number.isFinite(basePrice) || basePrice <= 0) {
      toast.error('Add a product name, description, and valid price.')
      return
    }
    if (!Number.isInteger(stock) || stock < 0) {
      toast.error('Stock must be a whole number of zero or more.')
      return
    }
    if (variants.some((variant) => !variant.label.trim() || !Number.isFinite(Number(variant.price)) || Number(variant.price) <= 0)) {
      toast.error('Each variant needs a label and a valid price.')
      return
    }
    if (!editingProduct && !imageFile) {
      toast.error('Choose a product image to upload.')
      return
    }
    if (imageFile && (!imageFile.type.startsWith('image/') || imageFile.size > maxImageSize)) {
      toast.error('Choose an image file smaller than 5 MB.')
      return
    }

    setSaving(true)
    let uploadedPath: string | null = null
    try {
      let imageUrl = editingProduct?.image ?? ''
      if (imageFile) {
        const extension = imageFile.name.split('.').pop()?.toLowerCase() || 'jpg'
        uploadedPath = `${crypto.randomUUID()}.${extension}`
        const { error: uploadError } = await supabase.storage
          .from(imageBucket)
          .upload(uploadedPath, imageFile, { cacheControl: '3600', upsert: false })
        if (uploadError) throw uploadError
        imageUrl = supabase.storage.from(imageBucket).getPublicUrl(uploadedPath).data.publicUrl
      }

      const preservedImages = editingProduct?.images?.filter((url) => url !== editingProduct.image) ?? []
      const payload = {
        name: draft.name.trim(),
        slug: slugify(draft.name),
        category: draft.category,
        description: draft.description.trim(),
        long_description: draft.longDescription.trim() || draft.description.trim(),
        price: basePrice,
        image: imageUrl,
        images: [imageUrl, ...preservedImages],
        featured: draft.featured,
        bestseller: draft.bestseller,
        available: draft.available,
        stock,
        variants: variants.map((variant) => ({ label: variant.label.trim(), price: Number(variant.price) })),
        customisation_prompt: draft.customisationPrompt.trim() || null,
      }

      const result = editingProduct
        ? await supabase.from('products').update(payload).eq('id', editingProduct.id)
        : await supabase.from('products').insert(payload)
      if (result.error) throw result.error

      if (imageFile && editingProduct) {
        const oldPath = getStoragePath(editingProduct.image)
        if (oldPath) {
          const { error: removeError } = await supabase.storage.from(imageBucket).remove([oldPath])
          if (removeError) toast.warning(`Product saved, but the previous image could not be removed: ${removeError.message}`)
        }
      }

      toast.success(editingProduct ? 'Product updated.' : 'Product added to the shop.')
      resetForm()
      setLoadingProducts(true)
      await loadProducts()
    } catch (error) {
      if (uploadedPath) {
        const { error: cleanupError } = await supabase.storage.from(imageBucket).remove([uploadedPath])
        if (cleanupError) toast.error(`Upload cleanup failed: ${cleanupError.message}`)
      }
      toast.error(`Could not save product: ${getErrorMessage(error)}`)
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteProduct = async (product: Product) => {
    if (!supabase || !isAdmin) return
    if (!window.confirm(`Delete "${product.name}" from the shop? This cannot be undone.`)) return

    const { error } = await supabase.from('products').delete().eq('id', product.id)
    if (error) {
      toast.error(`Could not delete product: ${error.message}`)
      return
    }

    const storagePaths = [...new Set((product.images?.length ? product.images : [product.image])
      .map(getStoragePath)
      .filter((path): path is string => Boolean(path)))]
    if (storagePaths.length > 0) {
      const { error: storageError } = await supabase.storage.from(imageBucket).remove(storagePaths)
      if (storageError) toast.warning(`Product was deleted, but some stored images could not be removed: ${storageError.message}`)
    }

    toast.success('Product deleted.')
    if (editingProduct?.id === product.id) resetForm()
    setLoadingProducts(true)
    await loadProducts()
  }

  if (!supabase) {
    return (
      <AdminShell title="Admin sign in" subtitle="Connect this app to Supabase to manage the product catalogue.">
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">
          Supabase is not configured. Add <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code> to your local environment, then restart the app.
        </div>
      </AdminShell>
    )
  }

  if (checkingSession) {
    return <AdminShell title="Staff portal" subtitle="Checking your secure session."><p>Loading…</p></AdminShell>
  }

  if (!user) {
    return (
      <AdminShell title="Staff portal" subtitle="Sign in with an authorised staff account to manage products.">
        <form onSubmit={handleSignIn} className="mx-auto max-w-md space-y-4 rounded-[2rem] border border-red-100 bg-white p-8 shadow-soft">
          <h2 className="font-display text-3xl text-ink">Admin sign in</h2>
          <label className="block">
            <span className="mb-2 block text-sm font-medium text-red-700">Staff email</span>
            <input type="email" autoComplete="username" required value={email} onChange={(event) => setEmail(event.target.value)} className="w-full rounded-xl border border-red-100 bg-cream px-4 py-3 outline-none focus:border-red-300" />
          </label>
          <label className="block">
            <span className="mb-2 block text-sm font-medium text-red-700">Password</span>
            <input type="password" autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} className="w-full rounded-xl border border-red-100 bg-cream px-4 py-3 outline-none focus:border-red-300" />
          </label>
          <button type="submit" className="w-full rounded-full bg-red-600 px-5 py-3 text-sm font-semibold text-white">Sign in</button>
        </form>
      </AdminShell>
    )
  }

  if (!isAdmin) {
    return (
      <AdminShell title="Admin access required" subtitle={`Signed in as ${user.email ?? 'staff account'}.`}>
        <div className="rounded-[2rem] border border-red-100 bg-white p-8 shadow-soft">
          <p className="text-red-900/80">This account is not listed as an authorised Kewe Treats admin.</p>
          <button type="button" onClick={() => void signOut()} className="mt-5 rounded-full border border-red-200 px-5 py-2.5 text-sm font-semibold text-red-700">Sign out</button>
        </div>
      </AdminShell>
    )
  }

  return (
    <AdminShell title="Product management" subtitle={`Signed in as ${user.email ?? 'admin'}. Add, update, or remove shop products.`}>
      <SalesManagement />
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-red-900/70">{products.length} product{products.length === 1 ? '' : 's'} in the catalogue</p>
        <div className="flex gap-2">
          <button type="button" onClick={() => { setLoadingProducts(true); void loadProducts() }} disabled={loadingProducts} className="inline-flex items-center gap-2 rounded-full border border-red-200 px-4 py-2 text-sm font-semibold text-red-700 disabled:opacity-50">
            <RefreshCw className="h-4 w-4" /> Refresh
          </button>
          <button type="button" onClick={() => void signOut()} className="inline-flex items-center gap-2 rounded-full border border-red-200 px-4 py-2 text-sm font-semibold text-red-700">
            <LogOut className="h-4 w-4" /> Sign out
          </button>
        </div>
      </div>

      <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_minmax(380px,0.9fr)]">
        <section className="rounded-[2rem] border border-red-100 bg-white p-6 shadow-soft">
          <h2 className="font-display text-3xl text-ink">Current products</h2>
          {loadingProducts ? (
            <p className="mt-5 text-sm text-red-900/70">Loading catalogue…</p>
          ) : products.length === 0 ? (
            <p className="mt-5 rounded-xl bg-cream p-4 text-sm text-red-900/70">No products yet. Add your first product using the form.</p>
          ) : (
            <div className="mt-5 space-y-3">
              {products.map((product) => (
                <article key={product.id} className="flex gap-3 rounded-2xl border border-red-100 p-3">
                  <img src={product.image} alt="" className="h-20 w-20 shrink-0 rounded-xl object-cover" />
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate font-semibold text-ink">{product.name}</h3>
                    <p className="text-sm text-red-900/70">{product.category} · ₦{product.price.toLocaleString('en-NG')} · Stock {product.stock}</p>
                    <p className={`mt-1 text-xs font-medium ${product.available ? 'text-green-700' : 'text-amber-700'}`}>{product.available ? 'Available' : 'Unavailable'}</p>
                  </div>
                  <div className="flex shrink-0 flex-col gap-2">
                    <button type="button" onClick={() => startEditing(product)} aria-label={`Edit ${product.name}`} className="rounded-full border border-red-200 p-2 text-red-700"><Pencil className="h-4 w-4" /></button>
                    <button type="button" onClick={() => void handleDeleteProduct(product)} aria-label={`Delete ${product.name}`} className="rounded-full border border-red-200 p-2 text-red-700"><Trash2 className="h-4 w-4" /></button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        <section id="product-form" className="rounded-[2rem] border border-red-100 bg-white p-6 shadow-soft">
          <div className="mb-5 flex items-center justify-between gap-3">
            <h2 className="font-display text-3xl text-ink">{editingProduct ? 'Edit product' : 'Add a product'}</h2>
            {editingProduct && <button type="button" onClick={resetForm} aria-label="Cancel editing" className="rounded-full border border-red-200 p-2 text-red-700"><X className="h-4 w-4" /></button>}
          </div>

          <form onSubmit={handleSaveProduct} className="space-y-4">
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-red-700">Product name</span>
              <input required maxLength={120} value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} className="w-full rounded-xl border border-red-100 bg-cream px-4 py-2.5 outline-none focus:border-red-300" />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-red-700">Category</span>
              <select value={draft.category} onChange={(event) => setDraft({ ...draft, category: event.target.value as Category })} className="w-full rounded-xl border border-red-100 bg-cream px-4 py-2.5 outline-none focus:border-red-300">
                {categories.map((category) => <option key={category}>{category}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-red-700">Short description</span>
              <textarea required maxLength={400} rows={2} value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} className="w-full rounded-xl border border-red-100 bg-cream px-4 py-2.5 outline-none focus:border-red-300" />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-red-700">Full description</span>
              <textarea rows={3} value={draft.longDescription} onChange={(event) => setDraft({ ...draft, longDescription: event.target.value })} className="w-full rounded-xl border border-red-100 bg-cream px-4 py-2.5 outline-none focus:border-red-300" />
            </label>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-red-700">Starting price (NGN)</span>
                <input required type="number" min="1" step="1" value={draft.price} onChange={(event) => setDraft({ ...draft, price: event.target.value })} className="w-full rounded-xl border border-red-100 bg-cream px-4 py-2.5 outline-none focus:border-red-300" />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-red-700">Stock quantity</span>
                <input required type="number" min="0" step="1" value={draft.stock} onChange={(event) => setDraft({ ...draft, stock: event.target.value })} className="w-full rounded-xl border border-red-100 bg-cream px-4 py-2.5 outline-none focus:border-red-300" />
              </label>
            </div>

            <fieldset className="rounded-xl border border-red-100 p-3">
              <legend className="px-1 text-sm font-medium text-red-700">Sizes or variants</legend>
              <div className="space-y-2">
                {variants.map((variant, index) => (
                  <div key={index} className="flex gap-2">
                    <input aria-label="Variant label" placeholder="e.g. 6-inch" required value={variant.label} onChange={(event) => setVariants((current) => current.map((item, i) => i === index ? { ...item, label: event.target.value } : item))} className="min-w-0 flex-1 rounded-lg border border-red-100 bg-cream px-3 py-2 text-sm outline-none focus:border-red-300" />
                    <input aria-label="Variant price in naira" placeholder="Price (₦)" required type="number" min="1" step="1" value={variant.price} onChange={(event) => setVariants((current) => current.map((item, i) => i === index ? { ...item, price: event.target.value } : item))} className="w-32 rounded-lg border border-red-100 bg-cream px-3 py-2 text-sm outline-none focus:border-red-300" />
                    {variants.length > 1 && <button type="button" onClick={() => setVariants((current) => current.filter((_, i) => i !== index))} aria-label="Remove variant" className="rounded-lg border border-red-100 px-3 text-red-700"><X className="h-4 w-4" /></button>}
                  </div>
                ))}
              </div>
              <button type="button" onClick={() => setVariants((current) => [...current, { label: '', price: '' }])} className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-red-700"><Plus className="h-4 w-4" /> Add variant</button>
            </fieldset>

            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-red-700">Product image {editingProduct && '(leave blank to keep current image)'}</span>
              <span className="flex cursor-pointer items-center gap-3 rounded-xl border border-dashed border-red-200 bg-cream px-4 py-3 text-sm text-red-800">
                <ImagePlus className="h-5 w-5 shrink-0" />
                <span className="truncate">{imageFile?.name ?? (editingProduct ? 'Choose a replacement image' : 'Choose image (JPG, PNG, or WebP, max 5 MB)')}</span>
                <input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => setImageFile(event.target.files?.[0] ?? null)} className="sr-only" />
              </span>
            </label>

            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-red-700">Customisation instructions (optional)</span>
              <textarea rows={2} value={draft.customisationPrompt} onChange={(event) => setDraft({ ...draft, customisationPrompt: event.target.value })} className="w-full rounded-xl border border-red-100 bg-cream px-4 py-2.5 outline-none focus:border-red-300" />
            </label>

            <div className="grid gap-2 sm:grid-cols-2">
              {([
                ['available', 'Available to order'],
                ['featured', 'Featured product'],
                ['bestseller', 'Bestseller'],
              ] as const).map(([key, label]) => (
                <label key={key} className="flex items-center gap-2 text-sm text-red-900/80">
                  <input type="checkbox" checked={draft[key]} onChange={(event) => setDraft({ ...draft, [key]: event.target.checked })} className="h-4 w-4 accent-red-600" />
                  {label}
                </label>
              ))}
            </div>
            <button type="submit" disabled={saving} className="w-full rounded-full bg-red-600 px-5 py-3 text-sm font-semibold text-white disabled:opacity-60">
              {saving ? 'Saving product…' : editingProduct ? 'Save changes' : 'Upload product'}
            </button>
          </form>
        </section>
      </div>
    </AdminShell>
  )
}

function AdminShell({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
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
