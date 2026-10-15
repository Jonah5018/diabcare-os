# Clinician review foundations

IMPLEMENTED: an on-demand patient review at `/dashboard/patients/[id]/review`. This is deterministic record presentation and arithmetic, not autonomous medical AI. It does not write a clinical record, generate a diagnosis, recommend a medicine, change treatment or contact a patient.

## Authorization and data boundary

The new `clinical-review:view` capability is limited to doctor, organization_admin and platform_owner, matching the existing consultation/planning capability group. Both the page and the server-only query enforce it. Existing raw clinical history read policies and write permissions are unchanged. Owner access remains the assigned active clinic; global metadata authority does not grant global clinical browsing.

Identity follows server Auth → active public.users → assigned active organization. The URL supplies a validated patient UUID only. The patient lookup and all six source queries explicitly filter the server-derived organization and patient. Existing RLS and composite foreign keys remain independent protections. No service credential, shared patient cache, new view, SQL definer or client organization selector is introduced.

The review is a separate route so opening an ordinary patient folder does not issue these additional queries. Source links disable prefetch. A fixed patient lookup precedes six parallel, bounded reads. Returned fields are explicit, runtime validated and stripped of unexpected properties. Provider and result-validation failures use fixed error messages; clinical values are not logged. An unavailable source fails the review instead of silently looking like an empty clinical history.

## Source bounds and ordering

| Source | Displayed maximum | Selection and order |
| --- | --- | --- |
| Vitals | 12 | Created timestamp descending, nulls last, ID descending |
| Laboratory results | 12 | Created timestamp descending, nulls last, ID descending |
| Consultations | 3 | Recently saved by created timestamp, then ID; visit date shown separately |
| Appointments | 5 | Booking date today or earlier in Lagos, descending, then ID |
| Active prescriptions | 5 headers, at most 20 items per header | Saved active status; header created timestamp and ID descending; items displayed by position |
| Planned follow-ups | 5 | Earliest due date first, then ID ascending |

Each source fetches one additional header/row to show that more records exist. This preview deliberately uses no full-history count or unbounded aggregate. Continue into the existing keyset-paginated histories for older records. Prescription child bounds are enforced by the existing unique position 1–20 database constraints as well as runtime validation. This route adds no new pagination protocol.

Chief complaint, recorded diagnosis and follow-up reason are trimmed to at most 200 characters for display. Selected source text is fetched from the existing bounded records before server-side truncation; it is not an LLM summary. No treatment-plan/notes field is requested. Prescription previews deliberately omit route, duration and instructions and direct the clinician to the complete prescription. They are not dispensing instructions.

## Evidence labels and calculations

- **Recorded fact:** stored values, saved status, dates and source UUIDs. Every preview carries its table/source identifier. A saved appointment status does not prove attendance; active prescription status does not prove dispensing or adherence.
- **Calculated value:** latest displayed value minus the previous displayed value, rounded to two decimal places. Weight uses kg, fasting/random glucose mmol/L, blood pressure mmHg, HbA1c %, and creatinine µmol/L, following the existing recording forms. HbA1c differences use percentage points, not relative percent change. No unit conversion is inferred.
- **Rule-based flag:** a planned follow-up whose due date is before the server's current Africa/Lagos date. Due today is not overdue. Completed/cancelled plans are excluded. This is a workflow review flag, not proof of a missed visit, contact attempt, care gap or medical risk. Its source is the existing plan status/date model, not a medical guideline or threshold.
- **Clinician entry/decision:** saved consultation text remains attributed as a recorded clinician entry. The treating clinician makes all clinical decisions after reviewing complete source records.
- **AI-generated suggestion:** DISABLED. No model, external provider, SDK, clinical prompt, generated result or patient-data transfer exists in this feature.

Trends include weight, fasting glucose and HbA1c from at most twelve selected source rows each. Charts sort valid dated measurements chronologically with source-ID tie breaking. Equal timestamps have deterministic display order and do not establish a clinical sequence. Horizontal spacing represents elapsed time; vertical axes autoscale the displayed values. Neutral colors convey no healthy/unhealthy or improved/worsened interpretation. No target range, medical threshold, interpolation or forecast is added. One dated value has a centered point and no calculated change. Overflowing arithmetic or chart spans are unavailable rather than fabricated.

Missing values and dates remain in the source tables as "Not recorded". They are omitted from the chart and counted as omissions. Zero is a value, not a missing value. A partial blood pressure retains its recorded component. Null-date rows sort after dated rows and can fall outside this bounded preview; the full history remains authoritative. Recorded timestamps describe stored records and must not be represented as independently confirmed measurement times. Imported/legacy units and dates require clinician confirmation.

## Future AI boundary — disabled design only

No executable AI integration point is necessary for these deterministic foundations. Before adding one, obtain an approved clinical/privacy purpose, provider agreement, data residency/retention controls and explicit authorization for patient-data transfer. A future provider-independent adapter must receive only approved fields and source IDs, return a separate untrusted suggestion with source references/version provenance, fail closed, avoid PHI logging, and require clinician acceptance before any saved decision. Provider output must never invoke prescription or clinical-write actions directly. No future adapter or clinical threshold is represented as implemented here.

DEFERRED: clinically validated care-gap definitions, target thresholds, risk scoring, autonomous summaries and any external AI. They require domain review and separate approval. No configurable threshold with an invented clinical default is shipped.

## Verification and clinical acceptance

VERIFIED: application regression covers capability denial before reads, exact tenant/patient filters, every limit/lookahead, date/status ordering, source validation, safe failures, missing values, zero, timestamp ties, time spacing, arithmetic/overflow, escaped rendered clinical text, evidence labels and route denial. Transactional SQL covers source lookahead, retained history/nulls, defined planning rule, structured medication items and foreign-clinic denial, including admin/owner roles. Fixtures roll back.

REQUIRES STAGING / BROWSER: validate complete source links, date/unit semantics with clinicians, null/old/imported records, large histories, desktop/mobile/zoom/table scrolling, keyboard details controls, and actual controlled doctor/admin/owner sessions. Denied staff must retain their ordinary permitted clinical workflows. Browser and real clinician acceptance have not been performed in this checkpoint. These checks and clinical approval precede pilot use; lint/build do not establish medical validity.
