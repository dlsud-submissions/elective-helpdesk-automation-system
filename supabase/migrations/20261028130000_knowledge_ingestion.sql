-- Add stable chunk identity and atomically replace an article's indexed chunks.
alter table public.knowledge_chunks
  add column if not exists chunk_ordinal integer not null default 0;

create unique index if not exists knowledge_chunks_article_ordinal_unique
  on public.knowledge_chunks (article_id, chunk_ordinal);

create or replace function public.replace_knowledge_chunks(
  target_article_id uuid,
  chunk_rows jsonb
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if jsonb_typeof(chunk_rows) is distinct from 'array' then
    raise exception 'chunk_rows must be a JSON array';
  end if;

  delete from public.knowledge_chunks
  where article_id = target_article_id;

  insert into public.knowledge_chunks (
    id,
    article_id,
    chunk_ordinal,
    chunk_text,
    embedding
  )
  select
    (item->>'id')::uuid,
    target_article_id,
    (item->>'chunk_ordinal')::integer,
    item->>'chunk_text',
    (item->>'embedding')::extensions.vector(1536)
  from jsonb_array_elements(chunk_rows) as item;
end;
$$;

revoke all on function public.replace_knowledge_chunks(uuid, jsonb) from anon, authenticated;
revoke all on function public.replace_knowledge_chunks(uuid, jsonb) from public;
grant execute on function public.replace_knowledge_chunks(uuid, jsonb) to service_role;
