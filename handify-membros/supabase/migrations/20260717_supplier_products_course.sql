-- ── Fornecedores v2 — Vínculo Produto ↔ Curso ────────────────────────────────
-- Permite filtrar materiais pelo curso em que são usados.
-- URL: /ferramentas/fornecedores?curso=slug-do-curso

create table if not exists product_course_links (
  product_id uuid not null references products(id) on delete cascade,
  course_id  uuid not null references courses(id)  on delete cascade,
  primary key (product_id, course_id)
);

create index if not exists idx_product_course_links_product
  on product_course_links (product_id);

create index if not exists idx_product_course_links_course
  on product_course_links (course_id);

alter table product_course_links enable row level security;

create policy "Alunas veem vínculos produto-curso"
  on product_course_links for select
  using (auth.role() = 'authenticated');

create policy "Admins gerenciam vínculos produto-curso"
  on product_course_links for all
  using (exists (select 1 from profiles where id = auth.uid() and role = 'admin'));
