export default function CreateLocationCard({ onClick, disabled }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex h-full min-h-[280px] flex-col items-center justify-center rounded-lg border-2 border-dashed border-slate-300 bg-white p-6 text-center transition hover:border-primary/50 hover:bg-primary/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-50"
      aria-label="Create location"
    >
      <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-3xl font-semibold text-primary">
        +
      </span>
      <span className="text-base font-semibold text-slate-900">Create location</span>
      <span className="mt-1 max-w-[220px] text-sm text-slate-500">
        Add venues with addresses, contact info, and helpful notes.
      </span>
    </button>
  );
}
