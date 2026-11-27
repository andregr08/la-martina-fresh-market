update public.restaurant_products
set description = 'Fruta natural'
where lower(name) like '%fruta%'
  and (
    lower(name) like '%vasito%'
    or lower(name) like '%fresh%'
  );
