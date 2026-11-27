do $$
declare
  v_category_id uuid;
begin
  select id
  into v_category_id
  from public.categories
  where lower(name) like '%verd%'
     or lower(name) like '%frut%'
  order by name
  limit 1;

  if not exists (
    select 1
    from public.products
    where lower(trim(name)) = 'calabaza'
      and active = true
  ) then
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
