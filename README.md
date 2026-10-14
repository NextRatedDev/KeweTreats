# Kewe Treats

A React, TypeScript, and Vite storefront for Kewe Treats, connected to Supabase for product catalog, staff authentication, order management, and custom cake enquiries.

## Run locally

Requirements: Node.js 22 or later and npm.

```sh
npm ci
```

Copy `.env.example` to `.env.local` and fill in the Supabase project URL and browser-safe publishable/anon key. Never put a Supabase secret or service-role key in a `VITE_` variable or in frontend code.

```sh
npm run dev
npm run build
npm test
npm run lint
```

When Supabase is not configured, the storefront uses its local mock product catalog. Database-backed order submission, staff sign-in, and product management require Supabase.

## Deploy to Cloudflare Pages

1. Push this repository to GitHub and import it in **Cloudflare Dashboard → Workers & Pages → Create → Pages → Connect to Git**.
2. Use these build settings:
   - Framework preset: **Vite**
   - Production branch: `main`
   - Build command: `npm run build`
   - Build output directory: `dist`
   - Root directory: `/`
3. Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` as Cloudflare Pages build environment variables for production (and preview, if needed). Use only the browser-safe publishable/anon key.
4. Deploy, then test the production site and a preview deployment. Cloudflare Pages serves this Vite single-page app with client-side route fallback.
5. Add any custom domain or subdomain in the Cloudflare Pages project under **Custom domains**. No custom hostname is defined in this repository.

## Supabase

Review and apply `supabase/schema.sql` in the Supabase SQL Editor. Follow [SUPABASE-ADMIN-GUIDE.md](./SUPABASE-ADMIN-GUIDE.md) to configure staff access and verify the product, order, enquiry, and image-storage setup.

Do not commit `.env.local`, Supabase secret/service-role keys, or production customer data.
