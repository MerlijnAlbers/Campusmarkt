export default async function AdminMarketPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  return (
    <section className="px-4 py-6 sm:px-6">
      <h1 className="font-display text-2xl font-bold text-ink">Markt beheren</h1>
      <p className="mt-2 text-muted">
        Beheer voor <span className="font-mono">{id}</span> komt binnenkort.
      </p>
    </section>
  );
}
