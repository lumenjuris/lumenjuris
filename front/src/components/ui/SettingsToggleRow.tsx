export function SettingsToggleRow({
  label,
  checked,
  defaultChecked = false,
  onCheckedChange,
}: {
  label: string;
  checked?: boolean;
  defaultChecked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center justify-between rounded-xl border border-gray-200 bg-gray-50 px-4 py-3">
      <span className="text-sm font-medium text-gray-900">{label}</span>
      <span className="relative inline-flex h-7 w-12 shrink-0 items-center">
        <input
          type="checkbox"
          {...(checked !== undefined ? { checked } : { defaultChecked })}
          onChange={(event) => onCheckedChange?.(event.target.checked)}
          className="peer sr-only"
        />
        <span className="absolute inset-0 rounded-full bg-gray-300 transition-colors duration-200 peer-checked:bg-lumenjuris peer-focus-visible:ring-4 peer-focus-visible:ring-lumenjuris/20" />
        <span className="absolute left-0.5 top-0.5 h-6 w-6 rounded-full bg-white shadow-sm transition-transform duration-200 peer-checked:translate-x-5" />
      </span>
    </label>
  );
}
