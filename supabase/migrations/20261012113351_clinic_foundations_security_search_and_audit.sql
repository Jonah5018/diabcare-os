-- Clinic foundations: existing records and appointment lifecycle are preserved.
create extension if not exists pg_trgm with schema extensions;
alter table public.patients add column search_text text generated always as
  (lower(coalesce(first_name,'') || ' ' || coalesce(other_names,'') || ' ' || coalesce(last_name,'') || ' ' || hospital_number || ' ' || coalesce(phone,''))) stored;
create index patients_clinic_recent_idx on public.patients (organization_id, created_at desc nulls last, id desc);
create index patients_search_trgm_idx on public.patients using gin (search_text extensions.gin_trgm_ops);
create index consultations_clinic_recent_idx on public.consultations (organization_id, created_at desc nulls last, id desc);
create index consultations_clinic_visit_idx on public.consultations (organization_id, visit_date);
create index consultations_patient_history_idx on public.consultations (organization_id, patient_id, visit_date desc nulls last, id desc);
create index laboratory_clinic_recent_idx on public.laboratory_results (organization_id, created_at desc nulls last, id desc);
create index laboratory_patient_history_idx on public.laboratory_results (organization_id, patient_id, created_at desc nulls last, id desc);
create index vitals_clinic_recent_idx on public.vitals (organization_id, created_at);
create index vitals_patient_history_idx on public.vitals (organization_id, patient_id, created_at desc);
create index users_clinic_recent_idx on public.users (organization_id, created_at desc nulls last, id desc);
create index users_clinic_role_active_idx on public.users (organization_id, role, is_active);

alter table public.consultations add constraint consultations_patient_clinic_fkey foreign key (patient_id, organization_id) references public.patients(id, organization_id) on delete cascade;
alter table public.consultations add constraint consultations_doctor_clinic_fkey foreign key (doctor_id, organization_id) references public.users(id, organization_id);
alter table public.laboratory_results add constraint laboratory_patient_clinic_fkey foreign key (patient_id, organization_id) references public.patients(id, organization_id) on delete cascade;
alter table public.laboratory_results add constraint laboratory_recorder_clinic_fkey foreign key (recorded_by, organization_id) references public.users(id, organization_id);
alter table public.vitals add constraint vitals_patient_clinic_fkey foreign key (patient_id, organization_id) references public.patients(id, organization_id) on delete cascade;
alter table public.vitals add constraint vitals_recorder_clinic_fkey foreign key (recorded_by, organization_id) references public.users(id, organization_id);
alter table public.consultations add constraint consultations_visit_identity_key unique (id, patient_id, organization_id);
alter table public.vitals add constraint vitals_consultation_patient_clinic_fkey foreign key (consultation_id, patient_id, organization_id) references public.consultations(id, patient_id, organization_id) on delete set null (consultation_id);

drop policy "Clinic staff can view patients" on public.patients;
create policy "Clinic staff can view patients" on public.patients for select to authenticated using (organization_id = (select private.current_organization_id()));
drop policy "Clinic staff can insert patients" on public.patients;
create policy "Clinic staff can insert patients" on public.patients for insert to authenticated with check (
  organization_id = (select private.current_organization_id()) and exists (select 1 from public.users u where u.id=(select auth.uid()) and u.role in ('platform_owner','organization_admin','receptionist','doctor','nurse'))
);
drop policy "Clinic can view consultations" on public.consultations;
create policy "Clinic can view consultations" on public.consultations for select to authenticated using (organization_id = (select private.current_organization_id()));
drop policy "Clinic can insert consultations" on public.consultations;
create policy "Clinic can insert consultations" on public.consultations for insert to authenticated with check (
  organization_id = (select private.current_organization_id()) and doctor_id=(select auth.uid()) and exists (select 1 from public.users u where u.id=(select auth.uid()) and u.role in ('platform_owner','organization_admin','doctor'))
);
drop policy "Clinic can view vitals" on public.vitals;
create policy "Clinic can view vitals" on public.vitals for select to authenticated using (organization_id = (select private.current_organization_id()));
drop policy "Clinic can insert vitals" on public.vitals;
create policy "Clinic can insert vitals" on public.vitals for insert to authenticated with check (
  organization_id = (select private.current_organization_id()) and recorded_by=(select auth.uid()) and exists (select 1 from public.users u where u.id=(select auth.uid()) and u.role in ('platform_owner','organization_admin','doctor','nurse'))
);
drop policy "Clinic can view lab" on public.laboratory_results;
create policy "Clinic can view lab" on public.laboratory_results for select to authenticated using (organization_id = (select private.current_organization_id()));
drop policy "Clinic can insert lab" on public.laboratory_results;
create policy "Clinic can insert lab" on public.laboratory_results for insert to authenticated with check (
  organization_id = (select private.current_organization_id()) and recorded_by=(select auth.uid()) and exists (select 1 from public.users u where u.id=(select auth.uid()) and u.role in ('platform_owner','organization_admin','lab_scientist'))
);

create table public.audit_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  actor_id uuid references public.users(id),
  entity_type text not null check (entity_type in ('patients','appointments','consultations','vitals','laboratory_results')),
  record_id uuid not null,
  operation text not null check (operation in ('INSERT','UPDATE','DELETE')),
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
alter table public.audit_events enable row level security;
revoke all on public.audit_events from anon, authenticated;
grant select on public.audit_events to authenticated;
create policy "Clinic administrators can view audit events" on public.audit_events for select to authenticated using (
  organization_id=(select private.current_organization_id()) and exists (select 1 from public.users u where u.id=(select auth.uid()) and u.role in ('platform_owner','organization_admin'))
);
create index audit_events_clinic_recent_idx on public.audit_events (organization_id, created_at desc, id desc);
create index audit_events_actor_idx on public.audit_events (actor_id);
create or replace function private.record_clinic_audit_event() returns trigger language plpgsql security definer set search_path='' as $audit$
declare row_data jsonb; event_details jsonb := '{}'::jsonb;
begin
  if tg_op='DELETE' then row_data := to_jsonb(old); else row_data := to_jsonb(new); end if;
  if tg_table_name='appointments' then
    event_details := jsonb_build_object('status', row_data->>'status');
    if tg_op='UPDATE' then event_details := event_details || jsonb_build_object('previous_status',to_jsonb(old)->>'status'); end if;
  end if;
  insert into public.audit_events (organization_id,actor_id,entity_type,record_id,operation,details)
    values ((row_data->>'organization_id')::uuid, auth.uid(), tg_table_name,(row_data->>'id')::uuid,tg_op,event_details);
  if tg_op='DELETE' then return old; else return new; end if;
end;
$audit$;
revoke all on function private.record_clinic_audit_event() from public, anon, authenticated;
create trigger patients_audit after insert or update or delete on public.patients for each row execute function private.record_clinic_audit_event();
create trigger appointments_audit after insert or update or delete on public.appointments for each row execute function private.record_clinic_audit_event();
create trigger consultations_audit after insert or update or delete on public.consultations for each row execute function private.record_clinic_audit_event();
create trigger vitals_audit after insert or update or delete on public.vitals for each row execute function private.record_clinic_audit_event();
create trigger laboratory_results_audit after insert or update or delete on public.laboratory_results for each row execute function private.record_clinic_audit_event();
