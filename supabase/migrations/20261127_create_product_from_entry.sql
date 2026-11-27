create or replace function public.create_product_from_entry(
  p_name text,
  p_purchase_price numeric
)
returns table (
  id uuid,
  sku text,
  name text,
  unit text,
  purchase_price numeric,
  category_name text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_category_id uuid;
  v_product_id uuid;
begin
  if auth.uid() is null then
    raise exception 'No autorizado';
  end if;

  select c.id
  into v_category_id
  from public.categories c
  where
    lower(c.name) like '%verd%'
    or lower(c.name) like '%frut%'
  order by c.name
  limit 1;

  select p.id
  into v_product_id
  from public.products p
  where lower(trim(p.name)) = lower(trim(p_name))
    and p.active = true
  limit 1;

  if v_product_id is null then
    insert into public.products (
      sku,
      name,
      unit,
      category_id,
      purchase_price,
      sale_price,
      current_stock,
      minimum_stock,
      ideal_stock,
      shelf_life_days,
      refrigerated,
      active,
      updated_at
    )
    values (
      null,
      trim(p_name),
      'kg',
      v_category_id,
      coalesce(p_purchase_price, 0),
      0,
      0,
      0,
      0,
      null,
      true,
      true,
      now()
    )
    returning products.id
    into v_product_id;
  end if;

  return query
  select
    p.id,
    p.sku,
    p.name,
    p.unit,
    p.purchase_price,
    c.name
  from public.products p
  left join public.categories c
    on c.id = p.category_id
  where p.id = v_product_id;
end;
$$;

grant execute on function public.create_product_from_entry(text, numeric)
to authenticated;
