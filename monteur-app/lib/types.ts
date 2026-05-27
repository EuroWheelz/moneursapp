export type OpdrachtStatus =
  | 'ingepland'
  | 'onderweg'
  | 'uitgevoerd';

export type OpdrachtType =
  | 'onderhoud'
  | 'reparatie'
  | 'accu'
  | 'plaatsen'
  | 'terughalen'
  | 'evaluatie'
  | 'voertuigruil'
  | 'pechhulp';

export type Prioriteit = 1 | 2 | 3;

export interface Voertuig {
  kenteken: string;
  kleur: string;
  probleem?: string | null;
  opmerking?: string;
  model?: string;
  meldcode?: string;
}

export interface PechStop {
  id: string;
  adres: string;
  coördinaten: { lat: number; lng: number };
  pechType: 'lekke_band' | 'mechanisch' | 'lege_accu';
  notitie: string;
  kenteken: string | null;
  gevonden?: boolean | null;
}

export interface Opdracht {
  id: string;
  type: OpdrachtType;
  status: OpdrachtStatus;
  locatie: string;
  adres: string;
  postcode: string;
  stad: string;
  datum: string;
  prioriteit: Prioriteit;
  urgent: boolean;
  deadline: string | null;
  notitie: string;
  voertuigen: Voertuig[];
  contactpersoon: string;
  telefoon: string;
  routeVolgorde: number;
  tijdStart: string | null;
  tijdEind: string | null;
  tijdVastzetten: boolean;
  // Pechhulp specifiek
  pechStops?: PechStop[];
  sleutelOphalen?: boolean;
}

export interface Monteur {
  id: string;
  naam: string;
  voornaam: string;
  email: string;
  busCapaciteit: 4 | 8 | 12;
  vanHuis: boolean;
}
