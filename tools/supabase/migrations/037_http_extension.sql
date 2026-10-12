-- The "http" extension lets the database read a web page (used by 038 to read the MJDTA gold and silver rates).
create extension if not exists http with schema extensions;
