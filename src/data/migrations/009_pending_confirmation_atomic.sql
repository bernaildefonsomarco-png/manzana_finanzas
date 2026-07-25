-- =============================================================
-- Migration 009: Atomic pending confirmation
-- Corte 7 - Pending confirmation + movement + outbox in one transaction
-- Depends on: 001, 006, 007, 008
-- =============================================================

create or replace function manzana.confirm_pending_with_movement(
  p_user_id uuid,
  p_pending_id uuid,
  p_actor_id text,
  p_movement jsonb,
  p_audit_logs jsonb,
  p_account_deltas jsonb,
  p_box_deltas jsonb,
  p_movement_outbox_events jsonb,
  p_trace_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, manzana
as $$
declare
  v_pending public.pending_items;
  v_movement public.movements;
  v_confirmed_movement_id uuid;
  v_existing_movement boolean := false;
  v_now timestamptz := now();
begin
  select *
    into v_pending
    from public.pending_items
   where id = p_pending_id
     and user_id = p_user_id
   for update;

  if not found then
    raise exception 'PENDING_ITEM_NOT_FOUND';
  end if;

  if v_pending.status = 'user_confirmed' then
    v_confirmed_movement_id := nullif(v_pending.metadata->>'confirmed_movement_id', '')::uuid;

    if v_confirmed_movement_id is not null then
      select *
        into v_movement
        from public.movements
       where id = v_confirmed_movement_id
         and user_id = p_user_id;

      if found then
        return jsonb_build_object(
          'pending_item', to_jsonb(v_pending),
          'movement', to_jsonb(v_movement),
          'idempotent', true
        );
      end if;
    end if;

    select *
      into v_movement
      from public.movements
     where user_id = p_user_id
       and idempotency_key = p_movement->>'idempotency_key';

    if found then
      update public.pending_items
         set metadata = v_pending.metadata || jsonb_build_object(
               'confirmed_movement_id', v_movement.id,
               'confirmed_at', coalesce(v_pending.resolved_at, v_now)
             )
       where id = p_pending_id
         and user_id = p_user_id
       returning * into v_pending;

      return jsonb_build_object(
        'pending_item', to_jsonb(v_pending),
        'movement', to_jsonb(v_movement),
        'idempotent', true
      );
    end if;

    raise exception 'PENDING_ITEM_ALREADY_RESOLVED';
  end if;

  if v_pending.status in ('discarded', 'auto_resolved_duplicate', 'expired', 'archived') then
    raise exception 'PENDING_ITEM_ALREADY_RESOLVED';
  end if;

  select exists (
    select 1
      from public.movements
     where user_id = p_user_id
       and idempotency_key = p_movement->>'idempotency_key'
  ) into v_existing_movement;

  v_movement := manzana.core_commit_movement_create(
    p_movement,
    p_audit_logs,
    p_account_deltas,
    p_box_deltas,
    p_movement_outbox_events
  );

  update public.pending_items
     set status = 'user_confirmed',
         resolved_at = v_now,
         resolved_by = p_actor_id,
         metadata = v_pending.metadata || jsonb_build_object(
           'confirmed_movement_id', v_movement.id,
           'confirmed_at', v_now
         )
   where id = p_pending_id
     and user_id = p_user_id
   returning * into v_pending;

  insert into public.transactional_outbox (
    id,
    user_id,
    event_type,
    aggregate_type,
    aggregate_id,
    payload,
    payload_version,
    status,
    trace_id,
    metadata
  )
  values (
    gen_random_uuid(),
    p_user_id,
    'pending_confirmed',
    'pending_item',
    v_pending.id,
    jsonb_build_object(
      'pending_item_id', v_pending.id,
      'pending_type', v_pending.type,
      'pending_status', v_pending.status,
      'pending_source', v_pending.source,
      'source_ref', v_pending.source_ref,
      'movement_id', v_movement.id
    ),
    1,
    'pending',
    p_trace_id,
    jsonb_build_object(
      'risk_level', v_pending.risk_level,
      'actor_id', p_actor_id
    )
  );

  return jsonb_build_object(
    'pending_item', to_jsonb(v_pending),
    'movement', to_jsonb(v_movement),
    'idempotent', v_existing_movement
  );
end;
$$;

create or replace function public.confirm_pending_with_movement(
  p_user_id uuid,
  p_pending_id uuid,
  p_actor_id text,
  p_movement jsonb,
  p_audit_logs jsonb,
  p_account_deltas jsonb,
  p_box_deltas jsonb,
  p_movement_outbox_events jsonb,
  p_trace_id uuid
)
returns jsonb
language sql
security definer
set search_path = public, manzana
as $$
  select manzana.confirm_pending_with_movement(
    p_user_id,
    p_pending_id,
    p_actor_id,
    p_movement,
    p_audit_logs,
    p_account_deltas,
    p_box_deltas,
    p_movement_outbox_events,
    p_trace_id
  );
$$;

revoke all on function manzana.confirm_pending_with_movement(
  uuid, uuid, text, jsonb, jsonb, jsonb, jsonb, jsonb, uuid
) from public, anon, authenticated;
revoke all on function public.confirm_pending_with_movement(
  uuid, uuid, text, jsonb, jsonb, jsonb, jsonb, jsonb, uuid
) from public, anon, authenticated;

grant execute on function manzana.confirm_pending_with_movement(
  uuid, uuid, text, jsonb, jsonb, jsonb, jsonb, jsonb, uuid
) to service_role;
grant execute on function public.confirm_pending_with_movement(
  uuid, uuid, text, jsonb, jsonb, jsonb, jsonb, jsonb, uuid
) to service_role;
