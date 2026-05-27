import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://cqtpscaefqxntopxyrnr.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNxdHBzY2FlZnF4bnRvcHh5cm5yIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY2NTc3MzcsImV4cCI6MjA5MjIzMzczN30.td6xhrq2ik59CGkceE13dVyikUAysNfD1Y1g2AyWxCQ'
);

const LOODS = { lat: 52.02051, lng: 5.10586 };
const WERKDAG_UREN = 7.5;
// Maandag ochtend t/m 12:00 gereserveerd voor spoedjes
const MAANDAG_GEBLOKKEERD_UREN = 4;
const STOP_UREN = 1;
const SNELHEID_KMH = 80;
// Minimaal aantal voertuigen op één dag waarvoor monteur vanuit loods moet vertrekken (laden)
const MIN_VOERTUIGEN_LOODS = 3;
// Correctiefactor haversine (vogelvlucht) → werkelijke wegafstand
const WEGFACTOR = 1.3;
// Bakwagen: grote bus met capaciteit 12, verplicht bij ≥9 voertuigen per stop
const BAKWAGEN_CAPACITEIT = 12;
const BAKWAGEN_MIN_VOERTUIGEN = 9;

type Pos = { lat: number; lng: number };
type GeoOp = { id: string; locatie: string; lat: number; lng: number; prioriteit: number; urgent: boolean; aantal_voertuigen: number };

function haversine(a: Pos, b: Pos): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

async function geocodeBatch(
  items: { id: string; adres: string; postcode: string; stad: string }[],
  token: string | undefined
): Promise<Map<string, Pos>> {
  const result = new Map<string, Pos>();
  if (items.length === 0) return result;

  if (token) {
    // Mapbox: parallel
    await Promise.all(
      items.map(async (item) => {
        try {
          const q = encodeURIComponent(`${item.adres}, ${item.postcode} ${item.stad}`);
          const res = await fetch(
            `https://api.mapbox.com/geocoding/v5/mapbox.places/${q}.json?access_token=${token}&limit=1`
          );
          const data = await res.json();
          if (data.features?.[0]) {
            const [lng, lat] = data.features[0].center;
            result.set(item.id, { lat, lng });
          }
        } catch {}
      })
    );
  } else {
    // Nominatim: sequentieel met rate limiting
    for (const item of items) {
      try {
        const q = encodeURIComponent(`${item.adres}, ${item.postcode} ${item.stad}`);
        const res = await fetch(`https://nominatim.openstreetmap.org/search?q=${q}&format=json&limit=1`, {
          headers: { 'User-Agent': 'EuroWheelzPlanner/1.0', 'Accept-Language': 'nl' },
        });
        const data = await res.json();
        if (data[0]) result.set(item.id, { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) });
      } catch {}
      await new Promise((r) => setTimeout(r, 1100));
    }
  }
  return result;
}

function werkdagenReeks(van: string, tot: string): string[] {
  const dagen: string[] = [];
  const d = new Date(van);
  const eind = new Date(tot);
  while (d <= eind) {
    const dow = d.getDay();
    if (dow !== 0 && dow !== 6) dagen.push(d.toISOString().split('T')[0]);
    d.setDate(d.getDate() + 1);
  }
  return dagen;
}

function prioriteitScore(urgent: boolean, prioriteit: number): number {
  if (urgent) return 0;
  if (prioriteit === 1) return 1;
  if (prioriteit === 2) return 2;
  return 3;
}

/**
 * Nearest-neighbor planner voor één monteur op één dag.
 * Retourneert het aantal ingeplande voertuigen (som van aantal_voertuigen).
 * Als dryRun=true worden geen assignments gepushed en toegewezenSet niet gemuteerd.
 */
function planDagNN(
  startPos: Pos,
  eindPos: Pos,
  bestaandGecodeerdKm: number,
  bestaandUren: number,
  dagUren: number,
  kandidaten: GeoOp[],
  toegewezenSet: Set<string>,
  busCapaciteit: number,
  monteurId: string,
  datum: string,
  startVolgorde: number,
  dryRun: boolean,
  onAssign: (a: { opdracht_id: string; monteur_id: string; datum: string; route_volgorde: number; km_dag: number }) => void
): number {
  let huidigPos = startPos;
  let urenGebruikt = bestaandUren;
  let kmNieuw = 0;
  let volgende = startVolgorde;
  let totaalVoertuigen = 0;

  const terugreisBestaand = haversine(huidigPos, eindPos) / SNELHEID_KMH;
  let urenOver = Math.max(0, dagUren - urenGebruikt - terugreisBestaand);

  const lokaalToegewezen = dryRun ? new Set(toegewezenSet) : toegewezenSet;
  const pendingAssignments: { opdracht_id: string; monteur_id: string; datum: string; route_volgorde: number; km_dag: number }[] = [];

  let gevonden = true;
  while (gevonden && urenOver > 0) {
    gevonden = false;

    let besteOp: GeoOp | null = null;
    let besteScore = Infinity;

    for (const op of kandidaten) {
      if (lokaalToegewezen.has(op.id)) continue;
      if (busCapaciteit < op.aantal_voertuigen) continue;

      const kmNaar = haversine(huidigPos, op);
      const rijTijdTerug = haversine(op, eindPos) / SNELHEID_KMH;
      const tijdNodig = kmNaar / SNELHEID_KMH + STOP_UREN + rijTijdTerug;

      if (urenOver < tijdNodig) continue;

      if (kmNaar < besteScore) {
        besteScore = kmNaar;
        besteOp = op;
      }
    }

    if (besteOp) {
      const kmNaar = haversine(huidigPos, besteOp);
      const oudeTerugreis = haversine(huidigPos, eindPos) / SNELHEID_KMH;
      const nieuweTerugreis = haversine(besteOp, eindPos) / SNELHEID_KMH;

      urenOver -= kmNaar / SNELHEID_KMH + STOP_UREN + nieuweTerugreis - oudeTerugreis;
      kmNieuw += kmNaar;
      huidigPos = { lat: besteOp.lat, lng: besteOp.lng };
      totaalVoertuigen += besteOp.aantal_voertuigen;

      lokaalToegewezen.add(besteOp.id);

      if (!dryRun) {
        pendingAssignments.push({
          opdracht_id: besteOp.id,
          monteur_id: monteurId,
          datum,
          route_volgorde: volgende++,
          km_dag: 0, // filled in below after return trip is known
        });
      }

      gevonden = true;
    }
  }

  // Voeg retourrit toe en corrigeer voor werkelijke wegafstand (haversine is vogelvlucht)
  if (!dryRun && pendingAssignments.length > 0) {
    kmNieuw += haversine(huidigPos, eindPos); // retour naar start
    const finalKm = Math.round((bestaandGecodeerdKm + kmNieuw) * WEGFACTOR);
    for (const a of pendingAssignments) {
      onAssign({ ...a, km_dag: finalKm });
    }
  }

  return totaalVoertuigen;
}

export async function POST(req: Request) {
  try {
    const { datumVan, datumTot, vanuitHuisPerDag, geenPlanningDagen } = await req.json();
    const vertrekOverride = (vanuitHuisPerDag ?? {}) as Record<string, boolean>;
    const uitgeslotenDagen = new Set<string>((geenPlanningDagen ?? []) as string[]);
    if (!datumVan || !datumTot) {
      return NextResponse.json({ error: 'datumVan en datumTot zijn verplicht' }, { status: 400 });
    }

    const werkdagen = werkdagenReeks(datumVan, datumTot);
    if (werkdagen.length === 0) {
      return NextResponse.json({ error: 'Geen werkdagen in het opgegeven bereik' }, { status: 400 });
    }

    const [ongeplanResult, geplanResult, mResult, relatiesResult] = await Promise.all([
      supabase
        .from('opdrachten')
        .select('id, locatie, adres, postcode, stad, prioriteit, urgent, aantal_voertuigen')
        .is('deleted_at', null)
        .is('monteur_id', null)
        .neq('status', 'uitgevoerd')
        .neq('status', 'afgerond'),
      supabase
        .from('opdrachten')
        .select('id, adres, postcode, stad, monteur_id, datum, route_volgorde, aantal_voertuigen')
        .is('deleted_at', null)
        .not('monteur_id', 'is', null)
        .gte('datum', datumVan)
        .lte('datum', datumTot)
        .neq('status', 'uitgevoerd')
        .neq('status', 'afgerond')
        .order('route_volgorde'),
      supabase.from('monteurs').select('id, bus_capaciteit, van_huis, huisadres_lat, huisadres_lng'),
      supabase.from('relaties').select('naam, gesloten_dagen').is('deleted_at', null),
    ]);

    let ongeplanData = ongeplanResult.data;
    if (ongeplanResult.error) {
      if (ongeplanResult.error.message.includes('aantal_voertuigen')) {
        const retry = await supabase
          .from('opdrachten')
          .select('id, adres, postcode, stad, prioriteit, urgent')
          .is('deleted_at', null)
          .is('monteur_id', null)
          .neq('status', 'uitgevoerd')
          .neq('status', 'afgerond');
        if (retry.error) return NextResponse.json({ error: retry.error.message }, { status: 500 });
        ongeplanData = (retry.data ?? []).map((o: any) => ({ ...o, aantal_voertuigen: 1 }));
      } else {
        return NextResponse.json({ error: ongeplanResult.error.message }, { status: 500 });
      }
    }
    if (mResult.error) return NextResponse.json({ error: mResult.error.message }, { status: 500 });

    // Build map: locatienaam → gesloten weekdagen (0=zo, 1=ma, ..., 6=za)
    const geslotenDagenMap = new Map<string, number[]>();
    for (const r of (relatiesResult.data ?? []) as { naam: string; gesloten_dagen: number[] | null }[]) {
      if (r.gesloten_dagen && r.gesloten_dagen.length > 0) {
        geslotenDagenMap.set(r.naam.toLowerCase().trim(), r.gesloten_dagen);
      }
    }

    const monteurs = (mResult.data ?? []) as {
      id: string; bus_capaciteit: number; van_huis: boolean;
      huisadres_lat: number | null; huisadres_lng: number | null;
    }[];

    const geplanData = (geplanResult.data ?? []) as {
      id: string; adres: string; postcode: string; stad: string;
      monteur_id: string; datum: string; route_volgorde: number; aantal_voertuigen: number | null;
    }[];

    if (!ongeplanData || ongeplanData.length === 0) {
      return NextResponse.json({ assignments: [], info: 'Geen ongeplande opdrachten gevonden' });
    }

    const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

    const alleAdressen = [
      ...ongeplanData.map((o: any) => ({ id: o.id, adres: o.adres, postcode: o.postcode, stad: o.stad })),
      ...geplanData.map((o) => ({ id: o.id, adres: o.adres, postcode: o.postcode, stad: o.stad })),
    ];
    const geoCache = await geocodeBatch(alleAdressen, token);

    const inTePlannen: GeoOp[] = (ongeplanData as any[])
      .map((op) => {
        const coords = geoCache.get(op.id);
        if (!coords) return null;
        return {
          id: op.id,
          locatie: (op.locatie ?? '').toLowerCase().trim(),
          lat: coords.lat,
          lng: coords.lng,
          prioriteit: op.prioriteit ?? 3,
          urgent: op.urgent ?? false,
          aantal_voertuigen: op.aantal_voertuigen ?? 1,
        };
      })
      .filter(Boolean) as GeoOp[];

    if (inTePlannen.length === 0) {
      return NextResponse.json({ assignments: [], info: 'Geen geocodeerbare opdrachten gevonden' });
    }

    inTePlannen.sort((a, b) => {
      const pa = prioriteitScore(a.urgent, a.prioriteit);
      const pb = prioriteitScore(b.urgent, b.prioriteit);
      if (pa !== pb) return pa - pb;
      return b.aantal_voertuigen - a.aantal_voertuigen;
    });

    const assignments: { opdracht_id: string; monteur_id: string; datum: string; route_volgorde: number; km_dag: number }[] = [];
    const bakwagenToewijzingen: { monteur_id: string; datum: string }[] = [];
    const toegewezen = new Set<string>();

    for (const datum of werkdagen) {
      // Maandag: ochtend t/m 12:00 geblokkeerd voor spoedjes → 4 uur minder beschikbaar
      const dagVanDeWeek = new Date(`${datum}T12:00:00`).getDay();
      const isMaandag = dagVanDeWeek === 1;
      const dagUren = isMaandag
        ? Math.max(0, WERKDAG_UREN - MAANDAG_GEBLOKKEERD_UREN)
        : WERKDAG_UREN;

      // Filter opdrachten waarvan de locatie op deze dag gesloten is
      const kandidatenVandaag = inTePlannen.filter((op) => {
        const gesloten = geslotenDagenMap.get(op.locatie);
        return !gesloten || !gesloten.includes(dagVanDeWeek);
      });

      // Bepaal welke monteur de bakwagen rijdt deze dag (bij stops met ≥9 voertuigen)
      const bakwagenStops = kandidatenVandaag.filter(
        (op) => !toegewezen.has(op.id) && op.aantal_voertuigen >= BAKWAGEN_MIN_VOERTUIGEN
      );
      let bakwagenMonteurId: string | null = null;
      if (bakwagenStops.length > 0) {
        // Zijn er ook andere stops met veel voertuigen (5–8)? → geef bakwagen aan monteur met kleinste bus
        const heeftAndereGroteStop = kandidatenVandaag.some(
          (op) => !toegewezen.has(op.id) && op.aantal_voertuigen >= 5 && op.aantal_voertuigen < BAKWAGEN_MIN_VOERTUIGEN
        );
        if (heeftAndereGroteStop && monteurs.length > 1) {
          bakwagenMonteurId = monteurs.reduce((a, b) =>
            a.bus_capaciteit <= b.bus_capaciteit ? a : b
          ).id;
        } else {
          // Kies de monteur dichtstbij de eerste grote stop
          const stop = bakwagenStops[0];
          let besteId = monteurs[0].id;
          let kortste = Infinity;
          for (const m of monteurs) {
            const pos = m.huisadres_lat && m.huisadres_lng
              ? { lat: m.huisadres_lat, lng: m.huisadres_lng }
              : LOODS;
            const d = haversine(pos, stop);
            if (d < kortste) { kortste = d; besteId = m.id; }
          }
          bakwagenMonteurId = besteId;
        }
        bakwagenToewijzingen.push({ monteur_id: bakwagenMonteurId, datum });
      }

      for (const m of monteurs) {
        const dagKey = `${m.id}_${datum}`;
        if (uitgeslotenDagen.has(dagKey)) continue; // monteur niet beschikbaar op deze dag
        const vanHuis = dagKey in vertrekOverride ? vertrekOverride[dagKey] : m.van_huis;
        const huisPos =
          vanHuis && m.huisadres_lat && m.huisadres_lng
            ? { lat: m.huisadres_lat, lng: m.huisadres_lng }
            : null;

        // Bereken al-gebruikte tijd op basis van bestaande opdrachten
        const bestaand = geplanData
          .filter((o) => o.monteur_id === m.id && o.datum === datum)
          .sort((a, b) => a.route_volgorde - b.route_volgorde);

        let urenGebruikt = 0;
        let kmGebruikt = 0;
        let huidigPos: Pos = huisPos ?? LOODS;

        for (const op of bestaand) {
          const coords = geoCache.get(op.id);
          if (coords) {
            const km = haversine(huidigPos, coords);
            urenGebruikt += km / SNELHEID_KMH + STOP_UREN;
            kmGebruikt += km;
            huidigPos = coords;
          } else {
            urenGebruikt += STOP_UREN;
          }
        }

        // Bakwagen-monteur: capaciteit 12, altijd vanuit loods (bakwagen ophalen)
        const heeftBakwagen = m.id === bakwagenMonteurId;
        const effectiefCapaciteit = heeftBakwagen ? BAKWAGEN_CAPACITEIT : m.bus_capaciteit;

        let startPos: Pos;
        let eindPos: Pos;

        if (heeftBakwagen) {
          // Bakwagen staat altijd bij de loods
          startPos = LOODS;
          eindPos = LOODS;
        } else if (huisPos) {
          // Dry-run: tel hoeveel voertuigen er ingepland worden om startpositie te bepalen
          const droogVoertuigen = planDagNN(
            huisPos, huisPos,
            kmGebruikt, urenGebruikt, dagUren,
            kandidatenVandaag, toegewezen,
            effectiefCapaciteit, m.id, datum,
            bestaand.length + 1,
            true, () => {}
          );
          // Als er ≥ MIN_VOERTUIGEN_LOODS voertuigen mee moeten → toch vanuit loods (laden bus)
          startPos = droogVoertuigen >= MIN_VOERTUIGEN_LOODS ? LOODS : huisPos;
          eindPos = startPos;
        } else {
          startPos = LOODS;
          eindPos = LOODS;
        }

        planDagNN(
          startPos, eindPos,
          kmGebruikt, urenGebruikt, dagUren,
          kandidatenVandaag, toegewezen,
          effectiefCapaciteit, m.id, datum,
          bestaand.length + 1,
          false,
          (a) => assignments.push(a)
        );
      }
    }

    // Update km_dag voor alle assignments van dezelfde monteur+dag naar de eindwaarde
    const dagKm: Record<string, number> = {};
    for (const a of assignments) {
      dagKm[`${a.monteur_id}_${a.datum}`] = a.km_dag;
    }
    for (const a of assignments) {
      a.km_dag = dagKm[`${a.monteur_id}_${a.datum}`];
    }

    return NextResponse.json({ assignments, bakwagenToewijzingen });
  } catch (err) {
    console.error('Auto-plan fout:', err);
    return NextResponse.json({ error: 'Interne serverfout' }, { status: 500 });
  }
}
