import type { ReactNode } from "react";

export function SettingsField({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-sm font-medium text-gray-600">{label}</span>
      {children}
    </label>
  );
}

export function SettingsDisplayField({
  label,
  value,
  multiline = false,
}: {
  label: string;
  value: string | null | undefined;
  multiline?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-sm font-medium text-gray-600">{label}</span>
      <div
        className={`rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-800 ${
          multiline ? "min-h-24 whitespace-pre-line" : "min-h-10"
        }`}
      >
        {value?.trim() ? value : "—"}
      </div>
    </div>
  );
}
