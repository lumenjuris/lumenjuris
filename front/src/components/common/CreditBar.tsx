export function CreditBar({
  label,
  used,
  total,
}: {
  label: string;
  used: number;
  total: number;
}) {
  const remaining = Math.max(0, total - used);
  const pct = total > 0 ? Math.round((remaining / total) * 100) : 0;
  const isLow = pct <= 20;

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between text-xs">
        <span className="font-medium text-gray-700">{label}</span>
        <span
          className={isLow ? "font-semibold text-red-600" : "text-gray-500"}
        >
          {used === 0 ? `${total}` : `${remaining} / ${total}`}
        </span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-200">
        <div
          className={`h-full rounded-full transition-all ${isLow ? "bg-red-500" : "bg-lumenjuris"}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
