-- =============================================================
-- Migración 049: invariantes de cuentas y cajas (W-08, `24` §6/§7.1)
-- RUL-CUENTAS-07: una caja nunca queda con saldo negativo.
-- 24 §7.1: el nombre de una cuenta es único por usuario sin distinguir
--   mayúsculas ("BCP" y "bcp" no deben poder coexistir).
-- =============================================================

begin;

-- ── boxes: saldo nunca negativo ────────────────────────────────
-- Hasta ahora solo se comprobaba en la ruta de aplicación
-- (money/actions); esto lo protege tambien contra cualquier otro
-- camino de escritura (deudas, recurrentes) presente o futuro.
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'boxes_current_balance_non_negative'
      and conrelid = 'public.boxes'::regclass
  ) then
    alter table public.boxes
      add constraint boxes_current_balance_non_negative
      check (current_balance >= 0);
  end if;
end $$;

-- ── accounts: nombre único por usuario, sin distinguir mayúsculas ──
-- El índice anterior comparaba `name` tal cual, así que "BCP" y "bcp"
-- podían coexistir — contradice `24` §7.1. Una expresión (`lower(name)`)
-- no cabe en un `unique` de tabla: se reemplaza por un índice único
-- equivalente, con la misma semántica `nulls not distinct` sobre
-- `deleted_at` que ya tenía (dos cuentas archivadas nunca colisionan
-- entre sí porque su `deleted_at` difiere).
alter table public.accounts
  drop constraint if exists accounts_unique_name_per_user;

create unique index if not exists accounts_unique_name_per_user_ci
  on public.accounts (user_id, lower(name), deleted_at)
  nulls not distinct;

commit;
