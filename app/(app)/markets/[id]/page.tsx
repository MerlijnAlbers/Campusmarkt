export default async function MarketPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  return (
    <section>
      <h1 className="font-display text-2xl font-bold text-ink">Markt</h1>
      <p className="mt-2 text-muted">
        Marktpagina voor <span className="font-mono">{id}</span> komt binnenkort.
      </p>
    </section>
  );
}
