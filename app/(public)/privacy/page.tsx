export default function PrivacyPage() {
  return (
    <article className="flex flex-col gap-6 text-ink">
      <h1 className="font-display text-2xl font-bold">Privacy</h1>

      <section className="flex flex-col gap-2">
        <h2 className="font-display text-lg font-semibold">Wat we opslaan</h2>
        <ul className="list-disc pl-5">
          <li>Je schoolmailadres (om te kunnen inloggen en je te identificeren).</li>
          <li>De bijnaam die je kiest voor je profiel.</li>
          <li>
            Je activiteit in de app: welke markten je bekijkt via je eigen posities, je trades
            (gekochte/verkochte aandelen, bedragen, tijdstippen) en je puntensaldo en -historie.
          </li>
        </ul>
        <p>
          We slaan geen betaalgegevens, adres of andere persoonsgegevens op dan hierboven genoemd.
          Speelpunten hebben geen geldwaarde; er is dus ook geen financiële transactiehistorie in de
          zin van echt geld.
        </p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="font-display text-lg font-semibold">Wie dit kan zien</h2>
        <p>
          Andere studenten zien alleen je bijnaam en je plaats in het klassement (saldo + waarde van
          open posities). Je eigen trades, puntenhistorie en exacte posities zijn alleen voor jou en
          de beheerder zichtbaar.
        </p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="font-display text-lg font-semibold">Hoe lang we het bewaren</h2>
        <p>
          We bewaren je gegevens voor de duur van de pilot en ruimen ze daarna op. Wil je je account
          en gegevens eerder laten verwijderen, neem dan contact op met de beheerder.
        </p>
      </section>
    </article>
  );
}
