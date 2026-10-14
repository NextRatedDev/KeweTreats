import { useCallback, useEffect, useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '../lib/supabase'

type OrderItem = {
  id: string
  product_name: string
  variant: string
  unit_price: number
  quantity: number
}

type Order = {
  id: string
  order_reference: string
  customer_name: string
  phone: string
  email: string | null
  delivery_method: 'delivery' | 'pickup'
  address: string | null
  preferred_date: string
  preferred_time: string
  notes: string | null
  subtotal: number
  delivery_fee: number
  total: number
  status: 'pending' | 'confirmed' | 'cancelled' | 'fulfilled'
  paid: boolean
  paid_at: string | null
  created_at: string
  items: OrderItem[]
}

type Enquiry = {
  id: string
  event_type: string
  servings: string
  flavour: string
  design: string
  reference_image: string | null
  budget: string
  required_date: string
  customer_name: string
  phone: string
  email: string | null
  instructions: string | null
  status: 'enquiry' | 'contacted' | 'quoted' | 'accepted' | 'declined'
  created_at: string
}

type AdminPanel = 'orders' | 'enquiries'

const currency = (amount: number) =>
  new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 }).format(amount)

const dateTime = (date: string) =>
  new Intl.DateTimeFormat('en-NG', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(date))

const statusClass: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-900',
  confirmed: 'bg-blue-100 text-blue-900',
  fulfilled: 'bg-green-100 text-green-900',
  cancelled: 'bg-red-100 text-red-900',
  enquiry: 'bg-amber-100 text-amber-900',
  contacted: 'bg-blue-100 text-blue-900',
  quoted: 'bg-purple-100 text-purple-900',
  accepted: 'bg-green-100 text-green-900',
  declined: 'bg-red-100 text-red-900',
}

export default function SalesManagement() {
  const [panel, setPanel] = useState<AdminPanel>('orders')
  const [orders, setOrders] = useState<Order[]>([])
  const [enquiries, setEnquiries] = useState<Enquiry[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [updatingId, setUpdatingId] = useState<string | null>(null)

  const loadSales = useCallback(async () => {
    if (!supabase) return
    setLoading(true)
    setLoadError(null)

    const [ordersResult, enquiriesResult] = await Promise.all([
      supabase.from('orders').select('*').order('created_at', { ascending: false }).limit(100),
      supabase.from('custom_cake_enquiries').select('*').order('created_at', { ascending: false }).limit(100),
    ])

    const errors = [ordersResult.error, enquiriesResult.error].filter(Boolean)
    if (errors.length > 0) {
      const message = errors.map((error) => error?.message).join('; ')
      setLoadError(message)
      setLoading(false)
      return
    }

    const orderRows = ordersResult.data ?? []
    const ids = orderRows.map((order) => order.id)
    let itemsByOrder = new Map<string, OrderItem[]>()
    if (ids.length > 0) {
      const { data: items, error } = await supabase.from('order_items').select('*').in('order_id', ids)
      if (error) {
        setLoadError(error.message)
        setLoading(false)
        return
      }
      itemsByOrder = new Map<string, OrderItem[]>()
      for (const item of items ?? []) {
        const existing = itemsByOrder.get(item.order_id) ?? []
        existing.push({
          id: item.id,
          product_name: item.product_name,
          variant: item.variant,
          unit_price: Number(item.unit_price),
          quantity: item.quantity,
        })
        itemsByOrder.set(item.order_id, existing)
      }
    }

    setOrders(orderRows.map((row) => ({
      ...row,
      subtotal: Number(row.subtotal),
      delivery_fee: Number(row.delivery_fee),
      total: Number(row.total),
      items: itemsByOrder.get(row.id) ?? [],
    })) as Order[])
    setEnquiries((enquiriesResult.data ?? []) as Enquiry[])
    setLoading(false)
  }, [])

  useEffect(() => {
    void loadSales()
  }, [loadSales])

  const updateOrderStatus = async (order: Order, status: 'confirmed' | 'cancelled' | 'fulfilled') => {
    if (!supabase) return
    if (status === 'cancelled' && !window.confirm(`Cancel order ${order.order_reference}? Reserved stock will be returned.`)) return

    setUpdatingId(order.id)
    const { error } = await supabase.rpc('admin_update_order_status', {
      p_order_id: order.id,
      p_status: status,
    })
    setUpdatingId(null)
    if (error) {
      toast.error(`Could not update order status: ${error.message}`)
      return
    }
    toast.success(`Order ${order.order_reference} marked ${status}.`)
    await loadSales()
  }

  const updateEnquiryStatus = async (enquiry: Enquiry, status: Enquiry['status']) => {
    if (!supabase) return
    setUpdatingId(enquiry.id)
    const { error } = await supabase.rpc('admin_update_enquiry_status', {
      p_enquiry_id: enquiry.id,
      p_status: status,
    })
    setUpdatingId(null)
    if (error) {
      toast.error(`Could not update enquiry: ${error.message}`)
      return
    }
    toast.success('Enquiry status updated.')
    await loadSales()
  }

  const markOrderPaid = async (order: Order) => {
    if (!supabase) return
    if (!window.confirm(`Have you independently verified the payment of ${currency(order.total)} for ${order.order_reference}?`)) return

    setUpdatingId(order.id)
    const { error } = await supabase.rpc('admin_mark_order_paid', {
      p_order_id: order.id,
    })
    setUpdatingId(null)
    if (error) {
      toast.error(`Could not record payment: ${error.message}`)
      return
    }
    toast.success(`Payment recorded for ${order.order_reference}.`)
    await loadSales()
  }

  const pendingCount = orders.filter((order) => order.status === 'pending').length
  const activeEnquiryCount = enquiries.filter((enquiry) => !['accepted', 'declined'].includes(enquiry.status)).length

  return (
    <section className="mb-10 rounded-[2rem] border border-red-100 bg-white p-6 shadow-soft sm:p-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-red-600">Sales desk</p>
          <h2 className="mt-1 font-display text-3xl text-ink">Orders & enquiries</h2>
          <p className="mt-1 text-sm text-red-900/70">Review customer requests, update statuses, and track reserved stock.</p>
        </div>
        <button
          type="button"
          onClick={() => void loadSales()}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-full border border-red-200 px-4 py-2 text-sm font-semibold text-red-700 disabled:opacity-50"
        >
          <RefreshCw className="h-4 w-4" /> Refresh
        </button>
      </div>

      <div className="mt-5 flex flex-wrap gap-2 border-b border-red-100 pb-4">
        <button
          type="button"
          aria-pressed={panel === 'orders'}
          onClick={() => setPanel('orders')}
          className={`rounded-full px-4 py-2 text-sm font-semibold ${panel === 'orders' ? 'bg-red-600 text-white' : 'bg-red-50 text-red-800'}`}
        >
          Orders ({pendingCount} pending)
        </button>
        <button
          type="button"
          aria-pressed={panel === 'enquiries'}
          onClick={() => setPanel('enquiries')}
          className={`rounded-full px-4 py-2 text-sm font-semibold ${panel === 'enquiries' ? 'bg-red-600 text-white' : 'bg-red-50 text-red-800'}`}
        >
          Custom cake enquiries ({activeEnquiryCount} active)
        </button>
      </div>

      {loading ? (
        <p className="py-8 text-sm text-red-900/70">Loading customer records…</p>
      ) : loadError ? (
        <div role="alert" className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          <p>Could not load sales records: {loadError}</p>
          <p className="mt-1">Check that the latest Supabase schema is installed and that this account is an admin.</p>
        </div>
      ) : panel === 'orders' ? (
        orders.length === 0 ? (
          <p className="py-8 text-sm text-red-900/70">No website orders yet.</p>
        ) : (
          <div className="mt-5 space-y-4">
            {orders.map((order) => (
              <article key={order.id} className="rounded-2xl border border-red-100 p-4 sm:p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="font-semibold text-ink">{order.order_reference} · {order.customer_name}</h3>
                    <p className="mt-1 text-sm text-red-900/70">
                      <a className="underline" href={`tel:${order.phone}`}>{order.phone}</a>
                      {order.email && <> · <a className="underline" href={`mailto:${order.email}`}>{order.email}</a></>}
                    </p>
                    <p className="mt-1 text-xs text-red-900/60">Placed {dateTime(order.created_at)}</p>
                  </div>
                  <span className={`rounded-full px-3 py-1 text-xs font-semibold capitalize ${statusClass[order.status]}`}>{order.status}</span>
                </div>

                <ul className="my-4 space-y-1 border-y border-red-50 py-3 text-sm text-red-950/80">
                  {order.items.map((item) => (
                    <li key={item.id} className="flex justify-between gap-3">
                      <span>{item.product_name} · {item.variant} × {item.quantity}</span>
                      <span>{currency(item.unit_price * item.quantity)}</span>
                    </li>
                  ))}
                </ul>

                <div className="grid gap-2 text-sm text-red-900/75 sm:grid-cols-2">
                  <p><strong>Collection:</strong> {order.delivery_method} · {order.preferred_date} at {order.preferred_time}</p>
                  {order.address && <p><strong>Address:</strong> {order.address}</p>}
                  <p><strong>Subtotal:</strong> {currency(order.subtotal)} · <strong>Delivery:</strong> {currency(order.delivery_fee)}</p>
                  <p>
                    <strong>Total:</strong> {currency(order.total)} · {order.paid ? `Paid${order.paid_at ? ` on ${dateTime(order.paid_at)}` : ''}` : 'Unpaid'}
                  </p>
                  {order.notes && <p className="sm:col-span-2"><strong>Notes:</strong> {order.notes}</p>}
                </div>

                {order.status === 'pending' && (
                  <div className="mt-4 flex flex-wrap gap-2">
                    <button type="button" disabled={updatingId === order.id} onClick={() => void updateOrderStatus(order, 'confirmed')} className="rounded-full bg-green-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">Confirm order</button>
                    <button type="button" disabled={updatingId === order.id} onClick={() => void updateOrderStatus(order, 'cancelled')} className="rounded-full border border-red-200 px-4 py-2 text-sm font-semibold text-red-700 disabled:opacity-50">Cancel & return stock</button>
                  </div>
                )}
                {order.status === 'confirmed' && (
                  <div className="mt-4 flex flex-wrap gap-2">
                    <button type="button" disabled={updatingId === order.id} onClick={() => void updateOrderStatus(order, 'fulfilled')} className="rounded-full bg-green-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">Mark fulfilled</button>
                    <button type="button" disabled={updatingId === order.id} onClick={() => void updateOrderStatus(order, 'cancelled')} className="rounded-full border border-red-200 px-4 py-2 text-sm font-semibold text-red-700 disabled:opacity-50">Cancel & return stock</button>
                  </div>
                )}
                {['confirmed', 'fulfilled'].includes(order.status) && !order.paid && (
                  <button
                    type="button"
                    disabled={updatingId === order.id}
                    onClick={() => void markOrderPaid(order)}
                    className="mt-3 rounded-full border border-green-300 px-4 py-2 text-sm font-semibold text-green-800 disabled:opacity-50"
                  >
                    Record verified manual payment
                  </button>
                )}
              </article>
            ))}
          </div>
        )
      ) : enquiries.length === 0 ? (
        <p className="py-8 text-sm text-red-900/70">No custom cake enquiries yet.</p>
      ) : (
        <div className="mt-5 space-y-4">
          {enquiries.map((enquiry) => (
            <article key={enquiry.id} className="rounded-2xl border border-red-100 p-4 sm:p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="font-semibold text-ink">{enquiry.event_type} · {enquiry.customer_name}</h3>
                  <p className="mt-1 text-sm text-red-900/70">
                    <a className="underline" href={`tel:${enquiry.phone}`}>{enquiry.phone}</a>
                    {enquiry.email && <> · <a className="underline" href={`mailto:${enquiry.email}`}>{enquiry.email}</a></>}
                  </p>
                  <p className="mt-1 text-xs text-red-900/60">Received {dateTime(enquiry.created_at)}</p>
                </div>
                <span className={`rounded-full px-3 py-1 text-xs font-semibold capitalize ${statusClass[enquiry.status]}`}>{enquiry.status}</span>
              </div>

              <dl className="mt-4 grid gap-2 text-sm text-red-900/75 sm:grid-cols-2">
                <div><dt className="inline font-semibold">Required:</dt> <dd className="inline">{enquiry.required_date} · {enquiry.servings} servings</dd></div>
                <div><dt className="inline font-semibold">Flavour:</dt> <dd className="inline">{enquiry.flavour}</dd></div>
                <div><dt className="inline font-semibold">Budget:</dt> <dd className="inline">{enquiry.budget}</dd></div>
                <div><dt className="inline font-semibold">Design:</dt> <dd className="inline">{enquiry.design}</dd></div>
                {enquiry.reference_image && <div><a href={enquiry.reference_image} target="_blank" rel="noreferrer" className="font-semibold text-red-700 underline">View reference image</a></div>}
                {enquiry.instructions && <div className="sm:col-span-2"><dt className="inline font-semibold">Notes:</dt> <dd className="inline">{enquiry.instructions}</dd></div>}
              </dl>

              <label className="mt-4 block max-w-xs">
                <span className="sr-only">Update enquiry status</span>
                <select
                  value={enquiry.status}
                  disabled={updatingId === enquiry.id}
                  onChange={(event) => void updateEnquiryStatus(enquiry, event.target.value as Enquiry['status'])}
                  className="w-full rounded-xl border border-red-100 bg-cream px-3 py-2 text-sm text-red-900"
                >
                  <option value="enquiry">Enquiry received</option>
                  <option value="contacted">Contacted</option>
                  <option value="quoted">Quote sent</option>
                  <option value="accepted">Accepted</option>
                  <option value="declined">Declined</option>
                </select>
              </label>
            </article>
          ))}
        </div>
      )}
    </section>
  )
}
