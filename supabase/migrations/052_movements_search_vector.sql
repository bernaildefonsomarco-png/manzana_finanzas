-- W-09 (26_modulo_movimientos.md §17): busqueda por texto en espanol sobre
-- merchant y description, con indice GIN -- la busqueda siempre disponible
-- (AC-MOV-05) necesita no degradarse conforme crece el historial.
alter table public.movements
  add column search_vector tsvector
    generated always as (
      to_tsvector(
        'spanish',
        coalesce(merchant, '') || ' ' || coalesce(description, '')
      )
    ) stored;

create index movements_search_vector_idx
  on public.movements
  using gin (search_vector);
