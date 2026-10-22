-- profiles: one row per signed-up user; role lives here
create table public.profiles (

  id uuid primary key references auth.users(id) on delete cascade,

  display_name text,

  role text not null default 'employee'

    check (role in ('employee','agent','admin')),

  created_at timestamptz not null default now()

);

-- Automatically create a profile when someone signs up
create or replace function public.handle_new_user()

returns trigger

language plpgsql

security definer

set search_path = ''

as $$

begin

  insert into public.profiles (id, display_name)

  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', new.email));

  return new;

end;

$$;

create trigger on_auth_user_created

  after insert on auth.users

  for each row execute function public.handle_new_user();

--  Knowledge base
create table public.knowledge_articles (

  id uuid primary key default gen_random_uuid(),

  title text not null,

  body text not null,

  category text,

  source_name text,

  is_published boolean not null default false,

  updated_at timestamptz not null default now()

);

create table public.knowledge_chunks (

  id uuid primary key default gen_random_uuid(),

  article_id uuid not null references public.knowledge_articles(id) on delete cascade,

  chunk_text text not null,

  embedding extensions.vector(1536) not null

);

-- Fast similarity search index
create index knowledge_chunks_embedding_idx

  on public.knowledge_chunks

  using hnsw (embedding extensions.vector_cosine_ops);

-- Search function the server will call
create or replace function public.match_chunks(

  query_embedding extensions.vector(1536),

  match_count int default 5,

  min_similarity float default 0.5

)

returns table (

  chunk_id uuid, article_id uuid, title text,

  source_name text, chunk_text text, similarity float

)

language sql stable

set search_path = ''

as $$

  select c.id, a.id, a.title, a.source_name, c.chunk_text,

         1 - (c.embedding operator(extensions.<=>) query_embedding) as similarity

  from public.knowledge_chunks c

  join public.knowledge_articles a on a.id = c.article_id

  where a.is_published

    and 1 - (c.embedding operator(extensions.<=>) query_embedding) >= min_similarity

  order by c.embedding operator(extensions.<=>) query_embedding

  limit least(match_count, 20);

$$;

-- Security: turn on Row Level Security (RLS) for every table
alter table public.profiles enable row level security;

alter table public.knowledge_articles enable row level security;

alter table public.knowledge_chunks enable row level security;
