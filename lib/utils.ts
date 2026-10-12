import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function generateHospitalNumber(count: number) {
  const number = String(count + 1).padStart(6, "0");

  return `MSC-${number}`;
}
