-- Corte 31: separa rechazos de autenticacion de fallos de parsing.
-- Un rechazo DKIM/DMARC es una barrera de seguridad exitosa, no un error del
-- extractor. No persiste headers ni contenido del correo.

create or replace function manzana.update_email_template_health()
returns trigger
language plpgsql
security definer
set search_path = public, manzana
as $$
declare
  v_template_id uuid;
  v_shadow_template_id uuid;
  v_parse_mode text := coalesce(new.metadata->>'parse_mode', '');
begin
  if coalesce(new.metadata->>'template_id', '') !~
    '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  then
    return new;
  end if;

  v_template_id := (new.metadata->>'template_id')::uuid;

  update public.email_parse_templates
     set match_count = match_count
           + case
               when v_parse_mode <> 'shadow'
                and new.parsed_status in ('parsed', 'pending_created', 'deduplicated')
               then 1 else 0
             end,
         shadow_match_count = shadow_match_count
           + case when v_parse_mode = 'shadow' then 1 else 0 end,
         fallback_count = fallback_count
           + case when v_parse_mode = 'generic_fallback' then 1 else 0 end,
         parse_failure_count = parse_failure_count
           + case
               when v_parse_mode not in ('shadow', 'sender_auth_rejected')
                and new.parsed_status = 'parse_failed'
               then 1 else 0
             end,
         last_matched_at = case
           when v_parse_mode <> 'shadow'
            and new.parsed_status in ('parsed', 'pending_created', 'deduplicated')
           then now() else last_matched_at
         end,
         last_shadow_at = case
           when v_parse_mode = 'shadow' then now() else last_shadow_at
         end,
         last_failure_at = case
           when v_parse_mode not in ('shadow', 'sender_auth_rejected')
            and new.parsed_status = 'parse_failed'
           then now() else last_failure_at
         end
   where id = v_template_id;

  if coalesce(new.metadata->>'shadow_template_id', '') ~
    '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  then
    v_shadow_template_id := (new.metadata->>'shadow_template_id')::uuid;
    if v_shadow_template_id <> v_template_id then
      update public.email_parse_templates
         set shadow_match_count = shadow_match_count + 1,
             last_shadow_at = now()
       where id = v_shadow_template_id;
    end if;
  end if;

  return new;
end;
$$;

-- Recalcula el contador historico con la misma semantica corregida.
update public.email_parse_templates as template
   set parse_failure_count = (
         select count(*)
           from public.email_messages as message
          where message.metadata->>'template_id' = template.id::text
            and message.parsed_status = 'parse_failed'
            and coalesce(message.metadata->>'parse_mode', '')
                not in ('shadow', 'sender_auth_rejected')
       ),
       last_failure_at = (
         select max(message.created_at)
           from public.email_messages as message
          where message.metadata->>'template_id' = template.id::text
            and message.parsed_status = 'parse_failed'
            and coalesce(message.metadata->>'parse_mode', '')
                not in ('shadow', 'sender_auth_rejected')
       );

create or replace function public.get_email_sender_authentication_health(
  p_days int default 7
)
returns jsonb
language plpgsql
security definer
set search_path = public, manzana
as $$
declare
  v_days int;
  v_rejections bigint;
  v_content_fetch_violations bigint;
  v_unknown_reasons bigint;
  v_reasons jsonb;
begin
  v_days := greatest(1, least(coalesce(p_days, 7), 90));

  select
    count(*),
    count(*) filter (
      where metadata->>'content_fetched' = 'true'
    ),
    count(*) filter (
      where coalesce(metadata->>'sender_auth_reason', '') not in (
        'from_mismatch',
        'google_authentication_results_missing',
        'dmarc_pass_missing',
        'dmarc_domain_mismatch',
        'dkim_pass_missing',
        'dkim_domain_mismatch'
      )
    )
  into
    v_rejections,
    v_content_fetch_violations,
    v_unknown_reasons
  from public.email_messages
  where received_at >= now() - make_interval(days => v_days)
    and metadata->>'parse_mode' = 'sender_auth_rejected';

  select coalesce(jsonb_object_agg(reason, total), '{}'::jsonb)
    into v_reasons
    from (
      select
        case
          when metadata->>'sender_auth_reason' in (
            'from_mismatch',
            'google_authentication_results_missing',
            'dmarc_pass_missing',
            'dmarc_domain_mismatch',
            'dkim_pass_missing',
            'dkim_domain_mismatch'
          )
          then metadata->>'sender_auth_reason'
          else 'unknown'
        end as reason,
        count(*) as total
      from public.email_messages
      where received_at >= now() - make_interval(days => v_days)
        and metadata->>'parse_mode' = 'sender_auth_rejected'
      group by 1
    ) as reason_totals;

  return jsonb_build_object(
    'window_days', v_days,
    'sender_authentication_rejections', v_rejections,
    'content_fetch_violations', v_content_fetch_violations,
    'unknown_reason_count', v_unknown_reasons,
    'reasons', v_reasons,
    'targets', jsonb_build_object(
      'body_fetch_after_auth_rejection_zero',
        v_content_fetch_violations = 0,
      'auth_rejection_reason_known',
        v_unknown_reasons = 0
    )
  );
end;
$$;

revoke all on function public.get_email_sender_authentication_health(int)
  from public, anon, authenticated;
grant execute on function public.get_email_sender_authentication_health(int)
  to service_role;
