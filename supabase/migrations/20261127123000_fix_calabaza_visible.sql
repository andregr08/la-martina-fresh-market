do $$
declare
  v_category_id uuid;
begin
  select id
  into v_category_id
  from public.categories
  where lower(name) like '%verd%'
     or lower(name) like '%frut%'
  order by
    case
      when lower(name) like '%verd%' then 0
      else 1
    end,
    name
  limit 1;

  update public.products
  set
    unit = 'kg',
    purchase_price = 11,
    sale_price = 17,
    active = true,
    category_id = coalesce(v_category_id, category_id),
    updated_at = now()
  where lower(trim(name)) = 'calabaza';

  if not found then
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
      'Calabaza',
      'kg',
      v_category_id,
      11,
      17,
      0,
      0,
      0,
      null,
      true,
      true,
      now()
    );
  end if;
end
$$;
