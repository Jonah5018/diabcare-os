-- Database aggregation returns operational counts, never clinical text/values.
create function public.get_clinic_operational_report(p_from date, p_to date)
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $report$
declare
  v_clinic uuid;
  v_start timestamptz;
  v_end timestamptz;
  v_today date := (now() at time zone 'Africa/Lagos')::date;
  v_result jsonb;
begin
  select organization_id into v_clinic from public.users
  where id = auth.uid() and is_active = true
    and role in ('platform_owner', 'organization_admin', 'doctor');
  if v_clinic is null then raise exception using errcode = '42501', message = 'Reports permission required'; end if;
  if p_from is null or p_to is null or p_to < p_from or p_to - p_from > 30 then
    raise exception using errcode = '22023', message = 'Use a report window of up to 31 days';
  end if;
  v_start := p_from::timestamp at time zone 'Africa/Lagos';
  v_end := (p_to + 1)::timestamp at time zone 'Africa/Lagos';

  with bookings as (
    select patient_id, status from public.appointments
    where organization_id = v_clinic and appointment_date between p_from and p_to
  ), cohort as (
    select distinct patient_id from bookings where status <> 'cancelled'
  ), follow_ups as (
    select status, due_date from public.follow_ups
    where organization_id = v_clinic and due_date between p_from and p_to
  )
  select jsonb_build_object(
    'registrations', (select count(*) from public.patients where organization_id = v_clinic and created_at >= v_start and created_at < v_end),
    'bookings', (select count(*) from bookings),
    'non_cancelled', (select count(*) from bookings where status <> 'cancelled'),
    'completed', (select count(*) from bookings where status = 'completed'),
    'cancelled', (select count(*) from bookings where status = 'cancelled'),
    'check_ins', (select count(*) from public.appointments where organization_id = v_clinic and checked_in_at >= v_start and checked_in_at < v_end),
    'consultations', (select count(*) from public.consultations where organization_id = v_clinic and coalesce(visit_date, created_at) >= v_start and coalesce(visit_date, created_at) < v_end),
    'vitals', (select count(*) from public.vitals where organization_id = v_clinic and created_at >= v_start and created_at < v_end),
    'laboratory', (select count(*) from public.laboratory_results where organization_id = v_clinic and created_at >= v_start and created_at < v_end),
    'prescriptions', (select count(*) from public.prescriptions where organization_id = v_clinic and prescribed_date between p_from and p_to),
    'follow_ups_due', (select count(*) from follow_ups),
    'follow_ups_planned', (select count(*) from follow_ups where status = 'planned'),
    'follow_ups_overdue', (select count(*) from follow_ups where status = 'planned' and due_date < v_today),
    'cohort_patients', (select count(*) from cohort),
    'cohort_with_vitals', (select count(distinct v.patient_id) from public.vitals v join cohort c on c.patient_id = v.patient_id where v.organization_id = v_clinic and v.created_at >= v_start and v.created_at < v_end),
    'cohort_with_labs', (select count(distinct l.patient_id) from public.laboratory_results l join cohort c on c.patient_id = l.patient_id where l.organization_id = v_clinic and l.created_at >= v_start and l.created_at < v_end)
  ) into v_result;
  return v_result;
end;
$report$;
revoke all on function public.get_clinic_operational_report(date, date) from public, anon;
grant execute on function public.get_clinic_operational_report(date, date) to authenticated;

create index appointments_clinic_check_in_idx
  on public.appointments (organization_id, checked_in_at) where checked_in_at is not null;
create index consultations_clinic_record_time_idx
  on public.consultations (organization_id, (coalesce(visit_date, created_at)), patient_id);
create index prescriptions_clinic_prescribed_date_idx
  on public.prescriptions (organization_id, prescribed_date);
create index follow_ups_clinic_report_due_idx
  on public.follow_ups (organization_id, due_date);
