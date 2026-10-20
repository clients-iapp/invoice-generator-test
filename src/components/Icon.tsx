const paths = {
  plus: "M12 5v14M5 12h14",
  remove: "M6 6l12 12M18 6L6 18",
  eye: "M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12zm10 3a3 3 0 100-6 3 3 0 000 6z",
  eyeOff:
    "M3 3l18 18M10.6 5.1A10.4 10.4 0 0112 5c6.4 0 10 7 10 7a17.6 17.6 0 01-3.2 4.1M6.6 6.6C3.9 8.4 2 12 2 12s3.6 7 10 7a9.7 9.7 0 005.4-1.6M9.9 9.9a3 3 0 004.2 4.2",
  print:
    "M7 9V3h10v6M7 17H5a2 2 0 01-2-2v-4a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2h-2M7 14h10v7H7z",
  mail: "M3 6h18v12H3zM3 7l9 6 9-6",
  check: "M5 12.5l4.5 4.5L19 7.5",
  back: "M15 18l-6-6 6-6",
  trash: "M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3",
  alert:
    "M12 8v5M12 16.5v.5M10.3 3.9L2.4 18a2 2 0 001.7 3h15.8a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z",
} as const;

export type IconName = keyof typeof paths;

/** Decorative stroke icon; the surrounding control carries the accessible name. */
export function Icon({ name, className = "size-4" }: { name: IconName; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={`shrink-0 ${className}`}
    >
      <path d={paths[name]} />
    </svg>
  );
}
