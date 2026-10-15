/* eslint-disable @typescript-eslint/no-require-imports -- Standalone verification without new dependencies. */
const assert=require('node:assert/strict');
const {load}=require('./source-loader.cjs');
const {can}=load('lib/auth/permissions.ts');
const {cursorFilter,encodeCursor,searchTerms}=load('lib/pagination.ts');
const {reportWindow}=load('lib/reporting.ts');
const {vitalsSchema,labSchema,consultationSchema}=load('lib/validations/clinical.ts');
const patientId='11111111-1111-4111-8111-111111111111';
const userId='22222222-2222-4222-8222-222222222222';

assert.equal(can('receptionist','consultations:create'),false);
assert.equal(can('nurse','vitals:create'),true);
assert.equal(can('doctor','laboratory:create'),false);
assert.equal(can('lab_scientist','laboratory:create'),true);
assert.equal(can('doctor','team:view'),false);
const encoded=encodeCursor({id:patientId,created_at:'2026-10-12T08:00:00+00:00'});
assert.equal(cursorFilter(encoded).includes('created_at.lt.2026-10-12T08:00:00+00:00'),true);
assert.equal(cursorFilter(encodeCursor({id:patientId,created_at:null})),`and(created_at.is.null,id.lt.${patientId})`);
assert.equal(cursorFilter('malformed'),null);
assert.equal(cursorFilter(Buffer.from(JSON.stringify({id:'injection,role.eq.owner',created_at:'invalid'})).toString('base64url')),null);
assert.equal(searchTerms('Jonah,role.eq.owner%()').join(' ').includes(','),false);
assert.equal(searchTerms('one two three four five').length,4);
assert.equal(reportWindow('2026-10-01','2026-10-31').endTime,'2026-10-31T23:00:00.000Z');
assert.equal(Boolean(reportWindow('2026-10-31','2026-10-01').error),true);
assert.equal(Boolean(reportWindow('2026-01-01','2026-10-01').error),true);
assert.equal(Boolean(reportWindow('2026-02-30','2026-03-01').error),true);
const vitals={patient_id:patientId,systolic_bp:'120',diastolic_bp:'80',pulse:'70',spo2:'98',temperature:'36.5',weight:'70',height:'170',fasting_blood_sugar:'5.5',random_blood_sugar:'6.5'};
assert.equal(vitalsSchema.safeParse(vitals).success,true);
assert.equal(vitalsSchema.safeParse({...vitals,weight:''}).success,false);
assert.equal(vitalsSchema.safeParse({...vitals,height:'0'}).success,false);
assert.equal(vitalsSchema.safeParse({...vitals,spo2:'101'}).success,false);
assert.equal(vitalsSchema.safeParse({...vitals,systolic_bp:'120.5'}).success,false);
assert.equal(vitalsSchema.safeParse({...vitals,temperature:'Infinity'}).success,false);
assert.equal(consultationSchema.safeParse({patient_id:patientId,chief_complaint:' ',diagnosis:'test'}).success,false);
assert.equal(labSchema.safeParse({patient_id:patientId,hba1c:'101',creatinine:'1',total_cholesterol:'1',hdl:'1',ldl:'1',triglycerides:'1',urine_protein:'Negative',urine_glucose:'Negative'}).success,false);

(async()=>{
  let profile={id:userId,organization_id:'clinic-a',role:'doctor',is_active:true,full_name:'Synthetic Doctor',email:'test@example.invalid'};
  const writes=[];
  const db={auth:{getUser:async()=>({data:{user:{id:userId}},error:null})},rpc:async()=>({data:'active',error:null}),from(table){
    const filters=[];
    const q={select(){return q},eq(key,value){filters.push(row=>row[key]===value);return q},single:async()=>({data:profile,error:null}),maybeSingle:async()=>{const row={id:patientId,organization_id:'clinic-a'};return{data:filters.every(fn=>fn(row))?row:null,error:null}},insert:async(row)=>{writes.push({table,row});return{error:null}}};return q;
  }};
  const mocks={'@/lib/supabase/server':{createClient:async()=>db},'next/navigation':{redirect:path=>{throw new Error('redirect:'+path)}},'next/cache':{revalidatePath:()=>{}}};
  const {getClinicContext}=load('lib/auth/context.ts',mocks);
  assert.equal((await getClinicContext()).profile.organization_id,'clinic-a');
  profile={...profile,is_active:false};
  await assert.rejects(getClinicContext(),/redirect:\/auth\/access/);
  profile={...profile,is_active:true};
  const {createVitals}=load('actions/vitals.ts',mocks);
  function form(values){const data=new FormData();Object.entries(values).forEach(([key,value])=>data.set(key,value));return data}
  const result=await createVitals(form({...vitals,organization_id:'clinic-b',recorded_by:'forged-actor'}));
  assert.equal(Boolean(result.success),true);
  assert.equal(writes[0].row.organization_id,'clinic-a');
  assert.equal(writes[0].row.recorded_by,userId);
  assert.equal(writes[0].row.bmi,24.2);
  assert.match((await createVitals(form({...vitals,patient_id:'33333333-3333-4333-8333-333333333333'}))).error,/not found in your clinic/);
  assert.equal(writes.length,1);
  profile={...profile,role:'receptionist'};
  assert.match((await createVitals(form(vitals))).error,/role cannot/);
  assert.equal(writes.length,1);
  console.log('PASS: shared active-clinic guard; role matrix; tampered cursor rejection; null-date pagination; bounded search and report dates; clinical numeric validation; clinic/patient/actor isolation; server BMI; denied writes do not reach the database.');
})().catch(error=>{console.error(error);process.exitCode=1});
