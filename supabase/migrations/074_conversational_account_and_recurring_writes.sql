-- =============================================================
-- Migration 074: Conversational writes for accounts, recurring rules
--                and the full structure lifecycle
-- Corte feat/recurrentes-cuentas-ciclo-de-vida - RUL-ESTR-05, RUL-REC-01
-- Depends on: 001-073
-- =============================================================
--
-- Esta migracion es deliberadamente pequeña. Lo que se amplia en este corte
-- —pagos recurrentes, cuentas y el ciclo de vida completo (archivar, pausar,
-- reanudar)— ya tiene ejecutor en la base o no lo necesita. Se verifico uno
-- por uno antes de escribir una linea:
--
-- 1. METAS Y PRESUPUESTOS: nada que hacer.
--    `061_w12_budgets_goals.sql` ya acepta el ciclo de vida completo en sus
--    dos RPC. `manzana.commit_budget_operation` admite
--    ('create','update','archive','pause','resume','restore','copy_previous')
--    y `manzana.commit_goal_operation` admite
--    ('create','update','archive','pause','resume','restore','link_box',
--    'unlink_box'). Las variantes `_for_user` que creo `071` pasan
--    `p_operation` tal cual, asi que archivar, pausar y reanudar conversando
--    ya funcionan con lo desplegado. No hay RPC nuevo ni permiso nuevo.
--
-- 2. PAGOS RECURRENTES: nada que hacer.
--    Una regla recurrente no tiene RPC transaccional de alta —`059` solo creo
--    `commit_recurring_occurrence_skip`, y `commit_recurring_payment` existe
--    para cuando la ocurrencia se paga, que es lo unico que mueve dinero—. La
--    regla se escribe sobre `public.recurring_rules`, que ya trae de `058`
--    todo el contrato duro que hace falta: indice unico
--    `recurring_rules_user_creation_key_unique (user_id,
--    creation_idempotency_key)`, la columna `creation_request_hash` para
--    detectar la misma clave con datos distintos, y
--    `recurring_rules_user_active_name_unique` contra nombres repetidos. El
--    motor conversacional corre con el cliente de servicio y filtra por
--    `user_id` en sus propias consultas, asi que tampoco necesita una variante
--    `_for_user`: no hay `auth.uid()` de por medio.
--
-- 3. AUDITORIA: nada que hacer.
--    `movement_audit_log.entity_type` es texto libre, asi que `recurring_rule`
--    y `account` entran sin tocar el esquema. Y `movement_audit_action_known`
--    (`006`, ampliada en `046`) ya admite `deleted`, que es como se anota un
--    archivado —un borrado logico—; pausar y reanudar se anotan como
--    `updated`, que tambien esta admitido. Ningun check cambia.
--
-- 4. CUENTAS: esto si falta, y es lo unico que hace esta migracion.
--    Una cuenta se escribe sobre `public.accounts`, que —a diferencia de
--    `recurring_rules`— no tiene columna de idempotencia. Sin ella, un doble
--    envio del mismo boton crearia dos cuentas identicas. Se sella igual que
--    una caja: en `metadata->>'structure_idempotency_key'`, con el mismo
--    indice parcial que `071` creo para `public.boxes`.
--
-- Reejecutable: `create index if not exists` mas su comentario.

set search_path = public, manzana;

-- -------------------------------------------------------------
-- Cuentas: busqueda por clave de idempotencia conversacional
-- -------------------------------------------------------------

create index if not exists accounts_structure_idempotency_idx
  on public.accounts ((metadata->>'structure_idempotency_key'))
  where metadata ? 'structure_idempotency_key';

comment on index public.accounts_structure_idempotency_idx is
  'RUL-ESTR-03: busqueda por clave de idempotencia de una cuenta creada conversando, para que un doble envio encuentre la de la primera vez en vez de crear otra. Hermano de boxes_structure_idempotency_idx (071).';
