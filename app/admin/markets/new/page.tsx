import { NewMarketForm } from "@/components/NewMarketForm";

export default function NewMarketPage() {
  return (
    <section className="px-4 py-6 sm:px-6">
      <h1 className="font-display text-2xl font-bold text-ink">Nieuwe markt</h1>
      <div className="mt-4">
        <NewMarketForm />
      </div>
    </section>
  );
}
