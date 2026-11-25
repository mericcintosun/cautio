// Riso placeholder while the desk loads: flat deep-stock blocks with ink borders,
// faded in once through .cautio-enter. No shimmer, no pulse.
export default function Loading() {
  return (
    <section aria-busy="true" aria-live="polite" className="cautio-enter mx-auto max-w-7xl space-y-5 px-4 py-8 lg:px-8 lg:py-12">
      <p className="font-display text-3xl uppercase">Opening the lease desk</p>
      <div className="space-y-3 rounded-sm border-2 border-border bg-muted p-5">
        <div className="h-4 w-1/3 rounded-sm bg-background" />
        <div className="h-8 w-2/3 rounded-sm bg-background" />
        <div className="riso-halftone h-24 w-full rounded-sm border-2 border-border bg-background" />
      </div>
      <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <li key={i} className="h-20 rounded-sm border-2 border-border bg-muted" />
        ))}
      </ul>
    </section>
  );
}
