do $$
declare
  v_griego_dish uuid;
  v_taro_dish uuid;

  v_griego_product uuid;
  v_taro_product uuid;

  v_category_id uuid;
  v_variant record;
  v_qty numeric;
begin

  /* =====================================================
     CATEGORÍA PARA LAS BASES
  ===================================================== */

  select id
  into v_category_id
  from public.categories
  where lower(name) like '%lact%'
     or lower(name) like '%helad%'
     or lower(name) like '%abarrot%'
  order by
    case
      when lower(name) like '%lact%' then 0
      when lower(name) like '%helad%' then 1
      else 2
    end
  limit 1;


  /* =====================================================
     ENCONTRAR PLATILLOS
  ===================================================== */

  select id
  into v_griego_dish
  from public.restaurant_products
  where active = true
    and (
      lower(name) like '%yogurt griego%'
      or lower(name) like '%helado griego%'
      or lower(name) like '%griego natural%'
    )
  limit 1;

  select id
  into v_taro_dish
  from public.restaurant_products
  where active = true
    and lower(name) like '%taro%'
  limit 1;

  if v_griego_dish is null then
    raise exception 'No encontré el platillo de Yogurt griego';
  end if;

  if v_taro_dish is null then
    raise exception 'No encontré el platillo Helado de taro';
  end if;


  /* =====================================================
     BASE YOGURT GRIEGO
     Buscar incluso si estaba inactiva
  ===================================================== */

  select id
  into v_griego_product
  from public.products
  where
    lower(name) like '%yogurt%'
    or lower(name) like '%griego%'
  order by
    case
      when lower(name) like '%griego%' then 0
      else 1
    end,
    name
  limit 1;

  if v_griego_product is null then

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
      'Base Yogurt Griego',
      'kg',
      v_category_id,
      0,
      0,
      1.600,
      0,
      0,
      null,
      true,
      true,
      now()
    )
    returning id
    into v_griego_product;

  else

    update public.products
    set
      active = true,
      unit = 'kg',
      current_stock =
        case
          when current_stock <= 0 then 1.600
          else current_stock
        end,
      updated_at = now()
    where id = v_griego_product;

  end if;


  /* =====================================================
     BASE TARO
  ===================================================== */

  select id
  into v_taro_product
  from public.products
  where lower(name) like '%taro%'
  order by name
  limit 1;

  if v_taro_product is null then

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
      'Base Taro',
      'kg',
      v_category_id,
      0,
      0,
      1.600,
      0,
      0,
      null,
      true,
      true,
      now()
    )
    returning id
    into v_taro_product;

  else

    update public.products
    set
      active = true,
      unit = 'kg',
      current_stock =
        case
          when current_stock <= 0 then 1.600
          else current_stock
        end,
      updated_at = now()
    where id = v_taro_product;

  end if;


  /* =====================================================
     BORRAR SOLO RECETAS DE ESTOS DOS HELADOS
  ===================================================== */

  delete from public.restaurant_recipe_items
  where restaurant_variant_id in (
    select id
    from public.restaurant_variants
    where restaurant_product_id in (
      v_griego_dish,
      v_taro_dish
    )
  );


  /* =====================================================
     RECETA YOGURT GRIEGO
  ===================================================== */

  for v_variant in
    select id, name
    from public.restaurant_variants
    where restaurant_product_id = v_griego_dish
      and active = true
  loop

    if lower(v_variant.name) like '%185%'
       or lower(v_variant.name) like '%mediano%' then

      v_qty := 185;

    elsif lower(v_variant.name) like '%285%'
       or lower(v_variant.name) like '%grande%' then

      v_qty := 285;

    else

      raise exception
        'Tamaño de Yogurt griego no reconocido: %',
        v_variant.name;

    end if;

    insert into public.restaurant_recipe_items (
      restaurant_variant_id,
      product_id,
      quantity,
      unit,
      inventory_quantity
    )
    values (
      v_variant.id,
      v_griego_product,
      v_qty,
      'g',
      v_qty / 1000.0
    );

  end loop;


  /* =====================================================
     RECETA TARO
  ===================================================== */

  for v_variant in
    select id, name
    from public.restaurant_variants
    where restaurant_product_id = v_taro_dish
      and active = true
  loop

    if lower(v_variant.name) like '%185%'
       or lower(v_variant.name) like '%mediano%' then

      v_qty := 185;

    elsif lower(v_variant.name) like '%285%'
       or lower(v_variant.name) like '%grande%' then

      v_qty := 285;

    else

      raise exception
        'Tamaño de Taro no reconocido: %',
        v_variant.name;

    end if;

    insert into public.restaurant_recipe_items (
      restaurant_variant_id,
      product_id,
      quantity,
      unit,
      inventory_quantity
    )
    values (
      v_variant.id,
      v_taro_product,
      v_qty,
      'g',
      v_qty / 1000.0
    );

  end loop;

end
$$;
