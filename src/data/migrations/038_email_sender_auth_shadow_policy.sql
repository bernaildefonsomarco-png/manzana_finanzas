-- Corte 31: autenticidad del remitente, consentimiento IA y Gate F por
-- evidencia operacional. No contiene cuerpos, valores ni hashes de usuarios.

alter table public.email_parse_templates
  drop constraint if exists email_parse_templates_active_verified,
  add constraint email_parse_templates_active_verified
    check (
      activation_mode <> 'active'
      or (
        verification_status = 'verified'
        and verified_at is not null
        and metadata->>'sender_authentication' = 'dkim_dmarc_required'
        and metadata->>'shadow_reviewed' = 'true'
        and metadata->>'critical_error_count' = '0'
        and metadata->>'rollback_ready' = 'true'
        and case
          when coalesce(metadata->>'grounding_rate', '') ~
            '^(0(\.[0-9]+)?|1(\.0+)?)$'
          then (metadata->>'grounding_rate')::numeric >= 0.99
          else false
        end
        and case
          when coalesce(metadata->>'fallback_rate', '') ~
            '^(0(\.[0-9]+)?|1(\.0+)?)$'
          then (metadata->>'fallback_rate')::numeric < 0.10
          else false
        end
      )
    );

comment on column public.email_parse_templates.verification_status is
  'Active requiere auth DKIM/DMARC, shadow revisado, cero errores criticos, grounding >=99%, fallback <10% y rollback; no una cuota fija de muestras.';

create or replace function manzana.guard_email_pending_template_activation()
returns trigger
language plpgsql
security definer
set search_path = public, manzana
as $$
declare
  v_template_id uuid;
begin
  if new.source not in ('email_pending', 'backfill_pending') then
    return new;
  end if;

  if coalesce(new.metadata->>'template_id', '') !~
    '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  then
    raise exception 'EMAIL_PENDING_TEMPLATE_REQUIRED';
  end if;
  v_template_id := (new.metadata->>'template_id')::uuid;

  if not exists (
    select 1
      from public.email_parse_templates
     where id = v_template_id
       and enabled = true
       and activation_mode = 'active'
       and verification_status = 'verified'
       and verified_at is not null
  ) then
    raise exception 'EMAIL_PENDING_TEMPLATE_NOT_ACTIVE';
  end if;

  return new;
end;
$$;

insert into public.email_parse_templates (
  id,
  provider,
  institution_key,
  sender_pattern,
  template_version,
  priority,
  enabled,
  parser_config,
  sample_hashes,
  metadata,
  activation_mode,
  verification_status
) values (
  '03800000-0000-4000-8000-000000000001',
  'gmail',
  'bcp',
  'notificaciones@notificacionesbcp.com.pe',
  'bcp-agent-shadow-v1',
  10,
  true,
  jsonb_build_object(
    'schema_version', 'gmail_parser_v1',
    'subject_patterns', jsonb_build_array(
      'Realizaste un consumo con tu Tarjeta de Debito BCP',
      'Constancia de Transferencia Entre mis Cuentas',
      'Se rechazo tu compra por fondos insuficientes'
    ),
    'extraction_rules', jsonb_build_object(
      'amount', jsonb_build_object(
        'pattern', '(?:S/|PEN)\s*([\d.,]+)',
        'type', 'number'
      ),
      'merchant', jsonb_build_object(
        'pattern', '(?:Comercio|Establecimiento)\s*:\s*([^\r\n|]{2,120})',
        'type', 'string'
      ),
      'occurred_at', jsonb_build_object(
        'pattern', '(\d{2}/\d{2}/\d{4}\s+\d{2}:\d{2})',
        'type', 'datetime',
        'format', 'DD/MM/YYYY HH:mm'
      ),
      'account_hint', jsonb_build_object(
        'pattern', '(?:Tarjeta|Cuenta)[^\r\n]{0,80}?(\d{4})',
        'type', 'string'
      ),
      'direction', 'out',
      'currency', 'PEN',
      'operation_hint', 'unknown'
    ),
    'allow_generic_fallback', true,
    'confidence', jsonb_build_object(
      'template', 0.90,
      'fallback', 0.50
    ),
    'institution_aliases', jsonb_build_array(
      'BCP',
      'Banco de Credito del Peru'
    )
  ),
  '{}'::text[],
  jsonb_build_object(
    'activation_policy', 'shadow_metrics_v2',
    'sender_authentication', 'dkim_dmarc_required',
    'shadow_reviewed', false,
    'rollback_ready', true,
    'observed_header_families', 4,
    'contains_user_content', false
  ),
  'shadow',
  'draft'
)
on conflict (provider, sender_pattern, template_version)
do update set
  enabled = true,
  activation_mode = 'shadow',
  verification_status = 'draft',
  parser_config = excluded.parser_config,
  metadata = public.email_parse_templates.metadata || excluded.metadata,
  updated_at = now();
