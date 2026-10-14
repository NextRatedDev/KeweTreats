create extension if not exists pgcrypto;

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  category text not null check (category in ('Cakes', 'Pastries', 'Desserts', 'Special Treats')),
  description text not null,
  long_description text not null default '',
  price numeric(12, 2) not null check (price > 0),
  image text not null,
  images jsonb not null default '[]'::jsonb,
  featured boolean not null default false,
  bestseller boolean not null default false,
  available boolean not null default true,
  stock integer not null default 0 check (stock >= 0),
  variants jsonb not null default '[]'::jsonb,
  customisation_prompt text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.admin_users (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  order_reference text not null unique default ('KT-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10))),
  customer_name text not null,
  phone text not null,
  email text,
  delivery_method text not null check (delivery_method in ('delivery', 'pickup')),
  address text,
  preferred_date date not null,
  preferred_time text not null,
  notes text,
  subtotal numeric(12, 2) not null check (subtotal >= 0),
  delivery_fee numeric(12, 2) not null check (delivery_fee >= 0),
  total numeric(12, 2) not null check (total = subtotal + delivery_fee),
  status text not null default 'pending' check (status in ('pending', 'confirmed', 'cancelled', 'fulfilled')),
  paid boolean not null default false,
  created_at timestamptz not null default now(),
  check (delivery_method <> 'delivery' or nullif(trim(address), '') is not null)
);

alter table public.orders
  add column if not exists paid_at timestamptz;

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  product_id uuid references public.products (id) on delete set null,
  product_name text not null,
  variant text not null,
  unit_price numeric(12, 2) not null check (unit_price > 0),
  quantity integer not null check (quantity between 1 and 50),
  created_at timestamptz not null default now()
);

create table if not exists public.custom_cake_enquiries (
  id uuid primary key default gen_random_uuid(),
  event_type text not null,
  servings text not null,
  flavour text not null,
  design text not null,
  reference_image text,
  budget text not null,
  required_date date not null,
  customer_name text not null,
  phone text not null,
  email text,
  instructions text,
  status text not null default 'enquiry' check (status in ('enquiry', 'contacted', 'quoted', 'accepted', 'declined')),
  created_at timestamptz not null default now()
);

create table if not exists public.customer_submission_events (
  id bigint generated always as identity primary key,
  phone text not null,
  created_at timestamptz not null default now()
);

create index if not exists customer_submission_events_phone_created_idx
  on public.customer_submission_events (phone, created_at desc);
create index if not exists customer_submission_events_created_idx
  on public.customer_submission_events (created_at);

alter table public.products enable row level security;
alter table public.admin_users enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.custom_cake_enquiries enable row level security;
alter table public.customer_submission_events enable row level security;

grant select on public.products to anon, authenticated;
grant insert, update, delete on public.products to authenticated;
grant select on public.admin_users to authenticated;
grant select on public.orders, public.order_items, public.custom_cake_enquiries to authenticated;

revoke all on public.orders, public.order_items, public.custom_cake_enquiries, public.customer_submission_events from anon, authenticated;

create or replace function public.is_kewe_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.admin_users
    where user_id = (select auth.uid())
  );
$$;

revoke all on function public.is_kewe_admin() from public, anon, authenticated;
grant execute on function public.is_kewe_admin() to authenticated;

drop policy if exists "Admins can read orders" on public.orders;
create policy "Admins can read orders"
  on public.orders for select
  to authenticated
  using ((select public.is_kewe_admin()));

drop policy if exists "Admins can read order items" on public.order_items;
create policy "Admins can read order items"
  on public.order_items for select
  to authenticated
  using ((select public.is_kewe_admin()));

drop policy if exists "Admins can read custom cake enquiries" on public.custom_cake_enquiries;
create policy "Admins can read custom cake enquiries"
  on public.custom_cake_enquiries for select
  to authenticated
  using ((select public.is_kewe_admin()));

grant select on public.orders, public.order_items, public.custom_cake_enquiries to authenticated;

create or replace function public.enforce_customer_submission_rate_limit(p_phone text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  normalized_phone text := pg_catalog.regexp_replace(pg_catalog.btrim(p_phone), '[^0-9+]', '', 'g');
  recent_submissions integer;
begin
  if p_phone is null then
    raise exception 'Enter a valid phone number.' using errcode = '22023';
  end if;
  if pg_catalog.length(normalized_phone) < 8 or pg_catalog.length(normalized_phone) > 20 then
    raise exception 'Enter a valid phone number.' using errcode = '22023';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext(normalized_phone));

  select pg_catalog.count(*)::integer
  into recent_submissions
  from public.customer_submission_events
  where phone = normalized_phone
    and created_at > pg_catalog.now() - interval '1 hour';

  if recent_submissions >= 5 then
    raise exception 'Submission limit reached. Please try again later.' using errcode = 'P0001';
  end if;

  insert into public.customer_submission_events (phone)
  values (normalized_phone);

  delete from public.customer_submission_events
  where created_at < pg_catalog.now() - interval '1 day';
end;
$$;

revoke all on function public.enforce_customer_submission_rate_limit(text) from public, anon, authenticated;

create or replace function public.submit_customer_order(
  p_customer_name text,
  p_phone text,
  p_email text,
  p_delivery_method text,
  p_address text,
  p_preferred_date date,
  p_preferred_time text,
  p_notes text,
  p_items jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  item jsonb;
  product_row public.products%rowtype;
  requested_quantity integer;
  requested_variant text;
  verified_price numeric(12, 2);
  calculated_subtotal numeric(12, 2) := 0;
  calculated_delivery_fee numeric(12, 2);
  order_id uuid;
  generated_reference text;
begin
  if pg_catalog.length(pg_catalog.btrim(p_customer_name)) < 2
     or pg_catalog.length(p_customer_name) > 160 then
    raise exception 'Enter a valid customer name.' using errcode = '22023';
  end if;
  if p_delivery_method not in ('delivery', 'pickup') then
    raise exception 'Choose delivery or pickup.' using errcode = '22023';
  end if;
  if p_delivery_method = 'delivery' and pg_catalog.length(pg_catalog.btrim(coalesce(p_address, ''))) < 5 then
    raise exception 'Enter a delivery address.' using errcode = '22023';
  end if;
  if p_preferred_date is null or p_preferred_date < current_date then
    raise exception 'Choose a valid future delivery or pickup date.' using errcode = '22023';
  end if;
  if pg_catalog.length(pg_catalog.btrim(coalesce(p_preferred_time, ''))) < 1
     or pg_catalog.length(p_preferred_time) > 40 then
    raise exception 'Enter a valid preferred time.' using errcode = '22023';
  end if;
  if p_email is not null and pg_catalog.length(p_email) > 320 then
    raise exception 'Email address is too long.' using errcode = '22023';
  end if;
  if p_notes is not null and pg_catalog.length(p_notes) > 2000 then
    raise exception 'Order notes are too long.' using errcode = '22023';
  end if;
  if p_items is null or pg_catalog.jsonb_typeof(p_items) <> 'array'
     then
    raise exception 'An order must contain a product list.' using errcode = '22023';
  end if;
  if pg_catalog.jsonb_array_length(p_items) < 1
     or pg_catalog.jsonb_array_length(p_items) > 30 then
    raise exception 'An order must contain between 1 and 30 products.' using errcode = '22023';
  end if;

  for item in select value from pg_catalog.jsonb_array_elements(p_items)
  loop
    if coalesce(item->>'product_id', '') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
       or coalesce(item->>'quantity', '') !~ '^[0-9]+$' then
      raise exception 'An order item is invalid.' using errcode = '22023';
    end if;

    requested_quantity := (item->>'quantity')::integer;
    if requested_quantity < 1 or requested_quantity > 50 then
      raise exception 'Product quantities must be between 1 and 50.' using errcode = '22023';
    end if;
    requested_variant := coalesce(nullif(pg_catalog.btrim(item->>'variant'), ''), 'Standard');

    select *
    into product_row
    from public.products
    where id = (item->>'product_id')::uuid
      and available = true
      and stock >= requested_quantity
    for share;

    if not found then
      raise exception 'A selected product is unavailable or does not have enough stock.' using errcode = 'P0001';
    end if;

    if pg_catalog.jsonb_typeof(product_row.variants) = 'array'
       and pg_catalog.jsonb_array_length(product_row.variants) > 0 then
      select (variant->>'price')::numeric(12, 2)
      into verified_price
      from pg_catalog.jsonb_array_elements(product_row.variants) as variants(value)
      where value->>'label' = requested_variant
      limit 1;

      if verified_price is null then
        raise exception 'A selected product size is no longer available.' using errcode = 'P0001';
      end if;
    else
      if requested_variant <> 'Standard' then
        raise exception 'A selected product size is no longer available.' using errcode = 'P0001';
      end if;
      verified_price := product_row.price;
    end if;

    calculated_subtotal := calculated_subtotal + verified_price * requested_quantity;
  end loop;

  calculated_delivery_fee := case
    when p_delivery_method = 'delivery' and calculated_subtotal <= 60000 then 2500
    else 0
  end;

  perform public.enforce_customer_submission_rate_limit(p_phone);

  insert into public.orders (
    customer_name, phone, email, delivery_method, address, preferred_date,
    preferred_time, notes, subtotal, delivery_fee, total
  )
  values (
    pg_catalog.btrim(p_customer_name),
    pg_catalog.regexp_replace(pg_catalog.btrim(p_phone), '[^0-9+]', '', 'g'),
    nullif(pg_catalog.btrim(p_email), ''),
    p_delivery_method,
    nullif(pg_catalog.btrim(p_address), ''),
    p_preferred_date,
    pg_catalog.btrim(p_preferred_time),
    nullif(pg_catalog.btrim(p_notes), ''),
    calculated_subtotal,
    calculated_delivery_fee,
    calculated_subtotal + calculated_delivery_fee
  )
  returning id, order_reference into order_id, generated_reference;

  for item in select value from pg_catalog.jsonb_array_elements(p_items)
  loop
    requested_variant := coalesce(nullif(pg_catalog.btrim(item->>'variant'), ''), 'Standard');
    requested_quantity := (item->>'quantity')::integer;
    update public.products
    set stock = stock - requested_quantity
    where id = (item->>'product_id')::uuid
      and available = true
      and stock >= requested_quantity
    returning * into product_row;
    if not found then
      raise exception 'A selected product no longer has enough stock.' using errcode = 'P0001';
    end if;

    if pg_catalog.jsonb_typeof(product_row.variants) = 'array'
       and pg_catalog.jsonb_array_length(product_row.variants) > 0 then
      select (variant->>'price')::numeric(12, 2)
      into verified_price
      from pg_catalog.jsonb_array_elements(product_row.variants) as variants(value)
      where value->>'label' = requested_variant
      limit 1;
    else
      verified_price := product_row.price;
    end if;

    insert into public.order_items (order_id, product_id, product_name, variant, unit_price, quantity)
    values (
      order_id,
      product_row.id,
      product_row.name,
      requested_variant,
      verified_price,
      (item->>'quantity')::integer
    );
  end loop;

  return pg_catalog.jsonb_build_object(
    'order_reference', generated_reference,
    'subtotal', calculated_subtotal,
    'delivery_fee', calculated_delivery_fee,
    'total', calculated_subtotal + calculated_delivery_fee,
    'status', 'pending',
    'paid', false
  );
end;
$$;

create or replace function public.submit_custom_cake_enquiry(p_enquiry jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  enquiry_id uuid;
  enquiry_phone text := p_enquiry->>'phone';
  required_date date;
begin
  if p_enquiry is null or pg_catalog.jsonb_typeof(p_enquiry) <> 'object'
     or pg_catalog.length(pg_catalog.btrim(coalesce(p_enquiry->>'customerName', ''))) < 2
     or pg_catalog.length(coalesce(p_enquiry->>'customerName', '')) > 160
     or pg_catalog.length(pg_catalog.btrim(coalesce(p_enquiry->>'eventType', ''))) < 1
     or pg_catalog.length(coalesce(p_enquiry->>'eventType', '')) > 80
     or pg_catalog.length(pg_catalog.btrim(coalesce(p_enquiry->>'servings', ''))) < 1
     or pg_catalog.length(coalesce(p_enquiry->>'servings', '')) > 80
     or pg_catalog.length(pg_catalog.btrim(coalesce(p_enquiry->>'flavour', ''))) < 1
     or pg_catalog.length(coalesce(p_enquiry->>'flavour', '')) > 160
     or pg_catalog.length(pg_catalog.btrim(coalesce(p_enquiry->>'design', ''))) < 1
     or pg_catalog.length(coalesce(p_enquiry->>'design', '')) > 2000
     or pg_catalog.length(pg_catalog.btrim(coalesce(p_enquiry->>'budget', ''))) < 1
     or pg_catalog.length(coalesce(p_enquiry->>'budget', '')) > 120
     or pg_catalog.length(coalesce(p_enquiry->>'instructions', '')) > 2000
     or pg_catalog.length(coalesce(p_enquiry->>'referenceImage', '')) > 2048
     or pg_catalog.length(coalesce(p_enquiry->>'email', '')) > 320 then
    raise exception 'Complete the required custom cake enquiry fields.' using errcode = '22023';
  end if;

  begin
    required_date := (p_enquiry->>'requiredDate')::date;
  exception when others then
    raise exception 'Choose a valid required date.' using errcode = '22023';
  end;
  if required_date < current_date then
    raise exception 'Choose a future required date.' using errcode = '22023';
  end if;

  perform public.enforce_customer_submission_rate_limit(enquiry_phone);

  insert into public.custom_cake_enquiries (
    event_type, servings, flavour, design, reference_image, budget, required_date,
    customer_name, phone, email, instructions
  )
  values (
    pg_catalog.btrim(p_enquiry->>'eventType'),
    pg_catalog.btrim(p_enquiry->>'servings'),
    pg_catalog.btrim(p_enquiry->>'flavour'),
    pg_catalog.btrim(p_enquiry->>'design'),
    nullif(pg_catalog.btrim(p_enquiry->>'referenceImage'), ''),
    pg_catalog.btrim(p_enquiry->>'budget'),
    required_date,
    pg_catalog.btrim(p_enquiry->>'customerName'),
    pg_catalog.regexp_replace(pg_catalog.btrim(enquiry_phone), '[^0-9+]', '', 'g'),
    nullif(pg_catalog.btrim(p_enquiry->>'email'), ''),
    nullif(pg_catalog.btrim(p_enquiry->>'instructions'), '')
  )
  returning id into enquiry_id;

  return enquiry_id;
end;
$$;

create or replace function public.admin_update_order_status(p_order_id uuid, p_status text)
returns public.orders
language plpgsql
security definer
set search_path = ''
as $$
declare
  order_row public.orders%rowtype;
  item_row record;
begin
  if not (select public.is_kewe_admin()) then
    raise exception 'Admin access required.' using errcode = '42501';
  end if;

  select *
  into order_row
  from public.orders
  where id = p_order_id
  for update;

  if not found then
    raise exception 'Order not found.' using errcode = 'P0002';
  end if;
  if p_status not in ('confirmed', 'cancelled', 'fulfilled') then
    raise exception 'Choose a valid order status.' using errcode = '22023';
  end if;
  if order_row.status = p_status then
    return order_row;
  end if;

  if order_row.status = 'pending' and p_status not in ('confirmed', 'cancelled') then
    raise exception 'Pending orders must be confirmed or cancelled first.' using errcode = 'P0001';
  end if;
  if order_row.status = 'confirmed' and p_status not in ('fulfilled', 'cancelled') then
    raise exception 'Confirmed orders can only be fulfilled or cancelled.' using errcode = 'P0001';
  end if;
  if order_row.status in ('cancelled', 'fulfilled') then
    raise exception 'Cancelled and fulfilled orders cannot be changed.' using errcode = 'P0001';
  end if;

  if p_status = 'cancelled' then
    for item_row in
      select product_id, sum(quantity)::integer as quantity
      from public.order_items
      where order_id = order_row.id
        and product_id is not null
      group by product_id
    loop
      update public.products
      set stock = stock + item_row.quantity,
          updated_at = pg_catalog.now()
      where id = item_row.product_id;
    end loop;
  end if;

  update public.orders
  set status = p_status
  where id = order_row.id
  returning * into order_row;

  return order_row;
end;
$$;

create or replace function public.admin_update_enquiry_status(p_enquiry_id uuid, p_status text)
returns public.custom_cake_enquiries
language plpgsql
security definer
set search_path = ''
as $$
declare
  enquiry_row public.custom_cake_enquiries%rowtype;
begin
  if not (select public.is_kewe_admin()) then
    raise exception 'Admin access required.' using errcode = '42501';
  end if;
  if p_status not in ('enquiry', 'contacted', 'quoted', 'accepted', 'declined') then
    raise exception 'Choose a valid enquiry status.' using errcode = '22023';
  end if;

  update public.custom_cake_enquiries
  set status = p_status
  where id = p_enquiry_id
  returning * into enquiry_row;

  if not found then
    raise exception 'Enquiry not found.' using errcode = 'P0002';
  end if;

  return enquiry_row;
end;
$$;

create or replace function public.admin_mark_order_paid(p_order_id uuid)
returns public.orders
language plpgsql
security definer
set search_path = ''
as $$
declare
  order_row public.orders%rowtype;
begin
  if not (select public.is_kewe_admin()) then
    raise exception 'Admin access required.' using errcode = '42501';
  end if;

  select *
  into order_row
  from public.orders
  where id = p_order_id
  for update;

  if not found then
    raise exception 'Order not found.' using errcode = 'P0002';
  end if;
  if order_row.status not in ('confirmed', 'fulfilled') then
    raise exception 'Only confirmed or fulfilled orders can be marked paid.' using errcode = 'P0001';
  end if;
  if order_row.paid then
    return order_row;
  end if;

  update public.orders
  set paid = true,
      paid_at = pg_catalog.now()
  where id = order_row.id
  returning * into order_row;

  return order_row;
end;
$$;

revoke all on function public.submit_customer_order(text, text, text, text, text, date, text, text, jsonb) from public;
revoke all on function public.submit_custom_cake_enquiry(jsonb) from public;
revoke all on function public.admin_update_order_status(uuid, text) from public;
revoke all on function public.admin_update_enquiry_status(uuid, text) from public;
revoke all on function public.admin_mark_order_paid(uuid) from public;
grant execute on function public.submit_customer_order(text, text, text, text, text, date, text, text, jsonb) to anon, authenticated;
grant execute on function public.submit_custom_cake_enquiry(jsonb) to anon, authenticated;
grant execute on function public.admin_update_order_status(uuid, text) to authenticated;
grant execute on function public.admin_update_enquiry_status(uuid, text) to authenticated;
grant execute on function public.admin_mark_order_paid(uuid) to authenticated;

drop policy if exists "Products are publicly readable" on public.products;
create policy "Products are publicly readable"
  on public.products for select
  to anon, authenticated
  using (true);

drop policy if exists "Admins can insert products" on public.products;
create policy "Admins can insert products"
  on public.products for insert
  to authenticated
  with check ((select public.is_kewe_admin()));

drop policy if exists "Admins can update products" on public.products;
create policy "Admins can update products"
  on public.products for update
  to authenticated
  using ((select public.is_kewe_admin()))
  with check ((select public.is_kewe_admin()));

drop policy if exists "Admins can delete products" on public.products;
create policy "Admins can delete products"
  on public.products for delete
  to authenticated
  using ((select public.is_kewe_admin()));

drop policy if exists "Admins can read their own admin record" on public.admin_users;
create policy "Admins can read their own admin record"
  on public.admin_users for select
  to authenticated
  using (user_id = (select auth.uid()));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'product-images',
  'product-images',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Product images are publicly readable" on storage.objects;
create policy "Product images are publicly readable"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'product-images');

drop policy if exists "Admins can upload product images" on storage.objects;
create policy "Admins can upload product images"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'product-images'
    and (select public.is_kewe_admin())
  );

drop policy if exists "Admins can update product images" on storage.objects;
create policy "Admins can update product images"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'product-images'
    and (select public.is_kewe_admin())
  )
  with check (
    bucket_id = 'product-images'
    and (select public.is_kewe_admin())
  );

drop policy if exists "Admins can delete product images" on storage.objects;
create policy "Admins can delete product images"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'product-images'
    and (select public.is_kewe_admin())
  );
