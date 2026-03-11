-- ============================================================
--  AI Interview Platform — Supabase Database Schema
--  Run this in: Supabase Dashboard → SQL Editor → New Query
-- ============================================================

-- Enable UUID generation
create extension if not exists "pgcrypto";

-- ── Interview Sessions ──────────────────────────────────────
create table if not exists public.interview_sessions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  mode        text not null check (mode in ('resume', 'role', 'topic')),
  context     text not null,
  created_at  timestamptz not null default now()
);

-- ── Questions ───────────────────────────────────────────────
create table if not exists public.questions (
  id            uuid primary key default gen_random_uuid(),
  session_id    uuid not null references public.interview_sessions(id) on delete cascade,
  question_text text not null,
  ideal_answer  text not null,
  key_points    jsonb not null default '[]',
  difficulty    text check (difficulty in ('Easy', 'Medium', 'Hard')),
  category      text,
  created_at    timestamptz not null default now()
);

-- ── Evaluations ─────────────────────────────────────────────
create table if not exists public.evaluations (
  id              uuid primary key default gen_random_uuid(),
  question_id     uuid not null references public.questions(id) on delete cascade,
  user_answer     text not null,
  score           integer check (score between 0 and 100),
  correctness_pct integer check (correctness_pct between 0 and 100),
  covered_points  jsonb not null default '[]',
  missing_points  jsonb not null default '[]',
  strengths       text,
  weaknesses      text,
  feedback        text,
  created_at      timestamptz not null default now()
);

-- ── Row Level Security ──────────────────────────────────────
-- We use the service role key on the backend, so RLS is bypassed server-side.
-- These policies protect direct client access just in case.

alter table public.interview_sessions enable row level security;
alter table public.questions         enable row level security;
alter table public.evaluations       enable row level security;

-- Users can only see their own sessions
create policy "Users view own sessions"
  on public.interview_sessions for select
  using (auth.uid() = user_id);

-- Questions are visible if the user owns the parent session
create policy "Users view own questions"
  on public.questions for select
  using (
    exists (
      select 1 from public.interview_sessions s
      where s.id = session_id and s.user_id = auth.uid()
    )
  );

-- Evaluations are visible if the user owns the parent question's session
create policy "Users view own evaluations"
  on public.evaluations for select
  using (
    exists (
      select 1
      from public.questions q
      join public.interview_sessions s on s.id = q.session_id
      where q.id = question_id and s.user_id = auth.uid()
    )
  );

-- ── Indexes for performance ─────────────────────────────────
create index if not exists idx_sessions_user_id   on public.interview_sessions(user_id);
create index if not exists idx_questions_session   on public.questions(session_id);
create index if not exists idx_evaluations_question on public.evaluations(question_id);
