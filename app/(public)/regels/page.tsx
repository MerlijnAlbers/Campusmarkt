export default function RulesPage() {
  return (
    <article className="flex flex-col gap-6 text-ink">
      <h1 className="font-display text-2xl font-bold">Spelregels</h1>

      <section className="flex flex-col gap-2">
        <h2 className="font-display text-lg font-semibold">Speelpunten zonder waarde</h2>
        <p>
          Campusmarkt werkt met <strong>speelpunten</strong>. Die punten hebben geen geldwaarde en
          zijn op geen enkele manier in te wisselen voor geld, cadeaubonnen of iets anders. Je kunt
          punten niet kopen, uitbetalen of overdragen aan iemand anders. Elke student start met
          1.000 punten, en krijgt elke week automatisch een aanvulling tot 1.000 punten als dat
          saldo door verlies is gezakt.
        </p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="font-display text-lg font-semibold">Hoe werken de kansen?</h2>
        <p>
          Elke markt is een vraag met 2 tot 5 mogelijke uitkomsten. Het percentage bij elke
          uitkomst is de actuele inschatting van de kans dat die uitkomst gebeurt, gebaseerd op wat
          iedereen tot nu toe heeft gekocht of verkocht. Koop je aandelen van een uitkomst, dan
          stijgt de kans van die uitkomst een beetje; verkoop je, dan daalt hij weer. Hoe meer er al
          in een markt gehandeld is, hoe duurder het volgende aandeel van een populaire uitkomst
          wordt.
        </p>
        <p>
          Een aandeel van de uitkomst die uiteindelijk gebeurt, levert <strong>1 punt</strong> op.
          Aandelen van de andere uitkomsten worden 0 punten waard. Hoe eerder en hoe zekerder je
          een juiste inschatting maakt, hoe meer je dus kunt winnen.
        </p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="font-display text-lg font-semibold">Hoe wordt een uitkomst vastgesteld?</h2>
        <p>
          Bij elke markt staan de resolutiecriteria en de bron vermeld: hoe en waarmee de
          beheerder straks bepaalt welke uitkomst heeft gewonnen. Zodra dat moment is aangebroken,
          sluit de beheerder de markt en kiest de winnende uitkomst op basis van die bron. Iedereen
          die aandelen van de winnende uitkomst had, krijgt dan automatisch zijn punten
          uitbetaald.
        </p>
        <p>
          Een markt kan ook geannuleerd worden als de vraag niet meer te beantwoorden is (bijv. een
          evenement gaat niet door). Dan krijgt iedereen zijn netto inleg in die markt terug.
        </p>
      </section>
    </article>
  );
}
