-- W-09 (WEB-D197): "ajuste" admite monto negativo.
-- 26_modulo_movimientos.md §4.1/§7 documenta "amount > 0 salvo en ajuste,
-- donde puede ser negativo" desde antes de W-09, pero el constraint de la
-- migracion 006 bloqueaba cualquier monto negativo para cualquier tipo.
alter table public.movements
  drop constraint movements_amount_non_negative;

alter table public.movements
  add constraint movements_amount_non_negative
    check (amount > 0 or (type = 'ajuste' and amount <> 0));
