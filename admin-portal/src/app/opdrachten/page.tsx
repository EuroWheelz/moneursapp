'use client';

import { useState, useEffect } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { supabase } from '@/lib/supabase';
import {
  Search, Wrench, X, ChevronDown, MapPin, Package,
  Calendar, User, ChevronRight, AlertTriangle, TrendingUp,
} from 'lucide-react';

type Opdracht = {
  id: string;
  type: string;
  locatie: string;
  datum: string | null;
  status: string;
  monteur_id: string | null;
  notitie: string | null;
  urgent: boolean;
  deadline: string | null;
  km_gereden: number | null;
  created_at: string;
  voertuigen?: { id: string; kenteken: string }[];
};

type OnderdeeelRegel = {
  opdracht_id: string;
  aantal: number;
  onderdelen: { naam: string; prijs: number | null } | null;
};

const STATUSSEN = ['nieuw', 'ingepland', 'onderweg', 'uitgevoerd', 'akkoord', 'afgerond'];
const TYPEN = ['onderhoud', 'reparatie', 'accu', 'plaatsen', 'terughalen', 'evaluatie', 'voertuigruil', 'pechhulp'];

const typeLabels: Record<string, string> = {
  onderhoud: 'Onderhoud', reparatie: 'Reparatie', accu: 'Accu',
  plaatsen: 'Plaatsen', terughalen: 'Terughalen', evaluatie: 'Evaluatie',
  voertuigruil: 'Voertuigruil', pechhulp: 'Pechhulp',
};

const typeKleur: Record<string, string> = {
  onderhoud: 'bg-blue-100 text-blue-700',
  reparatie: 'bg-orange-100 text-orange-700',
  accu: 'bg-yellow-100 text-yellow-700',
  plaatsen: 'bg-green-100 text-green-700',
  terughalen: 'bg-red-100 text-red-700',
  evaluatie: 'bg-purple-100 text-purple-700',
  voertuigruil: 'bg-teal-100 text-teal-700',
  pechhulp: 'bg-red-200 text-red-800',
};

const statusKleur: Record<string, string> = {
  nieuw: 'bg-yellow-50 text-yellow-700',
  ingepland: 'bg-blue-50 text-blue-700',
  onderweg: 'bg-indigo-50 text-indigo-700',
  uitgevoerd: 'bg-orange-50 text-orange-700',
  akkoord: 'bg-teal-50 text-teal-700',
  afgerond: 'bg-green-50 text-green-700',
};

export default function OpdrachtverledenPage() {
  const [opdrachten, setOpdrachten] = useState<Opdracht[]>([]);
  const [monteurMap, setMonteurMap] = useState<Record<string, string>>({});
  const [monteurs, setMonteurs] = useState<{ id: string; naam: string }[]>([]);
  const [laden, setLaden] = useState(true);

  const [zoek, setZoek] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('alle');
  const [typeFilter, setTypeFilter] = useState<string>('alle');
  const [monteurFilter, setMonteurFilter] = useState<string>('alle');
  const [vanDatum, setVanDatum] = useState('');
  const [totDatum, setTotDatum] = useState('');
  const [sorteer, setSorteer] = useState<'aanmaak' | 'locatie' | 'datum'>('aanmaak');

  // Enkel opdracht detail
  const [selected, setSelected] = useState<Opdracht | null>(null);
  const [detailOnderdelen, setDetailOnderdelen] = useState<any[]>([]);
  const [detailLaden, setDetailLaden] = useState(false);

  // Locatie tijdlijn
  const [locatieTijdlijn, setLocatieTijdlijn] = useState<string | null>(null);
  const [tijdlijnData, setTijdlijnData] = useState<Opdracht[]>([]);
  const [tijdlijnOnderdelen, setTijdlijnOnderdelen] = useState<Record<string, OnderdeeelRegel[]>>({});
  const [tijdlijnLaden, setTijdlijnLaden] = useState(false);

  useEffect(() => {
    supabase.from('monteurs').select('id, naam, voornaam').then(({ data }) => {
      const map: Record<string, string> = {};
      const list: { id: string; naam: string }[] = [];
      (data ?? []).forEach((m: any) => {
        const naam = `${m.voornaam} ${m.naam}`;
        map[m.id] = naam;
        list.push({ id: m.id, naam });
      });
      setMonteurMap(map);
      setMonteurs(list.sort((a, b) => a.naam.localeCompare(b.naam)));
    });
    laadOpdrachten();
  }, []);

  async function laadOpdrachten() {
    setLaden(true);
    const { data, error } = await supabase
      .from('opdrachten')
      .select('id, type, locatie, datum, status, monteur_id, notitie, urgent, deadline, km_gereden, created_at, voertuigen(id, kenteken)')
      .is('deleted_at', null)
      .order('created_at', { ascending: false });
    if (!error) setOpdrachten((data ?? []) as Opdracht[]);
    setLaden(false);
  }

  async function openLocatieTijdlijn(locatie: string, e: React.MouseEvent) {
    e.stopPropagation();
    setLocatieTijdlijn(locatie);
    setTijdlijnData([]);
    setTijdlijnOnderdelen({});
    setTijdlijnLaden(true);

    const { data: opData } = await supabase
      .from('opdrachten')
      .select('id, type, locatie, datum, status, monteur_id, notitie, urgent, deadline, km_gereden, created_at, voertuigen(id, kenteken)')
      .eq('locatie', locatie)
      .is('deleted_at', null)
      .order('datum', { ascending: false });

    const ops = (opData ?? []) as Opdracht[];
    setTijdlijnData(ops);

    if (ops.length > 0) {
      const ids = ops.map((o) => o.id);
      const { data: ooData } = await supabase
        .from('opdracht_onderdelen')
        .select('opdracht_id, aantal, onderdelen(naam, prijs)')
        .in('opdracht_id', ids);

      const grouped: Record<string, OnderdeeelRegel[]> = {};
      for (const oo of (ooData ?? []) as unknown as OnderdeeelRegel[]) {
        if (!grouped[oo.opdracht_id]) grouped[oo.opdracht_id] = [];
        grouped[oo.opdracht_id].push(oo);
      }
      setTijdlijnOnderdelen(grouped);
    }
    setTijdlijnLaden(false);
  }

  async function openDetail(op: Opdracht) {
    setSelected(op);
    setDetailOnderdelen([]);
    setDetailLaden(true);
    const { data } = await supabase
      .from('opdracht_onderdelen')
      .select('aantal, onderdelen(naam, prijs)')
      .eq('opdracht_id', op.id);
    setDetailOnderdelen(data ?? []);
    setDetailLaden(false);
  }

  const gefilterd = opdrachten.filter((op) => {
    if (statusFilter !== 'alle' && op.status !== statusFilter) return false;
    if (typeFilter !== 'alle' && op.type !== typeFilter) return false;
    if (monteurFilter !== 'alle' && op.monteur_id !== monteurFilter) return false;
    if (vanDatum && op.datum && op.datum < vanDatum) return false;
    if (totDatum && op.datum && op.datum > totDatum) return false;
    if (zoek) {
      const q = zoek.toLowerCase();
      const monteurNaam = op.monteur_id ? (monteurMap[op.monteur_id] ?? '').toLowerCase() : '';
      if (
        !op.locatie?.toLowerCase().includes(q) &&
        !op.id.toLowerCase().includes(q) &&
        !monteurNaam.includes(q)
      ) return false;
    }
    return true;
  }).sort((a, b) => {
    if (sorteer === 'locatie') return (a.locatie ?? '').localeCompare(b.locatie ?? '', 'nl');
    if (sorteer === 'datum') return (b.datum ?? '').localeCompare(a.datum ?? '');
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  const fmtD = (d: string | null) => d
    ? new Date(d + (d.length === 10 ? 'T12:00:00' : '')).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', year: 'numeric' })
    : null;

  const heeftFilters = statusFilter !== 'alle' || typeFilter !== 'alle' || monteurFilter !== 'alle' || !!vanDatum || !!totDatum || !!zoek;

  function resetFilters() {
    setStatusFilter('alle');
    setTypeFilter('alle');
    setMonteurFilter('alle');
    setVanDatum('');
    setTotDatum('');
    setZoek('');
  }

  return (
    <DashboardLayout title="Opdrachtverleden">
      {/* Filter balk */}
      <div className="bg-white border border-gray-200 rounded-xl p-4 mb-4 space-y-3">
        <div className="flex gap-3 flex-wrap">
          <div className="relative flex-1 min-w-48">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Zoek op locatie, ID of monteur..."
              value={zoek}
              onChange={(e) => setZoek(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400">Van</span>
            <input type="date" value={vanDatum} onChange={(e) => setVanDatum(e.target.value)}
              className="px-2 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20" />
            <span className="text-xs text-gray-400">Tot</span>
            <input type="date" value={totDatum} onChange={(e) => setTotDatum(e.target.value)}
              className="px-2 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20" />
          </div>
          <SelectFilter value={typeFilter} onChange={setTypeFilter} placeholder="Alle types">
            {TYPEN.map((t) => <option key={t} value={t}>{typeLabels[t]}</option>)}
          </SelectFilter>
          <SelectFilter value={monteurFilter} onChange={setMonteurFilter} placeholder="Alle monteurs">
            {monteurs.map((m) => <option key={m.id} value={m.id}>{m.naam}</option>)}
          </SelectFilter>
          <select
            value={sorteer}
            onChange={(e) => setSorteer(e.target.value as typeof sorteer)}
            className="px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary/20"
          >
            <option value="aanmaak">Datum aanmaak ↓</option>
            <option value="locatie">Locatie (A→Z)</option>
            <option value="datum">Opdrachtdatum ↓</option>
          </select>
          {heeftFilters && (
            <button onClick={resetFilters} className="flex items-center gap-1.5 px-3 py-2 text-sm text-gray-500 border border-gray-200 rounded-lg hover:bg-gray-50">
              <X className="w-3.5 h-3.5" />Reset
            </button>
          )}
        </div>
        <div className="flex gap-1.5 flex-wrap">
          <StatusPill label={`Alle (${opdrachten.length})`} actief={statusFilter === 'alle'} onClick={() => setStatusFilter('alle')} />
          {STATUSSEN.map((s) => {
            const count = opdrachten.filter((o) => o.status === s).length;
            if (count === 0) return null;
            return (
              <StatusPill key={s}
                label={`${s.charAt(0).toUpperCase() + s.slice(1)} (${count})`}
                actief={statusFilter === s}
                onClick={() => setStatusFilter(statusFilter === s ? 'alle' : s)}
                kleur={statusKleur[s]}
              />
            );
          })}
        </div>
      </div>

      {/* Tabel */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100">
          <p className="text-sm font-semibold text-gray-700">
            {laden ? 'Laden...' : `${gefilterd.length} opdracht${gefilterd.length !== 1 ? 'en' : ''}`}
            {heeftFilters && !laden && <span className="text-gray-400 font-normal"> gefilterd uit {opdrachten.length}</span>}
          </p>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50/60">
              <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">ID</th>
              <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Type</th>
              <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Locatie</th>
              <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Datum</th>
              <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Monteur</th>
              <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
              <th className="px-4 py-2.5 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Km</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {laden && <tr><td colSpan={7} className="py-10 text-center text-sm text-gray-400">Laden...</td></tr>}
            {!laden && gefilterd.length === 0 && <tr><td colSpan={7} className="py-10 text-center text-sm text-gray-400">Geen opdrachten gevonden.</td></tr>}
            {gefilterd.map((op) => (
              <tr key={op.id} onClick={() => openDetail(op)} className="hover:bg-gray-50/60 cursor-pointer">
                <td className="px-4 py-3 font-mono text-xs text-gray-500">{op.id}</td>
                <td className="px-4 py-3">
                  <span className="flex items-center gap-1.5 text-gray-700">
                    <Wrench className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                    {typeLabels[op.type] ?? op.type}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <button
                    onClick={(e) => openLocatieTijdlijn(op.locatie, e)}
                    className="flex items-center gap-1 text-primary font-semibold hover:underline text-sm max-w-[180px] truncate"
                  >
                    <MapPin className="w-3 h-3 flex-shrink-0" />
                    <span className="truncate">{op.locatie || '—'}</span>
                    <ChevronRight className="w-3 h-3 flex-shrink-0 opacity-50" />
                  </button>
                </td>
                <td className="px-4 py-3 text-xs">
                  {op.datum
                    ? <span className="text-blue-600 font-medium">{fmtD(op.datum)}</span>
                    : <span className="text-gray-300 italic">Niet ingepland</span>}
                </td>
                <td className="px-4 py-3 text-gray-600 text-xs">
                  {op.monteur_id ? (monteurMap[op.monteur_id] ?? op.monteur_id) : <span className="text-gray-300 italic">—</span>}
                </td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${statusKleur[op.status] ?? 'bg-gray-100 text-gray-600'}`}>
                    {op.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-right text-xs font-medium text-gray-600">
                  {op.km_gereden != null ? `${op.km_gereden} km` : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Enkel opdracht detail modal */}
      {selected && (
        <OpdrachDetailModal
          opdracht={selected}
          monteurMap={monteurMap}
          onderdelen={detailOnderdelen}
          laden={detailLaden}
          onClose={() => setSelected(null)}
        />
      )}

      {/* Locatie tijdlijn modal */}
      {locatieTijdlijn && (
        <LocatieTijdlijnModal
          locatie={locatieTijdlijn}
          opdrachten={tijdlijnData}
          onderdelen={tijdlijnOnderdelen}
          monteurMap={monteurMap}
          laden={tijdlijnLaden}
          onClose={() => setLocatieTijdlijn(null)}
        />
      )}
    </DashboardLayout>
  );
}

/* ── Locatie tijdlijn modal ────────────────────────────────── */
function LocatieTijdlijnModal({ locatie, opdrachten, onderdelen, monteurMap, laden, onClose }: {
  locatie: string;
  opdrachten: Opdracht[];
  onderdelen: Record<string, OnderdeeelRegel[]>;
  monteurMap: Record<string, string>;
  laden: boolean;
  onClose: () => void;
}) {
  const fmtD = (d: string | null) => d
    ? new Date(d + (d.length === 10 ? 'T12:00:00' : '')).toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' })
    : null;

  const totaalOnderdelen = Object.values(onderdelen).flat().reduce((s, oo) => s + (oo.aantal ?? 1), 0);
  const totaalKosten = Object.values(onderdelen).flat().reduce((s, oo) => {
    const p = oo.onderdelen?.prijs ?? null;
    return p != null ? s + p * (oo.aantal ?? 1) : s;
  }, 0);
  const heeftKosten = Object.values(onderdelen).flat().some((oo) => oo.onderdelen?.prijs != null);
  const afgerond = opdrachten.filter((o) => o.status === 'afgerond' || o.status === 'uitgevoerd').length;

  const typeLabels: Record<string, string> = {
    onderhoud: 'Onderhoud', reparatie: 'Reparatie', accu: 'Accu',
    plaatsen: 'Plaatsen', terughalen: 'Terughalen', evaluatie: 'Evaluatie',
    voertuigruil: 'Voertuigruil', pechhulp: 'Pechhulp',
  };

  const typeKleur: Record<string, string> = {
    onderhoud: 'bg-blue-100 text-blue-700',
    reparatie: 'bg-orange-100 text-orange-700',
    accu: 'bg-yellow-100 text-yellow-700',
    plaatsen: 'bg-green-100 text-green-700',
    terughalen: 'bg-red-100 text-red-700',
    evaluatie: 'bg-purple-100 text-purple-700',
    voertuigruil: 'bg-teal-100 text-teal-700',
    pechhulp: 'bg-red-200 text-red-800',
  };

  const statusKleur: Record<string, string> = {
    nieuw: 'bg-yellow-50 text-yellow-700',
    ingepland: 'bg-blue-50 text-blue-700',
    onderweg: 'bg-indigo-50 text-indigo-700',
    uitgevoerd: 'bg-orange-50 text-orange-700',
    akkoord: 'bg-teal-50 text-teal-700',
    afgerond: 'bg-green-50 text-green-700',
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[92vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-start gap-3 px-6 py-4 border-b border-gray-100">
          <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
            <MapPin className="w-4 h-4 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-gray-900">{locatie}</p>
            <p className="text-xs text-gray-400 mt-0.5">Volledige locatiegeschiedenis</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 transition-colors flex-shrink-0">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* KPI balk */}
        {!laden && opdrachten.length > 0 && (
          <div className="grid grid-cols-4 gap-0 border-b border-gray-100">
            {[
              { label: 'Opdrachten totaal', waarde: opdrachten.length, icon: Wrench },
              { label: 'Uitgevoerd / afgerond', waarde: afgerond, icon: TrendingUp },
              { label: 'Onderdelen gebruikt', waarde: totaalOnderdelen, icon: Package },
              { label: 'Materiaalkosten', waarde: heeftKosten ? `€ ${totaalKosten.toFixed(2)}` : '—', icon: TrendingUp },
            ].map((k, i) => (
              <div key={k.label} className={`px-5 py-3 ${i < 3 ? 'border-r border-gray-100' : ''}`}>
                <p className="text-xl font-black text-gray-900">{k.waarde}</p>
                <p className="text-[11px] text-gray-400 mt-0.5">{k.label}</p>
              </div>
            ))}
          </div>
        )}

        {/* Tijdlijn */}
        <div className="overflow-y-auto flex-1 px-6 py-5">
          {laden ? (
            <p className="text-sm text-gray-400 text-center py-10">Laden...</p>
          ) : opdrachten.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-10 italic">Geen opdrachten gevonden voor deze locatie.</p>
          ) : (
            <div className="relative">
              {/* Verticale lijn */}
              <div className="absolute left-[18px] top-0 bottom-0 w-0.5 bg-gray-100" />

              <div className="space-y-4">
                {opdrachten.map((op, idx) => {
                  const oos = onderdelen[op.id] ?? [];
                  const opKosten = oos.reduce((s, oo) => {
                    const p = oo.onderdelen?.prijs ?? null;
                    return p != null ? s + p * (oo.aantal ?? 1) : s;
                  }, 0);
                  const heeftOpKosten = oos.some((oo) => oo.onderdelen?.prijs != null);
                  const kentekens = op.voertuigen?.map((v) => v.kenteken) ?? [];

                  return (
                    <div key={op.id} className="relative pl-10">
                      {/* Dot op de lijn */}
                      <div className={`absolute left-[11px] top-4 w-4 h-4 rounded-full border-2 border-white flex-shrink-0 z-10 ${
                        op.status === 'afgerond' ? 'bg-green-400' :
                        op.status === 'uitgevoerd' ? 'bg-orange-400' :
                        op.status === 'ingepland' ? 'bg-blue-400' : 'bg-gray-300'
                      }`} />

                      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden hover:border-gray-300 transition-colors">
                        {/* Opdracht header */}
                        <div className="flex items-center gap-3 px-4 py-3 bg-gray-50/60 border-b border-gray-100">
                          <span className={`px-2 py-0.5 rounded text-xs font-semibold ${typeKleur[op.type] ?? 'bg-gray-100 text-gray-600'}`}>
                            {typeLabels[op.type] ?? op.type}
                          </span>
                          {op.urgent && (
                            <span className="flex items-center gap-1 px-2 py-0.5 bg-red-100 text-red-700 rounded text-[10px] font-bold uppercase tracking-wide">
                              <AlertTriangle className="w-3 h-3" />Spoed
                            </span>
                          )}
                          <span className="font-mono text-xs text-gray-400">{op.id}</span>
                          <span className={`ml-auto px-2 py-0.5 rounded-full text-xs font-semibold ${statusKleur[op.status] ?? 'bg-gray-100 text-gray-600'}`}>
                            {op.status}
                          </span>
                        </div>

                        {/* Opdracht body */}
                        <div className="px-4 py-3 space-y-3">
                          {/* Meta rij */}
                          <div className="flex flex-wrap gap-4 text-xs text-gray-500">
                            <span className="flex items-center gap-1.5">
                              <Calendar className="w-3.5 h-3.5 text-gray-400" />
                              {fmtD(op.datum) ?? <span className="italic text-gray-300">Niet ingepland</span>}
                            </span>
                            <span className="flex items-center gap-1.5">
                              <User className="w-3.5 h-3.5 text-gray-400" />
                              {op.monteur_id ? (monteurMap[op.monteur_id] ?? op.monteur_id) : <span className="italic text-gray-300">Niet toegewezen</span>}
                            </span>
                            {op.km_gereden != null && (
                              <span className="text-gray-500 font-medium">{op.km_gereden} km gereden</span>
                            )}
                          </div>

                          {/* Voertuigen */}
                          {kentekens.length > 0 && (
                            <div className="flex flex-wrap gap-1.5">
                              {kentekens.map((k) => (
                                <span key={k} className="px-2 py-0.5 bg-gray-100 rounded text-[11px] font-mono font-semibold text-gray-700">{k}</span>
                              ))}
                            </div>
                          )}

                          {/* Notitie */}
                          {op.notitie && op.notitie.trim() && (
                            <p className="text-sm text-gray-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2 whitespace-pre-wrap leading-relaxed">
                              {op.notitie}
                            </p>
                          )}

                          {/* Onderdelen */}
                          {oos.length > 0 && (
                            <div className="border border-gray-100 rounded-lg overflow-hidden">
                              <table className="w-full text-xs">
                                <thead>
                                  <tr className="bg-gray-50 border-b border-gray-100">
                                    <th className="px-3 py-1.5 text-left font-semibold text-gray-500">Onderdeel</th>
                                    <th className="px-3 py-1.5 text-center font-semibold text-gray-500">Aantal</th>
                                    <th className="px-3 py-1.5 text-right font-semibold text-gray-500">Stukprijs</th>
                                    <th className="px-3 py-1.5 text-right font-semibold text-gray-500">Totaal</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50">
                                  {oos.map((oo, i) => {
                                    const prijs = oo.onderdelen?.prijs ?? null;
                                    const aantal = oo.aantal ?? 1;
                                    return (
                                      <tr key={i}>
                                        <td className="px-3 py-2 font-medium text-gray-800">{oo.onderdelen?.naam ?? '—'}</td>
                                        <td className="px-3 py-2 text-center text-gray-600">{aantal}×</td>
                                        <td className="px-3 py-2 text-right text-gray-500">{prijs != null ? `€ ${prijs.toFixed(2)}` : '—'}</td>
                                        <td className="px-3 py-2 text-right font-semibold text-gray-800">{prijs != null ? `€ ${(prijs * aantal).toFixed(2)}` : '—'}</td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                                {heeftOpKosten && (
                                  <tfoot>
                                    <tr className="border-t border-gray-200 bg-gray-50">
                                      <td colSpan={3} className="px-3 py-1.5 font-bold text-gray-700">Subtotaal</td>
                                      <td className="px-3 py-1.5 text-right font-black text-primary">€ {opKosten.toFixed(2)}</td>
                                    </tr>
                                  </tfoot>
                                )}
                              </table>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-gray-100 bg-gray-50/60 flex justify-end">
          <button onClick={onClose} className="px-5 py-2 bg-white border border-gray-200 text-gray-700 text-sm font-medium rounded-xl hover:bg-gray-50 transition-colors">
            Sluiten
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Enkel opdracht detail modal ───────────────────────────── */
function OpdrachDetailModal({ opdracht, monteurMap, onderdelen, laden, onClose }: {
  opdracht: Opdracht;
  monteurMap: Record<string, string>;
  onderdelen: any[];
  laden: boolean;
  onClose: () => void;
}) {
  const fmtD = (d: string | null) => d
    ? new Date(d + (d.length === 10 ? 'T12:00:00' : '')).toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' })
    : null;

  const totaalKosten = onderdelen.reduce((sum, oo) => {
    const prijs = (oo.onderdelen as any)?.prijs ?? null;
    return prijs != null ? sum + prijs * (oo.aantal ?? 1) : sum;
  }, 0);
  const heeftKosten = onderdelen.some((oo) => (oo.onderdelen as any)?.prijs != null);
  const kentekens = opdracht.voertuigen?.map((v) => v.kenteken) ?? [];

  const typeLabels: Record<string, string> = {
    onderhoud: 'Onderhoud', reparatie: 'Reparatie', accu: 'Accu',
    plaatsen: 'Plaatsen', terughalen: 'Terughalen', evaluatie: 'Evaluatie',
    voertuigruil: 'Voertuigruil', pechhulp: 'Pechhulp',
  };

  const statusKleur: Record<string, string> = {
    nieuw: 'bg-yellow-50 text-yellow-700', ingepland: 'bg-blue-50 text-blue-700',
    onderweg: 'bg-indigo-50 text-indigo-700', uitgevoerd: 'bg-orange-50 text-orange-700',
    akkoord: 'bg-teal-50 text-teal-700', afgerond: 'bg-green-50 text-green-700',
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
        <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-100">
          <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
            <Wrench className="w-4 h-4 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-gray-900 text-sm">
              {typeLabels[opdracht.type] ?? opdracht.type}
              {opdracht.urgent && <span className="ml-2 px-1.5 py-0.5 bg-red-100 text-red-700 text-[10px] font-bold rounded uppercase tracking-wide">Spoed</span>}
            </p>
            <p className="text-xs text-gray-400">{opdracht.locatie} · <span className="font-mono">{opdracht.id}</span></p>
          </div>
          <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${statusKleur[opdracht.status] ?? 'bg-gray-100 text-gray-600'}`}>
            {opdracht.status}
          </span>
          <button onClick={onClose} className="ml-2 p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="overflow-y-auto flex-1 px-6 py-5 space-y-5">
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: 'Aangemaakt', waarde: fmtD(opdracht.created_at) },
              { label: 'Gepland op', waarde: fmtD(opdracht.datum) ?? 'Niet ingepland' },
            ].map((item) => (
              <div key={item.label} className="bg-gray-50 rounded-xl p-3">
                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-0.5">{item.label}</p>
                <p className="text-sm font-semibold text-gray-800">{item.waarde}</p>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <DetailRij label="Monteur">
              {opdracht.monteur_id ? (monteurMap[opdracht.monteur_id] ?? opdracht.monteur_id) : <span className="text-gray-400 italic">Niet toegewezen</span>}
            </DetailRij>
            <DetailRij label="Locatie">{opdracht.locatie || '—'}</DetailRij>
            {opdracht.deadline && <DetailRij label="Deadline">{fmtD(opdracht.deadline)}</DetailRij>}
            {opdracht.km_gereden != null && <DetailRij label="Gereden">{opdracht.km_gereden} km</DetailRij>}
          </div>
          {kentekens.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Voertuigen</p>
              <div className="flex flex-wrap gap-1.5">
                {kentekens.map((k) => (
                  <span key={k} className="px-2.5 py-1 bg-gray-100 rounded-lg text-xs font-mono font-semibold text-gray-700">{k}</span>
                ))}
              </div>
            </div>
          )}
          {opdracht.notitie && (
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Notitie</p>
              <p className="text-sm text-gray-700 bg-amber-50 border border-amber-100 rounded-xl p-3 whitespace-pre-wrap">{opdracht.notitie}</p>
            </div>
          )}
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Gebruikte onderdelen</p>
            {laden ? (
              <p className="text-sm text-gray-400">Laden...</p>
            ) : onderdelen.length === 0 ? (
              <p className="text-sm text-gray-400 italic">Geen onderdelen geregistreerd.</p>
            ) : (
              <div className="border border-gray-100 rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-100">
                      <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500">Onderdeel</th>
                      <th className="px-3 py-2 text-center text-xs font-semibold text-gray-500">Aantal</th>
                      <th className="px-3 py-2 text-right text-xs font-semibold text-gray-500">Stukprijs</th>
                      <th className="px-3 py-2 text-right text-xs font-semibold text-gray-500">Totaal</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {onderdelen.map((oo, i) => {
                      const prijs = (oo.onderdelen as any)?.prijs ?? null;
                      const aantal = oo.aantal ?? 1;
                      return (
                        <tr key={i}>
                          <td className="px-3 py-2.5 font-medium text-gray-800">{(oo.onderdelen as any)?.naam ?? '—'}</td>
                          <td className="px-3 py-2.5 text-center text-gray-600">{aantal}×</td>
                          <td className="px-3 py-2.5 text-right text-gray-500">{prijs != null ? `€ ${prijs.toFixed(2)}` : '—'}</td>
                          <td className="px-3 py-2.5 text-right font-semibold text-gray-800">{prijs != null ? `€ ${(prijs * aantal).toFixed(2)}` : '—'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                  {heeftKosten && (
                    <tfoot>
                      <tr className="border-t border-gray-200 bg-gray-50">
                        <td colSpan={3} className="px-3 py-2.5 text-sm font-bold text-gray-700">Totaal materiaal</td>
                        <td className="px-3 py-2.5 text-right font-black text-primary">€ {totaalKosten.toFixed(2)}</td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            )}
          </div>
        </div>
        <div className="px-6 py-4 border-t border-gray-100 bg-gray-50/60 flex justify-end">
          <button onClick={onClose} className="px-5 py-2 bg-white border border-gray-200 text-gray-700 text-sm font-medium rounded-xl hover:bg-gray-50 transition-colors">
            Sluiten
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Helpers ───────────────────────────────────────────────── */
function StatusPill({ label, actief, onClick, kleur }: { label: string; actief: boolean; onClick: () => void; kleur?: string }) {
  return (
    <button onClick={onClick}
      className={`px-3 py-1 rounded-full text-xs font-semibold border transition-all ${
        actief ? (kleur ?? 'bg-primary text-white border-primary') : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300'
      }`}>
      {label}
    </button>
  );
}

function SelectFilter({ value, onChange, placeholder, children }: {
  value: string; onChange: (v: string) => void; placeholder: string; children: React.ReactNode;
}) {
  return (
    <div className="relative">
      <select value={value} onChange={(e) => onChange(e.target.value)}
        className="appearance-none pl-3 pr-8 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 text-gray-700">
        <option value="alle">{placeholder}</option>
        {children}
      </select>
      <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
    </div>
  );
}

function DetailRij({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs text-gray-400 mb-0.5">{label}</p>
      <p className="text-sm font-medium text-gray-800">{children}</p>
    </div>
  );
}
