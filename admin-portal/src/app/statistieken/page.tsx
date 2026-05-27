'use client';

import { useState, useEffect } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { supabase } from '@/lib/supabase';
import { TrendingUp, Truck, MapPin, Calendar, ChevronDown } from 'lucide-react';

type Periode = 'dag' | 'week' | 'maand' | 'kwartaal' | 'jaar';

type Rit = {
  id: string;
  locatie: string;
  datum: string | null;
  monteur_id: string | null;
  km_gereden: number | null;
  type: string;
};


function periodeGrenzen(periode: Periode): { van: string; tot: string; label: string } {
  const nu = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const fmt = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

  if (periode === 'dag') {
    const v = fmt(nu);
    return { van: v, tot: v, label: nu.toLocaleDateString('nl-NL', { weekday: 'long', day: 'numeric', month: 'long' }) };
  }
  if (periode === 'week') {
    const dow = nu.getDay();
    const diff = dow === 0 ? -6 : 1 - dow;
    const ma = new Date(nu); ma.setDate(nu.getDate() + diff);
    const zo = new Date(ma); zo.setDate(ma.getDate() + 6);
    return { van: fmt(ma), tot: fmt(zo), label: `Week ${fmt(ma)} – ${fmt(zo)}` };
  }
  if (periode === 'maand') {
    const van = new Date(nu.getFullYear(), nu.getMonth(), 1);
    const tot = new Date(nu.getFullYear(), nu.getMonth() + 1, 0);
    return { van: fmt(van), tot: fmt(tot), label: nu.toLocaleDateString('nl-NL', { month: 'long', year: 'numeric' }) };
  }
  if (periode === 'kwartaal') {
    const q = Math.floor(nu.getMonth() / 3);
    const van = new Date(nu.getFullYear(), q * 3, 1);
    const tot = new Date(nu.getFullYear(), q * 3 + 3, 0);
    return { van: fmt(van), tot: fmt(tot), label: `Q${q + 1} ${nu.getFullYear()}` };
  }
  // jaar
  const van = new Date(nu.getFullYear(), 0, 1);
  const tot = new Date(nu.getFullYear(), 11, 31);
  return { van: fmt(van), tot: fmt(tot), label: `${nu.getFullYear()}` };
}

export default function StatistiekenPage() {
  const [periode, setPeriode] = useState<Periode>('week');
  const [ritten, setRitten] = useState<Rit[]>([]);
  const [monteurMap, setMonteurMap] = useState<Record<string, string>>({});
  const [laden, setLaden] = useState(true);

  const grenzen = periodeGrenzen(periode);

  useEffect(() => {
    supabase.from('monteurs').select('id, naam, voornaam').then(({ data }) => {
      const map: Record<string, string> = {};
      (data ?? []).forEach((m: any) => { map[m.id] = `${m.voornaam} ${m.naam}`; });
      setMonteurMap(map);
    });
  }, []);

  useEffect(() => {
    laadRitten();
  }, [periode]);

  async function laadRitten() {
    setLaden(true);
    const query = supabase
      .from('opdrachten')
      .select('id, locatie, datum, monteur_id, km_gereden, type')
      .in('status', ['uitgevoerd', 'afgerond'])
      .is('deleted_at', null)
      .order('datum', { ascending: false });

    if (grenzen.van) query.gte('datum', grenzen.van);
    if (grenzen.tot) query.lte('datum', grenzen.tot);

    const { data } = await query;
    setRitten((data ?? []) as Rit[]);
    setLaden(false);
  }

  // Dedupliceer km per monteur+dag: alle stops van één dag hebben dezelfde km_dag waarde,
  // we tellen die dag maar 1× (neem de max per monteur+dag combinatie)
  const dagKmMap: Record<string, number> = {};
  for (const r of ritten) {
    if (!r.monteur_id || !r.datum || r.km_gereden == null) continue;
    const key = `${r.monteur_id}_${r.datum}`;
    dagKmMap[key] = Math.max(dagKmMap[key] ?? 0, r.km_gereden);
  }
  const uniekeDagen = Object.values(dagKmMap);

  const totalKm = uniekeDagen.reduce((t, km) => t + km, 0);
  const aantalRitten = uniekeDagen.length;
  const gemKm = aantalRitten > 0 ? Math.round(totalKm / aantalRitten) : 0;

  // Per monteur
  const monteurIds = [...new Set(ritten.map((r) => r.monteur_id).filter(Boolean))] as string[];
  const perMonteur = monteurIds.map((id) => {
    const mDagen = Object.entries(dagKmMap)
      .filter(([key]) => key.startsWith(`${id}_`))
      .map(([, km]) => km);
    return { id, naam: monteurMap[id] ?? id, ritten: mDagen.length, km: mDagen.reduce((t, km) => t + km, 0) };
  }).filter((m) => m.ritten > 0);

  const maxKm = Math.max(...perMonteur.map((m) => m.km), 1);

  const PERIODES: { key: Periode; label: string }[] = [
    { key: 'dag', label: 'Dag' },
    { key: 'week', label: 'Week' },
    { key: 'maand', label: 'Maand' },
    { key: 'kwartaal', label: 'Kwartaal' },
    { key: 'jaar', label: 'Jaar' },
  ];

  return (
    <DashboardLayout title="Statistieken">
      {/* Periode selector */}
      <div className="flex items-center gap-3 mb-6">
        <div className="flex rounded-xl border border-gray-200 overflow-hidden text-sm font-semibold bg-white">
          {PERIODES.map((p) => (
            <button
              key={p.key}
              onClick={() => setPeriode(p.key)}
              className={`px-4 py-2 transition-colors ${
                periode === p.key ? 'bg-primary text-white' : 'text-gray-500 hover:bg-gray-50'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
        <span className="text-sm text-gray-400">{grenzen.label}</span>
      </div>

      {/* KPI kaarten */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { label: 'Totaal gereden', waarde: `${totalKm.toLocaleString('nl-NL')} km`, icoon: TrendingUp, kleur: 'text-primary bg-primary/10' },
          { label: 'Aantal ritten', waarde: `${aantalRitten}`, icoon: Truck, kleur: 'text-amber-600 bg-amber-100' },
          { label: 'Gemiddeld per rit', waarde: `${gemKm} km`, icoon: MapPin, kleur: 'text-blue-600 bg-blue-100' },
        ].map((kpi) => (
          <div key={kpi.label} className="bg-white rounded-xl border border-gray-200 p-5 flex items-center gap-4">
            <div className={`p-3 rounded-xl ${kpi.kleur}`}>
              <kpi.icoon className="w-5 h-5" />
            </div>
            <div>
              <p className="text-2xl font-black text-gray-900">{kpi.waarde}</p>
              <p className="text-xs text-gray-400 mt-0.5">{kpi.label}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* Per monteur */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <p className="text-sm font-bold text-gray-700 mb-4">Kilometers per monteur</p>
          {laden ? (
            <div className="text-center py-8 text-sm text-gray-400">Laden...</div>
          ) : perMonteur.length === 0 ? (
            <div className="text-center py-8 text-sm text-gray-400">Geen data voor deze periode</div>
          ) : (
            <div className="space-y-4">
              {perMonteur
                .sort((a, b) => b.km - a.km)
                .map((m) => (
                  <div key={m.id}>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-sm font-semibold text-gray-700">{m.naam}</span>
                      <div className="text-right">
                        <span className="text-sm font-bold text-gray-900">{m.km.toLocaleString('nl-NL')} km</span>
                        <span className="text-xs text-gray-400 ml-2">{m.ritten} rit{m.ritten !== 1 ? 'ten' : ''}</span>
                      </div>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary rounded-full transition-all"
                        style={{ width: `${(m.km / maxKm) * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
            </div>
          )}
        </div>

        {/* Ritten tabel */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <p className="text-sm font-bold text-gray-700 mb-4">Ritten overzicht</p>
          {laden ? (
            <div className="text-center py-8 text-sm text-gray-400">Laden...</div>
          ) : ritten.length === 0 ? (
            <div className="text-center py-8 text-sm text-gray-400">Geen ritten in deze periode</div>
          ) : (
            <div className="overflow-y-auto max-h-80">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left pb-2 text-gray-400 font-semibold uppercase tracking-wide">Datum</th>
                    <th className="text-left pb-2 text-gray-400 font-semibold uppercase tracking-wide">Locatie</th>
                    <th className="text-left pb-2 text-gray-400 font-semibold uppercase tracking-wide">Monteur</th>
                    <th className="text-right pb-2 text-gray-400 font-semibold uppercase tracking-wide">Km</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {ritten.map((r) => (
                    <tr key={r.id} className="hover:bg-gray-50/50">
                      <td className="py-2 text-gray-500">
                        {r.datum ? new Date(r.datum + 'T12:00:00').toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' }) : '—'}
                      </td>
                      <td className="py-2 font-medium text-gray-800 truncate max-w-[120px]">{r.locatie}</td>
                      <td className="py-2 text-gray-500">{r.monteur_id ? monteurMap[r.monteur_id] ?? r.monteur_id : '—'}</td>
                      <td className="py-2 text-right font-bold text-primary">{r.km_gereden != null ? `${r.km_gereden} km` : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
