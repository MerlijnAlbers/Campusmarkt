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
        <ul className="list-disc pl-5">
          <li>
            <strong>Klassement:</strong> iedere ingelogde student ziet van iedereen de bijnaam, het
            saldo en de waarde van open posities. Dit kan niet worden uitgezet — het klassement is
            altijd op naam, dat is het hele punt ervan.
          </li>
          <li>
            <strong>Logboek:</strong> iedere ingelogde student ziet alle transacties van alle
            spelers (welke markt, welke uitkomst, kopen/verkopen, aantal aandelen, punten en
            tijdstip) — niet alleen je eigen transacties. Standaard staat jouw bijnaam erbij; dit
            kun je op je{" "}
            <a href="/profile" className="underline">
              profielpagina
            </a>{" "}
            uitzetten, waarna jouw transacties verschijnen als &quot;Anonieme student&quot;. De
            transactiedetails zelf (markt, bedrag, tijdstip) blijven dan nog steeds zichtbaar, alleen
            niet aan jou gekoppeld. Transacties van de beheerder worden altijd getoond als
            &quot;Beheerder&quot;, nooit met een naam.
          </li>
          <li>
            <strong>Exacte posities en puntenhistorie:</strong> welke aandelen je precies in bezit
            hebt en je volledige grootboek (elke bij- en afschrijving) zijn alleen voor jou en de
            beheerder zichtbaar, nooit voor andere studenten.
          </li>
        </ul>
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
