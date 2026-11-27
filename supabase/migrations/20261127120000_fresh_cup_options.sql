create or replace function public.get_fresh_cup_extra_options()
returns table (
  id uuid,
  name text,
  unit text,
  current_stock numeric
)
language sql
security definer
set search_path = public
as $$
  select
    p.id,
    p.name,
    p.unit,
    p.current_stock
  from public.products p
  where p.active = true
    and lower(trim(p.name)) in (
      'durazno',
      'zanahoria'
    )
  order by p.name;
$$;

grant execute on function public.get_fresh_cup_extra_options()
to anon, authenticated;
