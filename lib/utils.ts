export function generateHospitalNumber(count: number) {
  const number = String(count + 1).padStart(6, "0");

  return `MSC-${number}`;
}