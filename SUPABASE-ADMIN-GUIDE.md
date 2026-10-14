# Kewe Treats: Supabase product admin guide

This guide sets up Supabase-backed product management at `/admin` and the protected customer order/enquiry submission functions. An authorised staff member can upload product images, add products, edit catalogue details, mark products featured or unavailable, and delete products. Products are read from the `products` table by the shop.

## 1. Connect the app to Supabase

1. Create or open the Kewe Treats project in the Supabase Dashboard.
2. In **Project Settings → API**, copy the Project URL and the **publishable/anon key**.
3. In the project root, create `.env.local` using `.env.example` as a template:

   ```env
   VITE_SUPABASE_URL=https://YOUR_PROJECT_ID.supabase.co
   VITE_SUPABASE_ANON_KEY=YOUR_PUBLISHABLE_OR_ANON_KEY
   ```

4. Restart the Vite dev server after changing environment variables. For a deployed site, add the same variables in the hosting provider's environment settings and redeploy.

Never put a Supabase `service_role` or secret key in a `VITE_` variable, browser code, or a public repository. The browser only uses the publishable/anon key; Row Level Security protects database and Storage writes.

## 2. Create the catalogue, access rules, and image bucket

1. In Supabase, open **SQL Editor → New query**.
2. Copy the contents of [`supabase/schema.sql`](./supabase/schema.sql) into the editor.
3. Run the SQL and confirm it completes successfully.

This creates the catalogue, staff-membership, order, order-item, custom-enquiry, and short-lived submission-rate tables; their policies and submission functions; and a public `product-images` Storage bucket. Public image access is needed to display product photography on the customer-facing shop. Only users in `admin_users` can change products or upload/delete objects in that bucket. Anonymous customers can submit orders and cake enquiries only through the database functions; direct table writes are revoked.

### Verify the SQL setup

After the Editor reports success, run:

```sql
select
  to_regclass('public.products') as products,
  to_regclass('public.orders') as orders,
  to_regclass('public.order_items') as order_items,
  to_regclass('public.custom_cake_enquiries') as custom_cake_enquiries,
  to_regclass('public.admin_users') as admin_users;

select routine_name
from information_schema.routines
where routine_schema = 'public'
  and routine_name in (
    'submit_customer_order',
    'submit_custom_cake_enquiry',
    'admin_update_order_status',
    'admin_update_enquiry_status',
    'admin_mark_order_paid'
  )
order by routine_name;

select id, name, public
from storage.buckets
where id = 'product-images';
```

All five table results, all four routine names, and the `product-images` bucket should be present. Then create a staff account and add its Auth UUID to `public.admin_users` as described below. Sign into `/admin`; the Sales desk should show the Orders and Custom cake enquiries tabs. With no submissions, empty states are expected.

If the project already has a `products` table, inspect and back it up before running the SQL. `CREATE TABLE IF NOT EXISTS` will not add missing columns to an existing table; reconcile its schema first.

Also review any existing policies on these tables and on `storage.objects`. PostgreSQL permissive RLS policies are combined with OR, so a prior broad write policy could weaken the admin-only rules in this guide. Remove or tighten old policies before enabling product management.

If order or enquiry tables already contain live data, back them up and compare their columns before applying the SQL. The customer submission functions expect the column layout in `schema.sql`. Test the migration in a non-production Supabase project before changing a live schema.

## 3. Authorise the first admin

1. In **Authentication → Users**, create a staff account with the staff member's email address and a strong password. Disable public sign-up in **Authentication → Settings** if customers should not create accounts.
2. Copy that user's UUID from the Users list.
3. In SQL Editor, run the following after replacing the example UUID:

   ```sql
   insert into public.admin_users (user_id)
   values ('PASTE-AUTH-USER-UUID-HERE')
   on conflict (user_id) do nothing;
   ```

Only trusted project owners should run this query. Do not grant staff permission to add themselves to `admin_users`. To revoke admin access, remove the user's row:

```sql
delete from public.admin_users
where user_id = 'PASTE-AUTH-USER-UUID-HERE';
```

The database policies enforce this membership independently of the admin page, so bypassing the page does not grant product write access.

## 4. Sign in and add a product

1. Open the deployed website and go to `/admin`.
2. Sign in with the authorised staff email and password.
3. In **Add a product**, enter its name, category, short description, optional full description, starting price in naira, and stock quantity.
4. Add or remove size/variant rows as needed. Each variant needs a label and a price (for example, `6-inch` and `48000`). The starting price is still used for the product listing.
5. Choose a JPG, PNG, or WebP product image up to 5 MB.
6. Optionally add customisation instructions and select the availability, featured, and bestseller flags.
7. Select **Upload product**. The image is uploaded to Supabase Storage and the product details are saved to `products`. A success notification confirms the save.
8. Open **Shop** and confirm the product displays correctly.

Product slugs are generated from the product name. Product names therefore need unique slugs; if a name conflicts with an existing product, change the name and save again.

## Customer submissions and stock

Website checkout calls `submit_customer_order`. The database function looks up current product and variant prices, verifies availability and stock, calculates the subtotal and delivery fee itself, saves the order and its line items atomically, and returns a server-generated reference. It ignores any prices or totals a browser might try to send. It also limits a phone number to five order/enquiry submissions per hour. Customer-facing roles cannot directly insert or edit sales rows.

Submitting a website order reserves its product quantities by decrementing stock. In the admin Sales desk, confirm pending orders, fulfil confirmed orders, or cancel pending/confirmed orders. Cancelling restores the reserved quantities in the same database transaction. Cancelled and fulfilled orders cannot be changed through the status workflow. Payments are manual: after independently verifying that payment was received, use **Record verified manual payment** on a confirmed or fulfilled order. The database records the paid flag and timestamp; confirming or fulfilling an order does not mark it paid. WhatsApp checkout remains an enquiry handoff: opening WhatsApp does not create a database order, confirm acceptance, or mark payment complete.

## 5. Edit or remove a product

- **Edit:** Select the pencil button next to the product. Update the fields and select **Save changes**. Leave the image picker blank to keep the current image; select a replacement image to upload a new one.
- **Temporarily hide:** Edit the product and clear **Available to order**. This keeps its record and image but makes it unavailable for new orders.
- **Delete:** Select the trash button and confirm. This permanently deletes the database product. If its image is in the `product-images` bucket, the app also attempts to remove that file. If image cleanup fails, the product deletion still succeeds and a warning is shown; the remaining file can be removed under **Storage → product-images**.
- **Refresh:** Use **Refresh** on the product list to reload the database catalogue.

## Product fields

| Field | Use |
|---|---|
| Name and category | Product title and one of Cakes, Pastries, Desserts, or Special Treats |
| Description | Short catalogue text; full description is optional |
| Starting price | Listing price in NGN |
| Variants | Optional sizes or packs with their own NGN prices |
| Stock | Whole-number quantity available |
| Available to order | Controls whether customers can order the product |
| Featured / Bestseller | Controls the corresponding customer-facing product sections |
| Product image | Publicly readable image stored in Supabase Storage |

## Troubleshooting

- **Supabase is not configured:** Check `.env.local` or deployment environment variables, then restart/redeploy.
- **Invalid login:** Create or reset the staff account in Supabase Authentication.
- **“Admin access required”:** Confirm the signed-in user's UUID has a row in `public.admin_users`.
- **Permission/RLS error:** Re-run/review `supabase/schema.sql`; confirm the user is authorised and has a valid Supabase session.
- **Image upload denied:** Confirm the `product-images` bucket and its policies exist, and the file is JPG, PNG, or WebP and no larger than 5 MB.
- **Product save denied:** Check the category, positive starting/variant prices, non-negative whole stock count, required image for a new product, and uniqueness of the generated slug.
- **Order submission denied:** Check current availability/stock and variant selection, required customer details, delivery address/date, and the phone-number submission limit.
- **Sales desk shows a schema or permission error:** Apply the latest `schema.sql`, sign in with an authorised admin, and verify the orders, order-items, and enquiry select policies.
- **No products appear:** Confirm the row exists in `public.products`, is available as expected, and the app is connected to the same Supabase project.

## Current scope

The admin screen manages products, website orders, and custom-cake enquiry statuses, and records manually verified payment. It does not send staff notifications or collect/process payments through a gateway. Orders remain unpaid until staff record verified payment.
