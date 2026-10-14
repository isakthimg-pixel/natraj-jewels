-- Attendance: "Shop work" (SW), working for the shop outside it (bank, hallmarking, supplier, delivery).
-- Like Thottam and Home it counts as a full day and is marked under Present.
alter table public.attendance drop constraint attendance_status_check;
alter table public.attendance add constraint attendance_status_check check (status in ('P','SW','HM','T','H','A','LA','WO'));
