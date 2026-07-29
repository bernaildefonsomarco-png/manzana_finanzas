-- =============================================================
-- Migración 050: conteo de movimientos por subcategoría (W-08, `25` §8)
-- SCR-CAT-02 ("Subcategorías con conteo de movimientos") y SCR-CAT-03
-- ("Muestra primero las más usadas"). RUL-CAT-11: los mismos tipos que
-- `aggregateCategoryTotals` excluye (transferencia, asignación interna,
-- préstamos, devolución, deuda adquirida, ajuste) tampoco cuentan aquí.
-- =============================================================

begin;

create index if not exists movements_user_subcategory_idx
  on public.movements (user_id, subcategory_id)
  where deleted_at is null and subcategory_id is not null;

-- `security invoker` (por defecto): se apoya en la RLS de `movements`
-- ("select own") para no necesitar permisos elevados — cuenta solo lo que
-- el usuario ya podría leer con su propio cliente autenticado.
create or replace function public.count_movements_by_subcategory()
returns table (subcategory_id uuid, movement_count bigint)
language sql
stable
set search_path = public, pg_temp
as $$
  select
    m.subcategory_id,
    count(*) as movement_count
  from public.movements m
  where m.user_id = auth.uid()
    and m.deleted_at is null
    and m.subcategory_id is not null
    and m.type not in (
      'transferencia', 'asignacion_interna', 'prestamo_dado',
      'prestamo_recibido', 'devolucion_recibida', 'deuda_adquirida', 'ajuste'
    )
  group by m.subcategory_id;
$$;

revoke all on function public.count_movements_by_subcategory() from public, anon;
grant execute on function public.count_movements_by_subcategory() to authenticated;

commit;
