-- PvE 스테이지 클리어 진행도 (유저별, 스테이지별 1회 기록)
-- Supabase 대시보드 → SQL Editor 에 붙여넣고 Run.
-- 서버는 service_role 키로만 접근하므로 RLS 를 켜고 정책은 두지 않는다(= 서비스 키 전용).

create table if not exists public.pve_progress (
  id         uuid        primary key default gen_random_uuid(),
  user_id    uuid        not null references public.users(id) on delete cascade,
  stage_id   text        not null,
  cleared_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (user_id, stage_id)
);

create index if not exists pve_progress_user_idx on public.pve_progress (user_id);

alter table public.pve_progress enable row level security;
