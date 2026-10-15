"use client";

import { useState, type ComponentProps } from "react";
import { Eye, EyeOff } from "lucide-react";
import { authInputClass, authLabelClass } from "./form-styles";

type PasswordFieldProps = Omit<ComponentProps<"input">, "type" | "className"> & {
  id: string;
  label: string;
};

export default function PasswordField({ id, label, disabled, ...inputProps }: PasswordFieldProps) {
  const [visible, setVisible] = useState(false);

  return (
    <div>
      <label htmlFor={id} className={authLabelClass}>{label}</label>
      <div className="relative">
        <input
          {...inputProps}
          id={id}
          disabled={disabled}
          type={visible ? "text" : "password"}
          className={`${authInputClass} pr-14`}
        />
        <button
          type="button"
          disabled={disabled}
          aria-label={visible ? "Hide password" : "Show password"}
          aria-pressed={visible}
          aria-controls={id}
          onClick={() => setVisible(current => !current)}
          className="absolute inset-y-0 right-1 my-auto grid size-11 place-items-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-sky-600 disabled:cursor-wait"
        >
          {visible ? <EyeOff size={19} aria-hidden="true" /> : <Eye size={19} aria-hidden="true" />}
        </button>
      </div>
    </div>
  );
}
