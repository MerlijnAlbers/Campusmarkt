"use client";

export function Tooltip({
  label,
  side = "top",
  children,
}: {
  label: string;
  side?: "top" | "right";
  children: React.ReactNode;
}) {
  const positionClasses =
    side === "right"
      ? "left-full top-1/2 ml-2 -translate-y-1/2"
      : "bottom-full left-1/2 mb-2 -translate-x-1/2";

  return (
    <span className="group relative inline-flex">
      {children}
      <span
        role="tooltip"
        className={`pointer-events-none absolute z-50 whitespace-nowrap rounded-md bg-ink px-2 py-1 text-xs text-bg opacity-0 transition-opacity delay-150 group-hover:opacity-100 group-focus-within:opacity-100 ${positionClasses}`}
      >
        {label}
      </span>
    </span>
  );
}
