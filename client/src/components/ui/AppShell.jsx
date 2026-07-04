// Extraction of the two-div shell scaffold (outer full-bleed background +
// inner width-clamped "device frame") duplicated across every page. `header`
// takes a <PageHeader/> (or null for pages that render their own).
export default function AppShell({
  header,
  children,
  maxWidthClassName = "max-w-md md:max-w-2xl lg:max-w-4xl xl:max-w-6xl",
}) {
  return (
    <div className="min-h-screen-safe app-bg font-sans">
      <div
        className={`${maxWidthClassName} mx-auto min-h-screen-safe bg-[var(--color-bg)] shadow-2xl relative flex flex-col`}
      >
        {header}
        <div className="flex-1 pb-8 relative">{children}</div>
      </div>
    </div>
  );
}
