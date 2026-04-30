import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://cqtpscaefqxntopxyrnr.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNxdHBzY2FlZnF4bnRvcHh5cm5yIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY2NTc3MzcsImV4cCI6MjA5MjIzMzczN30.td6xhrq2ik59CGkceE13dVyikUAysNfD1Y1g2AyWxCQ';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export type DbOpdracht = {
  id: string;
  type: string;
  status: string;
  locatie: string;
  adres: string;
  postcode: string;
  stad: string;
  datum: string | null;
  prioriteit: number;
  urgent: boolean;
  deadline: string | null;
  notitie: string;
  contactpersoon: string;
  telefoon: string;
  route_volgorde: number;
  monteur_id: string | null;
  sleutel_ophalen: boolean;
  km_gereden: number | null;
  tijd_start: string | null;
  tijd_eind: string | null;
  tijd_vastzetten: boolean;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
  voertuigen?: DbVoertuig[];
  pech_stops?: DbPechStop[];
};

export type DbVoertuig = {
  id: string;
  opdracht_id: string;
  kenteken: string;
  kleur: string;
  probleem: string | null;
  gedaan: string | null;
};

export type DbPechStop = {
  id: string;
  opdracht_id: string;
  adres: string;
  lat: number | null;
  lng: number | null;
  pech_type: string;
  notitie: string;
  kenteken: string | null;
  gevonden: boolean | null;
};

export type DbOnderdeel = {
  id: string;
  naam: string;
  categorie: string;
  actief: boolean;
  created_at: string;
};

export type DbVerplaatsVerzoek = {
  id: string;
  opdracht_id: string | null;
  monteur_id: string | null;
  locatie: string;
  neerzet_kenteken: string | null;
  meeneem_kenteken: string | null;
  meeneem_naar: string | null;
  status: 'ingediend' | 'goedgekeurd' | 'afgewezen';
  notitie: string;
  created_at: string;
};

export type DbFotoMelding = {
  id: string;
  opdracht_id: string | null;
  monteur_id: string | null;
  locatie: string;
  foto_url: string | null;
  gedetecteerde_kentekens: string[];
  bekende_kentekens: string[];
  afwijkingen: string[];
  status: string;
  created_at: string;
};

export type DbMonteur = {
  id: string;
  naam: string;
  voornaam: string;
  email: string;
  bus_capaciteit: number;
  van_huis: boolean;
};
