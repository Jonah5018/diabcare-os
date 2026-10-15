import { randomUUID } from "node:crypto";

async function requireSuccess(request) {
  const result = await request;
  if (result.error) throw new Error("Synthetic operation failed.");
  return result.data;
}

export function createScenarios({ clients, actors, fixture, writes = false }) {
  const { organizationId: clinic, patientId: patient, consultationId: consultation } = fixture;
  const date = new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Lagos" }).format(new Date());
  const doctor = clients.doctor;
  const admin = clients.organization_admin;
  const scenarios = [
    {
      name: "patient_search",
      run: () => requireSuccess(doctor.from("patients")
        .select("id,hospital_number,first_name,last_name")
        .eq("organization_id", clinic)
        .ilike("search_text", "%synthetic%")
        .order("last_name")
        .order("id")
        .limit(20)),
    },
    {
      name: "patient_profile",
      run: () => Promise.all([
        "vitals", "laboratory_results", "consultations",
        "prescriptions", "follow_ups", "appointments",
      ].map(table => requireSuccess(doctor.from(table)
        .select("id,created_at")
        .eq("organization_id", clinic)
        .eq("patient_id", patient)
        .order("created_at", { ascending: false, nullsFirst: false })
        .order("id", { ascending: false })
        .limit(26)))),
    },
    {
      name: "timeline",
      run: () => requireSuccess(doctor.rpc("get_patient_timeline", {
        p_patient_id: patient,
        p_cursor_time: null,
        p_cursor_kind: null,
        p_cursor_id: null,
        p_limit: 26,
      })),
    },
    {
      name: "follow_ups",
      run: () => requireSuccess(doctor.from("follow_ups")
        .select("id,due_date,status")
        .eq("organization_id", clinic)
        .eq("status", "planned")
        .order("due_date")
        .order("id")
        .limit(26)),
    },
    {
      name: "reports",
      run: () => requireSuccess(doctor.rpc("get_clinic_operational_report", {
        p_from: date,
        p_to: date,
      })),
    },
    {
      name: "audit",
      run: () => requireSuccess(admin.from("audit_events")
        .select("id,created_at,operation")
        .eq("organization_id", clinic)
        .order("created_at", { ascending: false })
        .order("id", { ascending: false })
        .limit(26)),
    },
  ];

  if (clients.platform_owner) {
    scenarios.push({
      name: "organization_admin",
      run: () => requireSuccess(clients.platform_owner.rpc("platform_organizations", {
        p_cursor_time: null,
        p_cursor_id: null,
      })),
    });
  }
  if (!writes) return { scenarios, verify: () => ({ queueUniqueness: "not_exercised" }) };

  const queueByAppointment = new Map();
  scenarios.push(
    {
      name: "booking_check_in",
      run: async () => {
        const booking = await requireSuccess(admin.from("appointments").insert({
          organization_id: clinic,
          patient_id: patient,
          created_by: actors.organization_admin,
          appointment_date: date,
          status: "scheduled",
          reason: "Synthetic load acceptance only",
        }).select("id").single());
        const rows = await requireSuccess(admin.rpc("check_in_appointment", {
          p_appointment_id: booking.id,
        }));
        const checked = Array.isArray(rows) ? rows[0] : rows;
        if (!Number.isInteger(checked?.queue_number)) throw new Error("Queue result invalid.");
        queueByAppointment.set(booking.id, checked.queue_number);
      },
    },
    {
      name: "vitals_save",
      run: () => requireSuccess(doctor.from("vitals").insert({
        organization_id: clinic,
        patient_id: patient,
        recorded_by: actors.doctor,
        weight: 70,
        height: 170,
      })),
    },
    {
      name: "consultation_save",
      run: () => requireSuccess(doctor.from("consultations").insert({
        organization_id: clinic,
        patient_id: patient,
        doctor_id: actors.doctor,
        chief_complaint: "Synthetic load fixture",
        diagnosis: "Synthetic test entry",
      })),
    },
    {
      name: "laboratory_save",
      run: () => requireSuccess(clients.lab_scientist.from("laboratory_results").insert({
        organization_id: clinic,
        patient_id: patient,
        recorded_by: actors.lab_scientist,
        hba1c: 6,
      })),
    },
    {
      name: "prescription_save",
      run: () => requireSuccess(doctor.rpc("create_prescription", {
        p_patient_id: patient,
        p_consultation_id: consultation,
        p_prescribed_date: date,
        p_request_id: randomUUID(),
        p_items: [{
          medication_name: "Synthetic medication",
          strength: "Test strength",
          dose: "Test dose",
          frequency: "Test frequency",
          route: "",
          duration: "Test duration",
          instructions: "Acceptance fixture only",
        }],
      })),
    },
  );

  return {
    scenarios,
    verify() {
      const unique = new Set(queueByAppointment.values());
      if (unique.size !== queueByAppointment.size) throw new Error("Duplicate queue allocation detected.");
      return {
        checkedAppointments: queueByAppointment.size,
        queueUniqueness: queueByAppointment.size ? "passed" : "not_exercised",
      };
    },
  };
}
