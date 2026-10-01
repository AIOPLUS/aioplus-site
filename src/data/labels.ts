/**
 * De vier labels van AIO Plus: menu, presentatie per label en de kleuren in het heelal.
 * Volgorde = vlakken van het beeldmerk (linksboven, rechtsboven, linksonder, rechtsonder), zoals labels.json op reviewplus.io.
 * Teksten en cijfers komen uit de brochures in de hub (merk/). Nog geen klantenaantallen (eerst afstemmen met Jordan).
 * De cijfers van Review Plus (67+ platformen, 27 talen, 12 widgettypen) zijn die van EmbedMyReviews: controleren bij de overstap naar de eigen app.
 */
import { mailto } from '@/config/site';

export type LabelId = 'reviewplus' | 'viewplus' | 'websiteplus' | 'tabplus';

export interface Label {
  id: LabelId;
  nr: string;
  naam: string;
  kort: string;
  /** Lichte variant van de merkkleur: leesbaar en gloeiend op de donkere achtergrond. */
  kleur: string;
  /** Tweede tint voor de nevels. */
  kleur2: string;
  /** Posities van de nevelwolken in het kwart. */
  nevel: { nx: string; ny: string; mx: string; my: string };
  oms: string;
  status: 'Live' | 'Binnenkort';
  site?: { label: string; href: string };
  kop: string;
  tekst: string;
  cijfers: [string, string][];
  pijlers: [string, string, string[]][];
  slot: string;
  actie: { label: string; href: string };
}

export const LABELS: Label[] = [
  {
    id: 'reviewplus', nr: '01', naam: 'Review Plus', kort: 'Review', kleur: '#4F6BFF', kleur2: '#4FD1FF',
    nevel: { nx: '30%', ny: '35%', mx: '62%', my: '22%' },
    oms: 'Online reputatiemanagement: reviews verzamelen, beantwoorden en tonen.',
    status: 'Live', site: { label: 'reviewplus.io', href: 'https://www.reviewplus.io' },
    kop: 'Alles-in-één voor je online reputatie.',
    tekst: 'Reviews verzamelen, beantwoorden, tonen en analyseren vanuit één dashboard, in je eigen huisstijl.',
    cijfers: [['67+', 'reviewplatformen in één dashboard'], ['27', 'talen'], ['12', 'widgettypen'], ['8', 'kanalen voor feedbackformulieren']],
    pijlers: [
      ['Verzamelen', 'Meer en betere beoordelingen, via elk kanaal dat je klanten gebruiken.', ['Reviewverzoeken per e-mail en sms', 'QR-codes en tik-en-review NFC-kaartjes', 'Slimme feedbackformulieren in meerdere talen', 'Eigen testimonials, met foto']],
      ['Beantwoorden', 'Sneller en consistenter reageren, zonder dat het je dagen kost.', ['AIO schrijft reacties in jouw toon', 'Automatisch beantwoorden op basis van regels, met goedkeuring', 'Meerdere locaties en teamrollen']],
      ['Tonen', 'Je beste beoordelingen precies waar klanten kijken.', ['Widgets in je eigen huisstijl', 'Installatie met één regel code', 'Reviews omzetten naar posts voor social media']],
      ['Inzicht', 'Begrijp wat klanten echt zeggen, en waar je online staat.', ['AI-inzichten: wat klanten waarderen en waar klachten ontstaan', 'Zichtbaarheid in AI-zoekmachines zoals ChatGPT, Gemini en Perplexity', 'Je positie in Google per wijk', 'Automatische rapportages in je mailbox']],
    ],
    slot: 'Meer reviews, minder werk.',
    actie: { label: 'Naar reviewplus.io', href: 'https://www.reviewplus.io' },
  },
  {
    id: 'viewplus', nr: '02', naam: 'View Plus', kort: 'View', kleur: '#C150FF', kleur2: '#FF5FD2',
    nevel: { nx: '70%', ny: '30%', mx: '40%', my: '58%' },
    oms: 'Social media management: strategie, foto en video, dagelijks beheer.',
    status: 'Live', site: { label: 'viewplus.io', href: 'https://www.viewplus.io' },
    kop: 'Van concept naar content die scoort.',
    tekst: 'Contentstrategie, fotografie en video op locatie, dagelijks beheer en actieve community-interactie.',
    cijfers: [['4', 'platformen: Instagram, TikTok, Facebook en LinkedIn'], ['1', 'vast rapportagemoment per maand']],
    pijlers: [
      ['Strategie', 'Een doordacht plan achter elke post.', ['Doelgroep- en kanaalanalyse', 'Een contentkalender met thema’s en campagnes', 'Formats en trends die bij je merk passen']],
      ['Foto en video', 'Beeld dat de sfeer van je zaak recht doet.', ['Professionele fotografie op locatie', 'Korte video’s en reels', 'Ondertiteling, want de meeste video’s kijken mensen zonder geluid']],
      ['Content', 'Herkenbaar, elke keer opnieuw.', ['Captions in de toon van je merk', 'Vaste templates voor stories, carrousels en posts', 'AI voor snelheid, een specialist voor de afwerking']],
      ['Beheer en groei', 'Actief aanwezig, niet alleen zenden.', ['Dagelijks plaatsen volgens de kalender', 'Community management en reputatiebewaking', 'Maandelijkse rapportage en advies op basis van data']],
    ],
    slot: 'Jouw zaak, online zoals hij is.',
    actie: { label: 'Naar viewplus.io', href: 'https://www.viewplus.io' },
  },
  {
    id: 'websiteplus', nr: '03', naam: 'Website Plus', kort: 'Website', kleur: '#FF6A3D', kleur2: '#FFC24B',
    nevel: { nx: '28%', ny: '62%', mx: '66%', my: '78%' },
    oms: 'Websites die klanten opleveren: strategie, ontwerp, bouw en beheer.',
    status: 'Binnenkort',
    kop: 'Van bezoeker naar klant.',
    tekst: 'Strategie, ontwerp, bouw, teksten en doorlopend onderhoud. Wij nemen het hele traject uit handen.',
    cijfers: [['5', 'fasen, van strategie tot beheer'], ['3', 'pakketten: Essential, Advanced en Ultimate'], ['1', 'vast aanspreekpunt']],
    pijlers: [
      ['Strategie', 'Een fundament voordat er één pixel wordt ontworpen.', ['Doelgroep- en conversieanalyse', 'Een heldere sitemap en structuur', 'Concurrentie- en marktonderzoek']],
      ['Ontwerp', 'Een uitstraling die vertrouwen wekt.', ['Wireframes en UX-ontwerp', 'Visueel ontwerp in je eigen huisstijl', 'Getest op desktop, tablet en mobiel']],
      ['Bouw', 'Snel, veilig en schaalbaar.', ['Maatwerk op moderne technieken', 'Een CMS waarmee je zelf teksten aanpast', 'Geoptimaliseerd voor snelheid']],
      ['Content en SEO', 'Gevonden worden, en overtuigen.', ['Teksten vanuit de zoekintentie van je klant', 'On-page SEO', 'Beeld en iconen die de boodschap versterken']],
      ['Beheer', 'Een website die na livegang blijft presteren.', ['Hosting met back-ups, SSL en monitoring', 'Onderhoud en updates', 'Analytics en rapportage']],
    ],
    slot: 'Een website die klanten oplevert.',
    actie: { label: 'Plan een kennismaking', href: mailto('Kennismaking Website Plus') },
  },
  {
    id: 'tabplus', nr: '04', naam: 'Tab Plus', kort: 'Tab', kleur: '#3BDB7F', kleur2: '#4FE3C8',
    nevel: { nx: '72%', ny: '66%', mx: '38%', my: '30%' },
    oms: 'Kassa en operatie voor horeca en retail: bestellen, reserveren, voorraad.',
    status: 'Binnenkort',
    kop: 'Eén systeem voor je hele zaak.',
    tekst: 'Kassa, bestellen, reserveren, voorraad en rapportage. Van tafel tot keuken en van kassa tot boekhouding.',
    cijfers: [['4', 'pijlers: kassa, gasten, voorraad en inzicht'], ['1', 'dashboard voor de hele operatie'], ['∞', 'reserveringen zonder meerkosten']],
    pijlers: [
      ['Kassa en bestellen', 'Van bestelling tot keuken, zonder frictie.', ['Een flexibel kassasysteem', 'Bestellen en betalen aan tafel met een QR-code', 'Een keukenscherm in plaats van bonnetjes', 'Afhalen in dezelfde bonnenstroom']],
      ['Gasten', 'Grip op de gastenstroom.', ['Onbeperkt reserveringen, zonder kosten per boeking', 'Cadeaubonnen, direct aan de kassa']],
      ['Voorraad en backoffice', 'De cijfers kloppen vanzelf.', ['Voorraad die meebeweegt met je verkoop', 'Omzet en btw automatisch verwerkt', 'Betalingen in hetzelfde systeem']],
      ['Inzicht en team', 'Overzicht per vestiging, per medewerker.', ['Een live dashboard per vestiging', 'Vestigingen naast elkaar vergelijken', 'Nieuwe medewerkers snel aan de slag']],
    ],
    slot: 'De rust van één systeem.',
    actie: { label: 'Houd me op de hoogte', href: mailto('Houd me op de hoogte: Tab Plus') },
  },
];
