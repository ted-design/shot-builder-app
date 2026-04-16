export default function OverviewToolbarRow({ children }) {
  return (
    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
      {children}
    </div>
  );
}
