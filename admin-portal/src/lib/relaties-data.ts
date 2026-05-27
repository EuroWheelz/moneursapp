export type Relatie = {
  id: string;
  crediteurnummer: string;
  naam: string;
  type: 'consignatie' | 'klant';
  status: 'actief' | 'inactief';
  land: string;
  adres: string;
  postcode: string;
  plaats: string;
  coordinaten: string;
  telefoon: string;
  email: string;
  aanmaakdatum: string;
  echopers: number;
  accus: number;
  openingstijden: string;
  winterstalling: { van: string; tot: string };
  mailToggles: { werkbon: boolean; afspraakbevestiging: boolean; nieuwsbrief: boolean };
};

export const RELATIES: Relatie[] = [
  {
    id: '1', crediteurnummer: 'EW-0001', naam: 'Strandhotel Scheveningen', type: 'consignatie', status: 'actief', land: 'NL',
    adres: 'Gevers Deynootplein 30', postcode: '2586 CK', plaats: 'Scheveningen', coordinaten: '52.1054° N, 4.2773° E',
    telefoon: '+31 70 416 2636', email: 'info@strandhotelscheveningen.nl', aanmaakdatum: '2023-03-15',
    echopers: 8, accus: 4, openingstijden: 'Ma–Zo 08:00–22:00',
    winterstalling: { van: '01-11', tot: '01-04' },
    mailToggles: { werkbon: true, afspraakbevestiging: true, nieuwsbrief: false },
  },
  {
    id: '2', crediteurnummer: 'EW-0002', naam: 'Vakantiepark De Koog', type: 'consignatie', status: 'actief', land: 'NL',
    adres: 'Rommelpot 8', postcode: '1796 AZ', plaats: 'De Koog', coordinaten: '53.1012° N, 4.7965° E',
    telefoon: '+31 222 317 400', email: 'info@vakantiepark-dekoog.nl', aanmaakdatum: '2023-05-10',
    echopers: 12, accus: 6, openingstijden: 'Ma–Zo 09:00–21:00',
    winterstalling: { van: '01-10', tot: '01-04' },
    mailToggles: { werkbon: true, afspraakbevestiging: false, nieuwsbrief: true },
  },
  {
    id: '3', crediteurnummer: 'EW-0003', naam: 'Camping Les Dunes', type: 'consignatie', status: 'actief', land: 'BE',
    adres: 'Duinweg 4', postcode: '8670', plaats: 'Koksijde', coordinaten: '51.1023° N, 2.6497° E',
    telefoon: '+32 58 123 456', email: 'info@campingles dunes.be', aanmaakdatum: '2023-06-01',
    echopers: 5, accus: 3, openingstijden: 'Ma–Zo 08:00–20:00',
    winterstalling: { van: '01-11', tot: '01-04' },
    mailToggles: { werkbon: true, afspraakbevestiging: true, nieuwsbrief: false },
  },
  {
    id: '4', crediteurnummer: 'EW-0004', naam: 'Familie Janssen', type: 'klant', status: 'actief', land: 'NL',
    adres: 'Kerkstraat 12', postcode: '1012 AB', plaats: 'Amsterdam', coordinaten: '52.3676° N, 4.9041° E',
    telefoon: '+31 6 2222 3333', email: 'p.janssen@email.nl', aanmaakdatum: '2024-01-20',
    echopers: 1, accus: 0, openingstijden: '—',
    winterstalling: { van: '—', tot: '—' },
    mailToggles: { werkbon: true, afspraakbevestiging: true, nieuwsbrief: false },
  },
  {
    id: '5', crediteurnummer: 'EW-0005', naam: 'Resort Borkum', type: 'consignatie', status: 'inactief', land: 'DE',
    adres: 'Strandpromenade 1', postcode: '26757', plaats: 'Borkum', coordinaten: '53.5887° N, 6.7006° E',
    telefoon: '+49 4922 123456', email: 'info@resort-borkum.de', aanmaakdatum: '2023-08-15',
    echopers: 6, accus: 3, openingstijden: 'Ma–Zo 10:00–20:00',
    winterstalling: { van: '01-10', tot: '01-05' },
    mailToggles: { werkbon: false, afspraakbevestiging: true, nieuwsbrief: false },
  },
  {
    id: '6', crediteurnummer: 'EW-0006', naam: 'Hotelpark Julianadorp', type: 'consignatie', status: 'actief', land: 'NL',
    adres: 'Zandweg 22', postcode: '1787 PK', plaats: 'Julianadorp', coordinaten: '52.8971° N, 4.7244° E',
    telefoon: '+31 6 5555 1234', email: 'petra@hotelpark-julianadorp.nl', aanmaakdatum: '2023-09-05',
    echopers: 10, accus: 5, openingstijden: 'Ma–Zo 08:00–22:00',
    winterstalling: { van: '01-11', tot: '01-04' },
    mailToggles: { werkbon: true, afspraakbevestiging: true, nieuwsbrief: true },
  },
  {
    id: '7', crediteurnummer: 'EW-0007', naam: 'Camping Le Nord', type: 'consignatie', status: 'actief', land: 'FR',
    adres: 'Rue du Littoral 7', postcode: '59240', plaats: 'Dunkerque', coordinaten: '51.0343° N, 2.3767° E',
    telefoon: '+33 3 28 12 34 56', email: 'info@camping-lenord.fr', aanmaakdatum: '2024-02-10',
    echopers: 4, accus: 2, openingstijden: 'Ma–Zo 08:00–20:00',
    winterstalling: { van: '01-11', tot: '01-04' },
    mailToggles: { werkbon: true, afspraakbevestiging: false, nieuwsbrief: false },
  },
];
