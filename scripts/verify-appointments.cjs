/* eslint-disable @typescript-eslint/no-require-imports -- Standalone Node.js verification using installed packages. */
const assert = require('node:assert/strict');
const {load}=require('./source-loader.cjs');

const { getClinicToday } = load('lib/clinic-date.ts');
assert.equal(getClinicToday(new Date('2026-10-12T22:59:59Z')), '2026-10-12');
assert.equal(getClinicToday(new Date('2026-10-12T23:00:00Z')), '2026-10-13');
assert.equal(getClinicToday(new Date('2026-12-31T23:00:00Z')), '2027-01-01');

function database({ user = { id: 'staff' }, profile = { organization_id: 'clinic-a', is_active: true, role: 'platform_owner' }, rows = [], queryError = null } = {}) {
  const calls = [];
  return {
    calls,
    auth: { getUser: async () => ({ data: { user }, error: null }) },
    from(table) {
      const call = { table, filters: [] };
      calls.push(call);
      const q = {
        select(columns, options) { call.columns = columns; call.options = options; return q; },
        eq(key, value) { call.filters.push(row => row[key] === value); return q; },
        neq(key, value) { call.filters.push(row => row[key] !== value); return q; },
        single: async () => ({ data: profile, error: null }),
        then(resolve, reject) {
          return Promise.resolve({
            count: table === 'appointments' ? rows.filter(row => call.filters.every(fn => fn(row))).length : 1,
            error: table === 'appointments' ? queryError : null,
          }).then(resolve, reject);
        },
      };
      return q;
    },
  };
}

function dashboard(db) {
  return load('app/dashboard/page.tsx', {
    '@/lib/supabase/server': { createClient: async () => db },
    'next/navigation': { redirect: location => { throw new Error('redirect:' + location); } },
    '@/components/dashboard/page-header': { default: 'PageHeader' },
    '@/components/dashboard/stat-card': { default: 'StatCard' },
  }).default();
}

function cardValue(tree, title) {
  if (!tree || typeof tree !== 'object') return undefined;
  if (tree.props?.title === title) return tree.props.value;
  const children = tree.props?.children;
  for (const child of Array.isArray(children) ? children : [children]) {
    const found = cardValue(child, title);
    if (found !== undefined) return found;
  }
}

(async () => {
  const today = getClinicToday();
  const rows = ['scheduled', 'waiting', 'in_consultation', 'completed', 'cancelled'].map(status => ({ organization_id: 'clinic-a', appointment_date: today, status }));
  rows.push({ organization_id: 'clinic-b', appointment_date: today, status: 'scheduled' });
  rows.push({ organization_id: 'clinic-a', appointment_date: '2099-01-01', status: 'scheduled' });
  const db = database({ rows });
  assert.equal(cardValue(await dashboard(db), "Today's Appointments"), 4);
  const appointmentCall = db.calls.find(call => call.table === 'appointments');
  assert.equal(appointmentCall.options.head, true);
  assert.equal(appointmentCall.options.count, 'exact');
  assert.equal(cardValue(await dashboard(database()), "Today's Appointments"), 0);
  await assert.rejects(dashboard(database({ user: null })), /redirect:\/auth\/login/);
  await assert.rejects(dashboard(database({ profile: { organization_id: null, is_active: true } })), /redirect:\/auth\/access/);
  await assert.rejects(dashboard(database({ profile: { organization_id: 'clinic-a', is_active: false } })), /redirect:\/auth\/access/);
  await assert.rejects(dashboard(database({ queryError: { message: 'unavailable' } })), /Unable to load/);

  const { appointmentSchema } = load('lib/validations/appointment.ts');
  const valid = {
    patient_id: '11111111-1111-4111-8111-111111111111',
    doctor_id: null,
    appointment_date: today,
    appointment_time: '09:30',
    reason: '  Routine follow-up  ',
  };
  assert.equal(appointmentSchema.parse(valid).reason, 'Routine follow-up');
  assert.equal(appointmentSchema.safeParse({ ...valid, appointment_date: '2099-02-30' }).success, false);
  assert.equal(appointmentSchema.safeParse({ ...valid, appointment_date: '2000-01-01' }).success, false);
  assert.equal(appointmentSchema.safeParse({ ...valid, appointment_time: '24:00' }).success, false);
  assert.equal(appointmentSchema.safeParse({ ...valid, appointment_time: '12:60' }).success, false);
  assert.equal(appointmentSchema.safeParse({ ...valid, appointment_time: null }).success, true);
  assert.equal(appointmentSchema.safeParse({ ...valid, patient_id: 'not-a-uuid' }).success, false);
  assert.equal(appointmentSchema.safeParse({ ...valid, reason: 'x'.repeat(501) }).success, false);
  assert.equal(appointmentSchema.safeParse({ ...valid, appointment_date: '2028-02-29' }).success, true);
  assert.equal(appointmentSchema.safeParse({ ...valid, appointment_date: '2027-02-29' }).success, false);

  function actionDatabase() {
    const user = { id: '22222222-2222-4222-8222-222222222222' };
    const profile = { id: user.id, organization_id: 'clinic-a', role: 'receptionist', is_active: true };
    const visits = [];
    const rpcCalls = [];
    return {
      visits, rpcCalls, user, profile,
      auth: { getUser: async () => ({ data: { user }, error: null }) },
      rpc: async (name, args) => { rpcCalls.push({ name, args }); return { data: [], error: null }; },
      from(table) {
        const filters = [];
        let patch;
        const q = {
          select() { return q; },
          eq(key, value) { filters.push(row => row[key] === value); return q; },
          in(key, values) { filters.push(row => values.includes(row[key])); return q; },
          update(values) { patch = values; return q; },
          single: async () => {
            const row = table === 'patients' ? { id: valid.patient_id, organization_id: 'clinic-a' } : profile;
            return { data: filters.every(fn => fn(row)) ? row : null, error: null };
          },
          insert: async row => { visits.push({ id: 'test-visit', ...row }); return { error: null }; },
          maybeSingle: async () => {
            const row = visits.find(row => filters.every(fn => fn(row)));
            if (row) Object.assign(row, patch);
            return { data: row || null, error: null };
          },
        };
        return q;
      },
    };
  }
  const actionDb = actionDatabase();
  const revalidated = [];
  const actions = load('actions/appointment.ts', {
    '@/lib/supabase/server': { createClient: async () => actionDb },
    'next/cache': { revalidatePath: (...args) => revalidated.push(args) },
  });
  const data = new FormData();
  Object.entries(valid).forEach(([key, value]) => data.set(key, value ?? ''));
  data.set('organization_id', 'clinic-b');
  const booked = await actions.createAppointment({}, data);
  assert.equal(Boolean(booked.success), true);
  assert.equal(actionDb.visits[0].organization_id, 'clinic-a');
  assert.equal(actionDb.visits[0].created_by, actionDb.user.id);
  assert.equal(actionDb.visits[0].status, 'scheduled');
  assert.equal(actionDb.visits[0].queue_number, undefined);
  assert.equal(revalidated.some(args => args[0] === '/dashboard'), true);
  assert.equal(revalidated.some(args => args[0] === '/dashboard/patients/[id]' && args[1] === 'page'), true);
  data.set('appointment_date', '2000-01-01');
  assert.match((await actions.createAppointment({}, data)).error, /past/);
  assert.equal(actionDb.visits.length, 1);
  data.set('appointment_date', today);
  data.set('patient_id', '33333333-3333-4333-8333-333333333333');
  assert.match((await actions.createAppointment({}, data)).error, /not found in your clinic/);
  assert.equal(actionDb.visits.length, 1);
  await actions.checkInAppointment('test-visit');
  assert.equal(actionDb.rpcCalls[0].name, 'check_in_appointment');
  assert.equal(actionDb.rpcCalls[0].args.p_appointment_id, 'test-visit');
  actionDb.visits[0].status = 'waiting';
  await actions.startConsultation('test-visit');
  assert.equal(actionDb.visits[0].status, 'in_consultation');
  await actions.completeAppointment('test-visit');
  assert.equal(actionDb.visits[0].status, 'completed');
  await assert.rejects(actions.cancelAppointment('test-visit'), /already have changed/);
  for (const status of ['scheduled', 'waiting', 'in_consultation']) {
    actionDb.visits[0].status = status;
    await actions.cancelAppointment('test-visit');
    assert.equal(actionDb.visits[0].status, 'cancelled');
  }
  actionDb.visits[0].organization_id = 'clinic-b';
  actionDb.visits[0].status = 'waiting';
  await assert.rejects(actions.startConsultation('test-visit'), /already have changed/);
  console.log('PASS: real date/time/leap-year validation; server booking ignores browser clinic ID, schedules without queue, rejects invalid/past/cross-clinic submissions; RPC delegation; lifecycle actions, terminal guards, clinic-scoped updates; cache invalidation.');
  console.log('PASS: clinic midnight/year rollover; dashboard count across statuses; cancellation, future visits and other clinics excluded; empty count; auth/profile guards; query failures.');
})().catch(error => { console.error(error); process.exitCode = 1; });
