'use client';

import { useState, useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';
import DashboardLayout from '@/components/DashboardLayout';
import { supabase, DbRelatie } from '@/lib/supabase';
import { Search, AlertCircle, ChevronRight, RefreshCw, CheckCircle2, MapPin, X, SlidersHorizontal } from 'lucide-react';

type EchopersFilter = 'alle' | '1-5' | '6-15' | '16+';
type AccuFilter = 'alle' | 'met' | 'zonder';

const LocatieKaart = dynamic(() => import('@/components/LocatieKaart'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center bg-gray-100">
      <div className="text-sm text-gray-400">Kaart laden...</div>
    </div>
  ),
});

export default function KaartPage() {
  const [relaties, setRelaties] = useState<DbRelatie[]>([]);
  const [laden, setLaden] = useState(true);
  const [zoek, setZoek] = useState('');
  const [typeFilter, setTypeFilter] = useState<'alle' | 'klant' | 'consignatie'>('alle');
  const [statusFilter, setStatusFilter] = useState<'alle' | 'actief' | 'inactief'>('alle');
  const [echopersFilter, setEchopersFilter] = useState<EchopersFilter>('alle');
  const [accuFilter, setAccuFilter] = useState<AccuFilter>('alle');
  const [toonFilters, setToonFilters] = useState(false);
  const [actieveId, setActieveId] = useState<string | null>(null);

  // Geocodeer-state
  const [geocodeBezig, setGeocodeBezig] = useState(false);
  const [geocodeVoortgang, setGeocodeVoortgang] = useState({ huidig: 0, totaal: 0, gevonden: 0 });
  const [geocodeDone, setGeocodeDone] = useState(false);
  const stopRef = useRef(false);

  useEffect(() => {
    laadRelaties();
  }, []);

  async function laadRelaties() {
    setLaden(true);
    const { data } = await supabase
      .from('relaties')
      .select('*')
      .is('deleted_at', null)
      .order('naam', { ascending: true });
    setRelaties(data ?? []);
    setLaden(false);
  }

  const actieveFilters =
    (statusFilter !== 'alle' ? 1 : 0) +
    (echopersFilter !== 'alle' ? 1 : 0) +
    (accuFilter !== 'alle' ? 1 : 0);

  const gefilterd = relaties.filter((r) => {
    const zoekMatch =
      !zoek ||
      r.naam.toLowerCase().includes(zoek.toLowerCase()) ||
      r.plaats.toLowerCase().includes(zoek.toLowerCase()) ||
      (r.crediteurnummer ?? '').toLowerCase().includes(zoek.toLowerCase());
    const typeMatch = typeFilter === 'alle' || r.type === typeFilter;
    const statusMatch =
      statusFilter === 'alle' ||
      (statusFilter === 'actief' && r.status === 'actief') ||
      (statusFilter === 'inactief' && r.status !== 'actief');
    const echopersMatch =
      echopersFilter === 'alle' ||
      (echopersFilter === '1-5' && r.echopers >= 1 && r.echopers <= 5) ||
      (echopersFilter === '6-15' && r.echopers >= 6 && r.echopers <= 15) ||
      (echopersFilter === '16+' && r.echopers >= 16);
    const accuMatch =
      accuFilter === 'alle' ||
      (accuFilter === 'met' && r.accus > 0) ||
      (accuFilter === 'zonder' && r.accus === 0);
    return zoekMatch && typeMatch && statusMatch && echopersMatch && accuMatch;
  });

  const metCoords = gefilterd.filter((r) => r.lat != null && r.lng != null);
  const zonderCoords = relaties.filter((r) => r.lat == null || r.lng == null);

  async function geocodeerOntbrekende() {
    if (geocodeBezig) return;
    stopRef.current = false;
    setGeocodeBezig(true);
    setGeocodeDone(false);
    setGeocodeVoortgang({ huidig: 0, totaal: zonderCoords.length, gevonden: 0 });

    let gevonden = 0;

    for (let i = 0; i < zonderCoords.length; i++) {
      if (stopRef.current) break;
      const r = zonderCoords[i];

      // Bouw zoekopdracht: adres + postcode + plaats + land, of naam + plaats als adres ontbreekt
      const heeftAdres = r.adres?.trim() && r.plaats?.trim();
      const query = heeftAdres
        ? [r.adres, r.postcode, r.plaats, r.land].filter(Boolean).join(', ')
        : [r.naam, r.plaats, r.land].filter(Boolean).join(', ');

      let lat: number | null = null;
      let lng: number | null = null;

      try {
        const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1&addressdetails=0`;
        const res = await fetch(url, {
          headers: { 'User-Agent': 'EuroWheelz-Plansysteem/1.0 (contact@eurowheelz.nl)' },
        });
        const json = await res.json();
        if (json[0]) {
          lat = parseFloat(json[0].lat);
          lng = parseFloat(json[0].lon);
          gevonden++;
        }
      } catch {}

      if (lat != null && lng != null) {
        await supabase.from('relaties').update({ lat, lng }).eq('id', r.id);
        setRelaties((prev) => prev.map((rel) => rel.id === r.id ? { ...rel, lat, lng } : rel));
      }

      setGeocodeVoortgang({ huidig: i + 1, totaal: zonderCoords.length, gevonden });

      if (i < zonderCoords.length - 1 && !stopRef.current) {
        await new Promise((resolve) => setTimeout(resolve, 1100));
      }
    }

    setGeocodeBezig(false);
    setGeocodeDone(true);
  }

  return (
    <DashboardLayout title="Overzichtskaart">
      <div className="flex gap-4 h-[calc(100vh-8rem)]">

        {/* ── Linker paneel ─────────────────────────── */}
        <div className="w-72 flex-shrink-0 flex flex-col gap-3">

          {/* Zoekbalk */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Zoek locatie, stad..."
              className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              value={zoek}
              onChange={(e) => setZoek(e.target.value)}
            />
          </div>

          {/* Type filter */}
          <div className="flex gap-1 p-1 bg-gray-100 rounded-lg">
            {(['alle', 'consignatie', 'klant'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTypeFilter(t)}
                className={`flex-1 py-1.5 text-xs font-semibold rounded-md transition-all capitalize
                  ${typeFilter === t ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
              >
                {t === 'alle' ? 'Alle' : t === 'consignatie' ? 'Consignatie' : 'Klanten'}
              </button>
            ))}
          </div>

          {/* Extra filters toggle */}
          <button
            onClick={() => setToonFilters(!toonFilters)}
            className="flex items-center justify-between w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-xs font-semibold text-gray-600 hover:bg-gray-50 transition-colors"
          >
            <span className="flex items-center gap-1.5">
              <SlidersHorizontal className="w-3.5 h-3.5" />
              Filters
            </span>
            <span className="flex items-center gap-1.5">
              {actieveFilters > 0 && (
                <span className="bg-primary text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                  {actieveFilters}
                </span>
              )}
              <ChevronRight className={`w-3.5 h-3.5 transition-transform ${toonFilters ? 'rotate-90' : ''}`} />
            </span>
          </button>

          {toonFilters && (
            <div className="bg-white border border-gray-200 rounded-xl p-3 space-y-3">

              {/* Status */}
              <div>
                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Status</p>
                <div className="flex gap-1">
                  {(['alle', 'actief', 'inactief'] as const).map((s) => (
                    <button key={s} onClick={() => setStatusFilter(s)}
                      className={`flex-1 py-1 text-xs font-medium rounded-md capitalize transition-all
                        ${statusFilter === s ? 'bg-primary text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
                      {s === 'alle' ? 'Alle' : s === 'actief' ? 'Actief' : 'Inactief'}
                    </button>
                  ))}
                </div>
              </div>

              {/* E-choppers */}
              <div>
                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Aantal e-choppers</p>
                <div className="flex gap-1">
                  {(['alle', '1-5', '6-15', '16+'] as const).map((e) => (
                    <button key={e} onClick={() => setEchopersFilter(e)}
                      className={`flex-1 py-1 text-xs font-medium rounded-md transition-all
                        ${echopersFilter === e ? 'bg-primary text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
                      {e === 'alle' ? 'Alle' : e}
                    </button>
                  ))}
                </div>
              </div>

              {/* Accu's */}
              <div>
                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Accu&apos;s</p>
                <div className="flex gap-1">
                  {(['alle', 'met', 'zonder'] as const).map((a) => (
                    <button key={a} onClick={() => setAccuFilter(a)}
                      className={`flex-1 py-1 text-xs font-medium rounded-md capitalize transition-all
                        ${accuFilter === a ? 'bg-primary text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
                      {a === 'alle' ? 'Alle' : a === 'met' ? 'Met accu\'s' : 'Zonder'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Reset */}
              {actieveFilters > 0 && (
                <button
                  onClick={() => { setStatusFilter('alle'); setEchopersFilter('alle'); setAccuFilter('alle'); }}
                  className="w-full py-1.5 text-xs text-gray-400 hover:text-gray-600 transition-colors border-t border-gray-100 pt-2"
                >
                  Filters wissen
                </button>
              )}
            </div>
          )}

          {/* Teller */}
          <div className="flex items-center justify-between text-xs text-gray-500 px-1">
            <span><strong className="text-gray-800">{metCoords.length}</strong> op kaart</span>
            {zonderCoords.length > 0 && (
              <span className="text-amber-600 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                {zonderCoords.length} zonder coördinaten
              </span>
            )}
          </div>

          {/* Geocodeer-banner */}
          {zonderCoords.length > 0 && !geocodeDone && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 space-y-2">
              {geocodeBezig ? (
                <>
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-amber-700 flex items-center gap-1.5">
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      Ophalen... {geocodeVoortgang.huidig}/{geocodeVoortgang.totaal}
                    </span>
                    <button
                      onClick={() => { stopRef.current = true; }}
                      className="text-amber-600 hover:text-amber-800"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="w-full h-1.5 bg-amber-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-amber-500 transition-all duration-300"
                      style={{ width: `${(geocodeVoortgang.huidig / geocodeVoortgang.totaal) * 100}%` }}
                    />
                  </div>
                  <p className="text-[10px] text-amber-600">{geocodeVoortgang.gevonden} gevonden</p>
                </>
              ) : (
                <>
                  <p className="text-xs text-amber-700">
                    <strong>{zonderCoords.length} locaties</strong> hebben geen coördinaten en zijn niet zichtbaar op de kaart.
                  </p>
                  <button
                    onClick={geocodeerOntbrekende}
                    className="w-full flex items-center justify-center gap-1.5 py-1.5 bg-amber-500 hover:bg-amber-600 text-white text-xs font-semibold rounded-lg transition-colors"
                  >
                    <MapPin className="w-3.5 h-3.5" />
                    Coördinaten ophalen
                  </button>
                </>
              )}
            </div>
          )}

          {/* Klaar-melding */}
          {geocodeDone && (
            <div className="bg-green-50 border border-green-200 rounded-xl p-3 flex items-center gap-2 text-xs text-green-700">
              <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
              <span>
                <strong>{geocodeVoortgang.gevonden}</strong> van {geocodeVoortgang.totaal} coördinaten gevonden.
              </span>
              <button onClick={() => setGeocodeDone(false)} className="ml-auto text-green-500 hover:text-green-700">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Lijst */}
          <div className="flex-1 overflow-y-auto bg-white rounded-xl border border-gray-200 divide-y divide-gray-50">
            {laden ? (
              <div className="py-10 text-center text-sm text-gray-400">Laden...</div>
            ) : gefilterd.length === 0 ? (
              <div className="py-10 text-center text-sm text-gray-400">Geen locaties gevonden</div>
            ) : (
              gefilterd.map((r) => {
                const heeftCoords = r.lat != null && r.lng != null;
                return (
                  <button
                    key={r.id}
                    onClick={() => setActieveId(r.id)}
                    className={`w-full flex items-center gap-3 px-3 py-3 text-left hover:bg-gray-50/60 transition-colors group
                      ${actieveId === r.id ? 'bg-primary/5 border-l-2 border-primary' : ''}`}
                  >
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-[10px] font-bold
                      ${heeftCoords ? 'bg-primary/10 text-primary' : 'bg-gray-100 text-gray-400'}`}>
                      {r.naam.charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-gray-800 truncate leading-tight">{r.naam}</p>
                      <p className="text-[11px] text-gray-400 truncate">{r.plaats} · {r.land}</p>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      {!heeftCoords && <AlertCircle className="w-3 h-3 text-amber-400" />}
                      <ChevronRight className="w-3 h-3 text-gray-300 group-hover:text-gray-500 transition-colors" />
                    </div>
                  </button>
                );
              })
            )}
          </div>

          {/* Legenda */}
          <div className="bg-white rounded-xl border border-gray-200 p-3 space-y-1.5 text-xs text-gray-500">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-[#F3A713] flex-shrink-0" />
              Consignatie
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-blue-500 flex-shrink-0" />
              Klant
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-gray-400 flex-shrink-0" />
              Inactief
            </div>
          </div>
        </div>

        {/* ── Kaart ─────────────────────────────────── */}
        <div className="flex-1 rounded-xl overflow-hidden border border-gray-200 shadow-sm relative">
          {laden ? (
            <div className="w-full h-full flex items-center justify-center bg-gray-100">
              <div className="text-sm text-gray-400">Laden...</div>
            </div>
          ) : (
            <LocatieKaart
              relaties={gefilterd}
              actieveId={actieveId}
              onSelecteer={setActieveId}
            />
          )}

          {/* Teller overlay */}
          <div className="absolute top-3 right-3 z-[1000] bg-white/90 backdrop-blur-sm rounded-lg px-3 py-1.5 text-xs font-semibold text-gray-700 shadow-sm border border-gray-200 pointer-events-none">
            {metCoords.length} / {relaties.length} locaties
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
