alter table public.restaurant_order_items
add column if not exists customization jsonb;

create or replace function public.create_restaurant_order(
  p_order_type text,
  p_table_number text,
  p_notes text,
  p_items jsonb
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_order_id uuid;
  v_order_number bigint;
  v_subtotal numeric(12,2) := 0;
  v_item jsonb;
  v_variant_id uuid;
  v_quantity integer;
  v_unit_price numeric(12,2);
  v_product_id uuid;
  v_product_name text;
  v_variant_name text;
  v_line_total numeric(12,2);
  v_fruit_selections jsonb;
  v_customization jsonb;
begin
  if p_order_type not in ('table', 'takeaway') then
    raise exception 'Tipo de pedido inválido.';
  end if;

  if p_order_type = 'table'
     and nullif(trim(coalesce(p_table_number, '')), '') is null then
    raise exception 'Escribe tu número de mesa.';
  end if;

  if p_items is null
     or jsonb_typeof(p_items) <> 'array'
     or jsonb_array_length(p_items) = 0 then
    raise exception 'El pedido está vacío.';
  end if;

  insert into public.restaurant_orders (
    order_type,
    table_number,
    notes,
    status,
    subtotal,
    total
  )
  values (
    p_order_type,
    case
      when p_order_type = 'takeaway' then null
      else trim(p_table_number)
    end,
    nullif(trim(coalesce(p_notes, '')), ''),
    'pending',
    0,
    0
  )
  returning id, order_number
  into v_order_id, v_order_number;

  for v_item in
    select value
    from jsonb_array_elements(p_items)
  loop
    begin
      v_variant_id := (v_item ->> 'variant_id')::uuid;
      v_quantity := coalesce((v_item ->> 'quantity')::integer, 0);
    exception
      when others then
        raise exception 'Uno de los productos del pedido es inválido.';
    end;

    if v_quantity < 1 or v_quantity > 50 then
      raise exception 'Cantidad inválida en el pedido.';
    end if;

    select
      rv.sale_price,
      rp.id,
      rp.name,
      rv.name
    into
      v_unit_price,
      v_product_id,
      v_product_name,
      v_variant_name
    from public.restaurant_variants rv
    join public.restaurant_products rp
      on rp.id = rv.restaurant_product_id
    where rv.id = v_variant_id
      and rv.active = true
      and rp.active = true;

    if not found then
      raise exception 'Uno de los productos ya no está disponible.';
    end if;

    v_fruit_selections :=
      case
        when jsonb_typeof(v_item -> 'fruit_selections') = 'array'
          then v_item -> 'fruit_selections'
        else '[]'::jsonb
      end;

    if jsonb_array_length(v_fruit_selections) > 4 then
      raise exception 'Solo se permiten hasta 4 frutas por producto.';
    end if;

    v_customization :=
      case
        when jsonb_typeof(v_item -> 'customization') = 'object'
          then v_item -> 'customization'
        else null
      end;

    v_line_total :=
      round((v_unit_price * v_quantity)::numeric, 2);

    insert into public.restaurant_order_items (
      order_id,
      product_id,
      variant_id,
      product_name,
      variant_name,
      quantity,
      unit_price,
      line_total,
      fruit_selections,
      customization
    )
    values (
      v_order_id,
      v_product_id,
      v_variant_id,
      v_product_name,
      v_variant_name,
      v_quantity,
      v_unit_price,
      v_line_total,
      v_fruit_selections,
      v_customization
    );

    v_subtotal := v_subtotal + v_line_total;
  end loop;

  update public.restaurant_orders
  set
    subtotal = v_subtotal,
    total = v_subtotal
  where id = v_order_id;

  return jsonb_build_object(
    'order_id', v_order_id,
    'order_number', v_order_number,
    'total', v_subtotal
  );
end;
$function$;

grant execute
on function public.create_restaurant_order(text,text,text,jsonb)
to anon, authenticated;


create or replace function public.get_restaurant_active_orders()
returns jsonb
language sql
security definer
set search_path to 'public'
as $function$
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', o.id,
        'order_number', o.order_number,
        'order_type', o.order_type,
        'table_number', o.table_number,
        'notes', o.notes,
        'status', o.status,
        'subtotal', o.subtotal,
        'total', o.total,
        'payment_method', o.payment_method,
        'paid_at', o.paid_at,
        'sale_id', o.sale_id,
        'created_at', o.created_at,
        'updated_at', o.updated_at,
        'items', coalesce(
          (
            select jsonb_agg(
              jsonb_build_object(
                'id', i.id,
                'order_id', i.order_id,
                'product_id', i.product_id,
                'variant_id', i.variant_id,
                'product_name', i.product_name,
                'variant_name', i.variant_name,
                'quantity', i.quantity,
                'unit_price', i.unit_price,
                'line_total', i.line_total,
                'fruit_selections', i.fruit_selections,
                'customization', i.customization
              )
              order by i.created_at
            )
            from public.restaurant_order_items i
            where i.order_id = o.id
          ),
          '[]'::jsonb
        )
      )
      order by o.created_at
    ),
    '[]'::jsonb
  )
  from public.restaurant_orders o
  where o.status not in ('paid', 'cancelled');
$function$;

grant execute
on function public.get_restaurant_active_orders()
to authenticated;
