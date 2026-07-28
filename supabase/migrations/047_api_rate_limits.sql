begin;

-- Limite de peticiones (`14` §8, `AC-API-06`, `WEB-D179`, `WEB-D180`).
-- Sin Redis/Upstash en el stack: se implementa un contador de ventana
-- deslizante aproximada ("sliding window counter") sobre Postgres, el unico
-- almacen compartido entre invocaciones serverless que ya existe. La clave
-- es opaca para esta tabla: la construye quien llama (`src/proxy.ts`), por
-- ejemplo `reads:user:<uuid>` o `auth:ip:<hash>`.
create table if not exists public.api_rate_limit_counters (
  key text not null,
  window_start timestamptz not null,
  count integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (key, window_start)
);

alter table public.api_rate_limit_counters enable row level security;

-- No tiene user_id (algunas claves son por IP, antes de que exista sesion),
-- asi que no hay politica "select own" posible: se cierra a todo cliente y
-- solo el RPC (`security definer`) la toca.
drop policy if exists "api_rate_limit_counters: no client access"
  on public.api_rate_limit_counters;
create policy "api_rate_limit_counters: no client access"
  on public.api_rate_limit_counters for all
  using (false)
  with check (false);

revoke all on public.api_rate_limit_counters from public, anon, authenticated;
grant select, insert, update, delete on public.api_rate_limit_counters to service_role;

create or replace function public.check_and_increment_rate_limit(
  p_key text,
  p_window_seconds integer,
  p_max_count integer,
  p_now timestamptz default now()
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_current_window_start timestamptz;
  v_previous_window_start timestamptz;
  v_current_count integer := 0;
  v_previous_count integer := 0;
  v_elapsed_seconds numeric;
  v_previous_weight numeric;
  v_estimated numeric;
  v_allowed boolean;
  v_retry_after_seconds integer;
begin
  if p_window_seconds <= 0 or p_max_count <= 0 then
    raise exception 'RATE_LIMIT_PARAMS_INVALID';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_key, 0));

  v_current_window_start := to_timestamp(
    floor(extract(epoch from p_now) / p_window_seconds) * p_window_seconds
  );
  v_previous_window_start := v_current_window_start - make_interval(secs => p_window_seconds);

  select count into v_current_count
    from public.api_rate_limit_counters
   where key = p_key and window_start = v_current_window_start;
  v_current_count := coalesce(v_current_count, 0);

  select count into v_previous_count
    from public.api_rate_limit_counters
   where key = p_key and window_start = v_previous_window_start;
  v_previous_count := coalesce(v_previous_count, 0);

  v_elapsed_seconds := extract(epoch from (p_now - v_current_window_start));
  v_previous_weight := greatest(
    0,
    (p_window_seconds - v_elapsed_seconds) / p_window_seconds
  );
  v_estimated := (v_previous_count * v_previous_weight) + v_current_count;

  v_allowed := v_estimated < p_max_count;

  if v_allowed then
    insert into public.api_rate_limit_counters (key, window_start, count)
    values (p_key, v_current_window_start, 1)
    on conflict (key, window_start)
    do update set count = public.api_rate_limit_counters.count + 1,
                  updated_at = now();

    delete from public.api_rate_limit_counters
     where key = p_key and window_start < v_previous_window_start;

    v_retry_after_seconds := 0;
  else
    v_retry_after_seconds := greatest(1, ceil(p_window_seconds - v_elapsed_seconds)::int);
  end if;

  return jsonb_build_object(
    'allowed', v_allowed,
    'retry_after_seconds', v_retry_after_seconds,
    'remaining', greatest(0, p_max_count - ceil(v_estimated)::int)
  );
end;
$$;

revoke all on function public.check_and_increment_rate_limit(text, integer, integer, timestamptz)
  from public, anon, authenticated;
grant execute on function public.check_and_increment_rate_limit(text, integer, integer, timestamptz)
  to service_role;

commit;
