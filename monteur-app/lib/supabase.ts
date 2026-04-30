import { createClient } from '@supabase/supabase-js';
import type { Opdracht } from './types';

const SUPABASE_URL = 'https://cqtpscaefqxntopxyrnr.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNxdHBzY2FlZnF4bnRvcHh5cm5yIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY2NTc3MzcsImV4cCI6MjA5MjIzMzczN30.td6xhrq2ik59CGkceE13dVyikUAysNfD1Y1g2AyWxCQ';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
  },
});

export function dbToOpdracht(row: any): Opdracht {
  return {
    id: row.id,
    type: row.type,
    status: row.status,
    locatie: row.locatie,
    adres: row.adres,
    postcode: row.postcode,
    stad: row.stad,
    datum: row.datum,
    prioriteit: row.prioriteit,
    urgent: row.urgent,
    deadline: row.deadline,
    notitie: row.notitie,
    contactpersoon: row.contactpersoon,
    telefoon: row.telefoon,
    routeVolgorde: row.route_volgorde,
    tijdStart: row.tijd_start ? row.tijd_start.slice(0, 5) : null,
    tijdEind: row.tijd_eind ? row.tijd_eind.slice(0, 5) : null,
    tijdVastzetten: row.tijd_vastzetten ?? false,
    sleutelOphalen: row.sleutel_ophalen,
    voertuigen: (row.voertuigen ?? []).map((v: any) => ({
      kenteken: v.kenteken,
      kleur: v.kleur,
    })),
    pechStops: (row.pech_stops ?? []).map((p: any) => ({
      id: p.id,
      adres: p.adres,
      coördinaten: { lat: p.lat ?? 0, lng: p.lng ?? 0 },
      pechType: p.pech_type,
      notitie: p.notitie,
      kenteken: p.kenteken,
      gevonden: p.gevonden,
    })),
  };
}
