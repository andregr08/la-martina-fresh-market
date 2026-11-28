do $$
declare
  v_seq text;
begin

  -- PEDIDOS DE PRUEBA
  if to_regclass('public.restaurant_order_items') is not null then
    delete from public.restaurant_order_items;
  end if;

  if to_regclass('public.restaurant_orders') is not null then
    delete from public.restaurant_orders;
  end if;

  -- DEVOLUCIONES DE VENTAS DE PRUEBA
  if to_regclass('public.sale_refunds') is not null then
    delete from public.sale_refunds;
  end if;

  -- TICKETS DE PRUEBA
  if to_regclass('public.tickets') is not null then
    delete from public.tickets;
  end if;

  -- DETALLES DE VENTAS
  if to_regclass('public.sale_items') is not null then
    delete from public.sale_items;
  end if;

  -- VENTAS DE PRUEBA
  if to_regclass('public.sales') is not null then
    delete from public.sales;
  end if;

  -- SOLO MOVIMIENTOS DE CAJA GENERADOS POR VENTAS/DEVOLUCIONES
  -- NO TOCA gastos, aperturas ni ajustes.
  if to_regclass('public.cash_movements') is not null then
    delete from public.cash_movements
    where movement_type in ('sale', 'refund');
  end if;

  -- AUDITORÍA DE LAS PRUEBAS
  if to_regclass('public.audit_logs') is not null then
    delete from public.audit_logs
    where table_name in (
      'restaurant_orders',
      'restaurant_order_items',
      'sales',
      'sale_items',
      'sale_refunds',
      'tickets'
    );
  end if;

  -- REINICIAR NÚMERO DE PEDIDOS A 1
  v_seq := pg_get_serial_sequence(
    'public.restaurant_orders',
    'order_number'
  );

  if v_seq is not null then
    execute format(
      'alter sequence %s restart with 1',
      v_seq
    );
  end if;

end
$$;
