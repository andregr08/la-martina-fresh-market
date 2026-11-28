do $$
declare
  v_club uuid;
  v_martina uuid;
begin

  select id into v_club
  from public.restaurant_products
  where lower(trim(name)) = 'club sandwich'
  limit 1;

  select id into v_martina
  from public.restaurant_products
  where lower(trim(name)) in (
    'sandwich la martina',
    'sándwich la martina'
  )
  limit 1;

  if v_club is null then
    raise exception 'No encontré Club Sandwich';
  end if;

  if v_martina is null then
    raise exception 'No encontré Sandwich La Martina';
  end if;

  -- Limpiar únicamente recetas anteriores de estos dos sandwiches
  delete from public.restaurant_recipe_items
  where restaurant_variant_id in (
    select id
    from public.restaurant_variants
    where restaurant_product_id in (
      v_club,
      v_martina
    )
  );

  /* =====================================================
     CLUB SANDWICH
     Jamón 70 g
     Manchego 30 g
     Jitomate 35 g
     Lechuga 20 g
     Aguacate 35 g
  ===================================================== */

  insert into public.restaurant_recipe_items (
    restaurant_variant_id,
    product_id,
    quantity,
    unit,
    inventory_quantity
  )
  select
    rv.id,
    ingredient.id,
    spec.qty,
    spec.recipe_unit,
    case
      when lower(ingredient.unit) in ('g','gr','gramo','gramos')
        then spec.qty
      else spec.qty / 1000.0
    end
  from public.restaurant_variants rv
  cross join (
    values
      ('jamon',     70.0, 'g'),
      ('manchego',  30.0, 'g'),
      ('jitomate',  35.0, 'g'),
      ('lechuga',   20.0, 'g'),
      ('aguacate',  35.0, 'g')
  ) as spec(pattern, qty, recipe_unit)
  cross join lateral (
    select p.id, p.unit
    from public.products p
    where p.active = true
      and translate(
        lower(p.name),
        'áéíóúüñ',
        'aeiouun'
      ) like '%' || spec.pattern || '%'
    order by
      case
        when translate(
          lower(trim(p.name)),
          'áéíóúüñ',
          'aeiouun'
        ) = spec.pattern then 0
        else 1
      end,
      p.name
    limit 1
  ) ingredient
  where rv.restaurant_product_id = v_club
    and rv.active = true;


  /* =====================================================
     SANDWICH LA MARTINA
     Pollo 80 g
     Manchego 30 g
     Jitomate 35 g
     Lechuga 20 g
     Aguacate 35 g
     Mayonesa 10 g
     Chipotle 8 ml
  ===================================================== */

  insert into public.restaurant_recipe_items (
    restaurant_variant_id,
    product_id,
    quantity,
    unit,
    inventory_quantity
  )
  select
    rv.id,
    ingredient.id,
    spec.qty,
    spec.recipe_unit,
    case
      when spec.recipe_unit = 'ml' then
        case
          when lower(ingredient.unit) in ('ml','mililitro','mililitros')
            then spec.qty
          when lower(ingredient.unit) in ('l','lt','litro','litros')
            then spec.qty / 1000.0
          else spec.qty / 1000.0
        end
      else
        case
          when lower(ingredient.unit) in ('g','gr','gramo','gramos')
            then spec.qty
          else spec.qty / 1000.0
        end
    end
  from public.restaurant_variants rv
  cross join (
    values
      ('pollo',     80.0, 'g'),
      ('manchego',  30.0, 'g'),
      ('jitomate',  35.0, 'g'),
      ('lechuga',   20.0, 'g'),
      ('aguacate',  35.0, 'g'),
      ('mayonesa',  10.0, 'g'),
      ('chipotle',    8.0, 'ml')
  ) as spec(pattern, qty, recipe_unit)
  cross join lateral (
    select p.id, p.unit
    from public.products p
    where p.active = true
      and translate(
        lower(p.name),
        'áéíóúüñ',
        'aeiouun'
      ) like '%' || spec.pattern || '%'
    order by
      case
        when translate(
          lower(trim(p.name)),
          'áéíóúüñ',
          'aeiouun'
        ) = spec.pattern then 0
        else 1
      end,
      p.name
    limit 1
  ) ingredient
  where rv.restaurant_product_id = v_martina
    and rv.active = true;

end
$$;
