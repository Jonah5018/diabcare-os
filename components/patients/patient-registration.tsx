"use client";

import ActionForm from "@/components/shared/action-form";
import { createPatient } from "@/actions/patient";

export default function PatientRegistration() {
  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900">
          Register New Patient
        </h1>
        <p className="mt-2 text-slate-500">
          Create a secure digital patient record
        </p>
      </div>

      <ActionForm
        action={createPatient}
        className="space-y-8 rounded-2xl border border-slate-200 bg-white p-8 shadow-sm"
      >
        {/* PERSONAL INFORMATION */}
        <div>
          <h2 className="mb-4 text-lg font-semibold text-slate-800">
            Personal Information
          </h2>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label htmlFor="last_name" className="mb-2 block text-sm font-medium">Surname *</label>
              <input
                id="last_name" name="last_name"
                required
                placeholder="Nwofoke"
                className="w-full rounded-lg border p-3 focus:border-sky-500 focus:outline-none"
              />
            </div>

            <div>
              <label htmlFor="first_name" className="mb-2 block text-sm font-medium">First Name *</label>
              <input
                id="first_name" name="first_name"
                required
                placeholder="Jonathan"
                className="w-full rounded-lg border p-3 focus:border-sky-500 focus:outline-none"
              />
            </div>

            <div className="md:col-span-2">
              <label htmlFor="other_names" className="mb-2 block text-sm font-medium">Other Names (Optional)</label>
              <input
                id="other_names" name="other_names"
                placeholder="Uchenna"
                className="w-full rounded-lg border p-3 focus:border-sky-500 focus:outline-none"
              />
            </div>

            <div>
              <label htmlFor="gender" className="mb-2 block text-sm font-medium">Gender *</label>
              <select
                id="gender" name="gender"
                defaultValue="male"
                className="w-full rounded-lg border p-3 focus:border-sky-500 focus:outline-none"
              >
                <option value="male">Male</option>
                <option value="female">Female</option>
              </select>
            </div>

            <div>
              <label htmlFor="date_of_birth" className="mb-2 block text-sm font-medium">Date of Birth *</label>
              <input
                id="date_of_birth" name="date_of_birth"
                type="date"
                required
                className="w-full rounded-lg border p-3 focus:border-sky-500 focus:outline-none"
              />
            </div>

            <div>
              <label htmlFor="phone" className="mb-2 block text-sm font-medium">Phone Number *</label>
              <input
                id="phone" name="phone"
                required
                placeholder="+234..."
                className="w-full rounded-lg border p-3 focus:border-sky-500 focus:outline-none"
              />
            </div>

            <div>
              <label htmlFor="address" className="mb-2 block text-sm font-medium">Address</label>
              <input
                id="address" name="address"
                placeholder="Olokoro, Umuahia"
                className="w-full rounded-lg border p-3 focus:border-sky-500 focus:outline-none"
              />
            </div>
          </div>
        </div>

        <hr />

        {/* NEXT OF KIN */}
        <div>
          <h2 className="mb-4 text-lg font-semibold text-slate-800">
            Next of Kin
          </h2>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label htmlFor="next_of_kin_name" className="mb-2 block text-sm font-medium">Full Name</label>
              <input
                id="next_of_kin_name" name="next_of_kin_name"
                placeholder="Grace Nwofoke"
                className="w-full rounded-lg border p-3 focus:border-sky-500 focus:outline-none"
              />
            </div>

            <div>
              <label htmlFor="next_of_kin_phone" className="mb-2 block text-sm font-medium">Phone Number</label>
              <input
                id="next_of_kin_phone" name="next_of_kin_phone"
                placeholder="+234..."
                className="w-full rounded-lg border p-3 focus:border-sky-500 focus:outline-none"
              />
            </div>
          </div>
        </div>

        <hr />

        {/* MIGRATION */}
        <div>
          <h2 className="mb-4 text-lg font-semibold text-slate-800">
            Migration Information
          </h2>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label htmlFor="migration_source" className="mb-2 block text-sm font-medium">Record Type</label>

              <select
                id="migration_source" name="migration_source"
                defaultValue="new"
                className="w-full rounded-lg border p-3 focus:border-sky-500 focus:outline-none"
              >
                <option value="new">New Patient</option>
                <option value="paper">Existing Paper Record</option>
                <option value="import">Imported Record</option>
              </select>
            </div>

            <div className="rounded-lg bg-slate-50 p-4">
              <p className="text-xs text-slate-500">Hospital Number</p>
              <p className="mt-1 text-xl font-bold text-sky-700">
                Auto Generated
              </p>
            </div>
          </div>
        </div>

        <button
          type="submit"
          className="w-full rounded-xl bg-sky-600 py-3 font-semibold text-white transition hover:bg-sky-700"
        >
          Register Patient
        </button>
      </ActionForm>
    </div>
  );
}
