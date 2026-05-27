import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://cqtpscaefqxntopxyrnr.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNxdHBzY2FlZnF4bnRvcHh5cm5yIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY2NTc3MzcsImV4cCI6MjA5MjIzMzczN30.td6xhrq2ik59CGkceE13dVyikUAysNfD1Y1g2AyWxCQ'
);

const LOODS = { lat: 52.02051, lng: 5.10586, label: 'Loods Nieuwegein' };
const STOP_UREN = 1;
const SNELHEID_KMH = 80;

function haversine(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

async function geocodeAdres(
  adres: string,
  postcode: string,
  stad: string,
  token: string | undefined
): Promise<{ lat: number; lng: number } | null> {
  if (token) {
    try {
      const q = encodeURIComponent(`${adres}, ${postcode} ${stad}`);
      const res = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${q}.json?access_token=${token}&limit=1`
      );
      const data = await res.json();
      if (data.features?.[0]) {
        const [lng, lat] = data.features[0].center;
        return { lat, lng };
      }
    } catch {}
  }
  try {
    const q = encodeURIComponent(`${adres}, ${postcode} ${stad}`);
    const res = await fetch(`https://nominatim.openstreetmap.org/search?q=${q}&format=json&limit=1`, {
      headers: { 'User-Agent': 'EuroWheelzPlanner/1.0', 'Accept-Language': 'nl' },
    });
    const data = await res.json();
    if (data[0]) return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
  } catch {}
  return null;
}

export async function POST(req: Request) {
  try {
    const { monteur_id, datum, vanuit_huis } = await req.json();
    if (!monteur_id || !datum) {
      return NextResponse.json({ error: 'monteur_id en datum verplicht' }, { status: 400 });
    }

    const [opResult, mResult] = await Promise.all([
      supabase
        .from('opdrachten')
        .select('id, locatie, adres, postcode, stad, route_volgorde, type')
        .eq('monteur_id', monteur_id)
        .eq('datum', datum)
        .is('deleted_at', null)
        .neq('status', 'uitgevoerd')
        .neq('status', 'afgerond')
        .order('route_volgorde'),
      supabase
        .from('monteurs')
        .select('voornaam, naam, huisadres, huisadres_lat, huisadres_lng')
        .eq('id', monteur_id)
        .single(),
    ]);

    // Monteur huisadres kolommen ontbreken → fallback naar basis select
    const monteur = mResult.error?.message?.includes('huisadres')
      ? (await supabase.from('monteurs').select('voornaam, naam').eq('id', monteur_id).single()).data
      : mResult.data;

    const opData = opResult.data;

    if (!opData || opData.length === 0) {
      return NextResponse.json({ stops: [], km_totaal: 0, uren_totaal: 0 });
    }

    const m = monteur as { voornaam: string; naam: string; huisadres: string; huisadres_lat: number | null; huisadres_lng: number | null } | null;
    const startPunt =
      vanuit_huis && m?.huisadres_lat && m?.huisadres_lng
        ? { lat: m.huisadres_lat, lng: m.huisadres_lng, label: 'Thuis' }
        : { lat: LOODS.lat, lng: LOODS.lng, label: LOODS.label };

    const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

    // Geocodeer stops (parallel met Mapbox, sequentieel met Nominatim)
    type Stop = { id: string; lat: number; lng: number; label: string; locatie: string };
    let stops: Stop[] = [];

    if (token) {
      const results = await Promise.all(
        opData.map(async (op, i) => {
          const coords = await geocodeAdres(op.adres, op.postcode, op.stad, token);
          if (!coords) return null;
          return { id: op.id, lat: coords.lat, lng: coords.lng, label: String(i + 1), locatie: op.locatie };
        })
      );
      stops = results.filter(Boolean) as Stop[];
    } else {
      for (const [i, op] of opData.entries()) {
        const coords = await geocodeAdres(op.adres, op.postcode, op.stad, undefined);
        if (coords) {
          stops.push({ id: op.id, lat: coords.lat, lng: coords.lng, label: String(i + 1), locatie: op.locatie });
        }
        await new Promise((r) => setTimeout(r, 1100));
      }
    }

    if (stops.length === 0) {
      return NextResponse.json({ stops: [], startPunt, km_totaal: 0, uren_totaal: 0 });
    }

    // Probeer Mapbox Directions voor echte route + geometry
    if (token && stops.length > 0) {
      try {
        const waypoints = [startPunt, ...stops].map((s) => `${s.lng},${s.lat}`).join(';');
        const res = await fetch(
          `https://api.mapbox.com/directions/v5/mapbox/driving/${waypoints}?access_token=${token}&geometries=geojson&overview=full`
        );
        const data = await res.json();
        if (data.routes?.[0]) {
          const route = data.routes[0];
          const km = Math.round(route.distance / 1000);
          const rijUren = route.duration / 3600;
          const uren = Math.round((rijUren + stops.length * STOP_UREN) * 10) / 10;
          return NextResponse.json({ stops, startPunt, geometry: route.geometry, km_totaal: km, uren_totaal: uren });
        }
      } catch {}
    }

    // Fallback: haversine schatting
    let km = 0;
    let pos = { lat: startPunt.lat, lng: startPunt.lng };
    for (const stop of stops) {
      km += haversine(pos, stop);
      pos = stop;
    }
    const rijUren = km / SNELHEID_KMH;
    const uren = Math.round((rijUren + stops.length * STOP_UREN) * 10) / 10;

    return NextResponse.json({ stops, startPunt, km_totaal: Math.round(km), uren_totaal: uren });
  } catch (err) {
    console.error('Route-dag fout:', err);
    return NextResponse.json({ error: 'Interne serverfout' }, { status: 500 });
  }
}
