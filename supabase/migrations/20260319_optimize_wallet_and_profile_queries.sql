begin;

create index if not exists wallets_user_email_lookup_idx
  on public.wallets ((lower(trim(coalesce(user_email, '')))));

create index if not exists wallet_transactions_user_id_created_at_idx
  on public.wallet_transactions (user_id, created_at desc);

create index if not exists wallet_transactions_user_email_created_at_idx
  on public.wallet_transactions ((lower(trim(coalesce(user_email, '')))), created_at desc);

create index if not exists seminars_professor_id_idx
  on public.seminars (professor_id);

create index if not exists enrollments_student_id_idx
  on public.enrollments (student_id);

create index if not exists enrollments_paid_invited_by_email_student_email_idx
  on public.enrollments (
    (lower(coalesce(payment_status, ''))),
    (lower(trim(coalesce(invited_by_email, '')))),
    (lower(trim(coalesce(student_email, ''))))
  );

commit;
