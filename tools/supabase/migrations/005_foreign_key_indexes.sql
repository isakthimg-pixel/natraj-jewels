-- Indexes suggested by the Supabase performance advisor.
create index if not exists attendance_marked_by_idx on public.attendance (marked_by);
create index if not exists profiles_staff_id_idx on public.profiles (staff_id);
