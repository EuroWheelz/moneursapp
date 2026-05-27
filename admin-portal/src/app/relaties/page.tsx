'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import DashboardLayout from '@/components/DashboardLayout';
import { Plus, Search, ChevronDown, ArrowUpDown, Upload, Bike, AlertTriangle, X, Trash2, RotateCcw, Archive, Battery } from 'lucide-react';
import { supabase, DbRelatie } from '@/lib/supabase';
import ImportLocatiesModal from '@/components/ImportLocatiesModal';
import ImportVlootModal from '@/components/ImportVlootModal';
import ImportAccusModal from '@/components/ImportAccusModal';

const landLabels: Record<string, string> = { NL: 'Nederland', BE: 'België', DE: 'Duitsland', FR: 'Frankrijk' };

export default function RelatiePage() {
  const [relaties, setRelaties] = useState<DbRelatie[]>([]);
  const [verwijderd, setVerwijderd] = useState<DbRelatie[]>([]);
  const [vlootCounts, setVlootCounts] = useState<Map<string, number>>(new Map());
  type AccuBreakdown = { nieuw30: number; nieuw20: number; oud20: number };
  const [accusMap, setAccusMap] = useState<Map<string, AccuBreakdown>>(new Map());
  const [laden, setLaden] = useState(true);
  const [tab, setTab] = useState<'actief' | 'verwijderd'>('actief');
  const [zoek, setZoek] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [landFilter, setLandFilter] = useState('');
  const [showImportModal, setShowImportModal] = useState(false);
  const [showVlootModal, setShowVlootModal] = useState(false);
  const [showAccusModal, setShowAccusModal] = useState(false);
  const [showNieuwModal, setShowNieuwModal] = useState(false);
  const [verwijderRelatie, setVerwijderRelatie] = useState<DbRelatie | null>(null);
  const [definitiefRelatie, setDefinitiefRelatie] = useState<DbRelatie | null>(null);

  useEffect(() => {
    laadAlles();
    const channel = supabase
      .channel(`relaties-vloot-${Date.now()}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'voertuigen' }, laadVlootCounts)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function laadAlles() {
    setLaden(true);
    const [{ data: actief }, { data: del }] = await Promise.all([
      supabase.from('relaties').select('*').is('deleted_at', null).order('naam', { ascending: true }),
      supabase.from('relaties').select('*').not('deleted_at', 'is', null).order('deleted_at', { ascending: false }),
    ]);
    setRelaties(actief ?? []);
    setVerwijderd(del ?? []);
    setLaden(false);
    await Promise.all([laadVlootCounts(), laadAccusCounts()]);
  }

  async function laadAccusCounts() {
    const { data } = await supabase.from('accu_inventaris').select('relatie_id, type, aantal');
    if (!data) return;
    const map = new Map<string, AccuBreakdown>();
    for (const row of data as { relatie_id: string; type: string; aantal: number }[]) {
      const b = map.get(row.relatie_id) ?? { nieuw30: 0, nieuw20: 0, oud20: 0 };
      if (row.type === 'Nieuw 30Ah') b.nieuw30 += row.aantal;
      else if (row.type === 'Nieuw 20Ah') b.nieuw20 += row.aantal;
      else if (row.type === 'Oud 20Ah') b.oud20 += row.aantal;
      map.set(row.relatie_id, b);
    }
    setAccusMap(map);
  }

  async function laadVlootCounts() {
    const PAGE = 1000;
    let all: { relatie_id: string }[] = [];
    let from = 0;
    while (true) {
      const { data } = await supabase
        .from('voertuigen')
        .select('relatie_id')
        .not('relatie_id', 'is', null)
        .range(from, from + PAGE - 1);
      if (!data || data.length === 0) break;
      all = [...all, ...data];
      if (data.length < PAGE) break;
      from += PAGE;
    }
    const counts = new Map<string, number>();
    for (const v of all) {
      if (v.relatie_id) counts.set(v.relatie_id, (counts.get(v.relatie_id) ?? 0) + 1);
    }
    setVlootCounts(counts);
  }

  async function herstel(r: DbRelatie) {
    await supabase.from('relaties').update({ deleted_at: null }).eq('id', r.id);
    laadAlles();
  }

  const gefilterd = relaties.filter((r) => {
    const zoekMatch =
      !zoek ||
      r.naam.toLowerCase().includes(zoek.toLowerCase()) ||
      (r.crediteurnummer ?? '').toLowerCase().includes(zoek.toLowerCase());
    const typeMatch = !typeFilter || r.type === typeFilter;
    const statusMatch = !statusFilter || r.status === statusFilter;
    const landMatch = !landFilter || r.land === landFilter;
    return zoekMatch && typeMatch && statusMatch && landMatch;
  });

  const verwijderdGefilterd = verwijderd.filter((r) =>
    !zoek ||
    r.naam.toLowerCase().includes(zoek.toLowerCase()) ||
    (r.crediteurnummer ?? '').toLowerCase().includes(zoek.toLowerCase()),
  );

  return (
    <DashboardLayout
      title="Relaties"
      actions={
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowAccusModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-white text-gray-700 border border-gray-200 rounded-lg text-sm font-semibold shadow-sm hover:bg-gray-50 active:scale-95 transition-all"
          >
            <Battery className="w-4 h-4 text-gray-400" />
            Accu&apos;s importeren
          </button>
          <button
            onClick={() => setShowVlootModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-white text-gray-700 border border-gray-200 rounded-lg text-sm font-semibold shadow-sm hover:bg-gray-50 active:scale-95 transition-all"
          >
            <Bike className="w-4 h-4 text-gray-400" />
            Vloot importeren
          </button>
          <button
            onClick={() => setShowImportModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-white text-gray-700 border border-gray-200 rounded-lg text-sm font-semibold shadow-sm hover:bg-gray-50 active:scale-95 transition-all"
          >
            <Upload className="w-4 h-4 text-gray-400" />
            Locaties importeren
          </button>
          <button
            onClick={() => setShowNieuwModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-[#F3A713] text-[#1A1A1A] rounded-lg text-sm font-semibold shadow-sm hover:bg-[#D4900E] active:scale-95 transition-all">
            <Plus className="w-4 h-4" />
            Nieuwe relatie
          </button>
        </div>
      }
    >
      {/* Tab switcher */}
      <div className="flex gap-1 border-b border-gray-200 mb-4">
        <button
          onClick={() => setTab('actief')}
          className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors
            ${tab === 'actief' ? 'border-primary text-primary' : 'border-transparent text-gray-500 hover:text-gray-800'}`}
        >
          Relaties
          <span className="ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-gray-100 text-gray-500">
            {relaties.length}
          </span>
        </button>
        <button
          onClick={() => setTab('verwijderd')}
          className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors
            ${tab === 'verwijderd' ? 'border-red-500 text-red-600' : 'border-transparent text-gray-500 hover:text-gray-800'}`}
        >
          <Archive className="w-3.5 h-3.5" />
          Verwijderd
          {verwijderd.length > 0 && (
            <span className="ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-600">
              {verwijderd.length}
            </span>
          )}
        </button>
      </div>

      {tab === 'actief' ? (
        <>
          {/* Filters */}
          <div className="flex flex-wrap gap-3 mb-4">
            <div className="relative flex-1 min-w-48">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Zoek op naam of crediteurnummer..."
                className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                value={zoek}
                onChange={(e) => setZoek(e.target.value)}
              />
            </div>
            <FilterSelect value={typeFilter} onChange={setTypeFilter} options={[{ value: '', label: 'Alle types' }, { value: 'consignatie', label: 'Consignatie' }, { value: 'klant', label: 'Klant' }]} />
            <FilterSelect value={statusFilter} onChange={setStatusFilter} options={[{ value: '', label: 'Alle statussen' }, { value: 'actief', label: 'Actief' }, { value: 'inactief', label: 'Inactief' }]} />
            <FilterSelect value={landFilter} onChange={setLandFilter} options={[{ value: '', label: 'Alle landen' }, { value: 'NL', label: 'Nederland' }, { value: 'BE', label: 'België' }, { value: 'DE', label: 'Duitsland' }, { value: 'FR', label: 'Frankrijk' }]} />
          </div>

          {/* Tabel */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            {laden ? (
              <div className="py-16 text-center text-sm text-gray-400">Laden...</div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50/60">
                    <Th>Crediteurnummer</Th>
                    <Th>Naam</Th>
                    <Th className="text-center">E-choppers</Th>
                    <Th>Accu&apos;s</Th>
                    <Th>Land</Th>
                    <Th>Status</Th>
                    <Th>Adres</Th>
                    <th className="px-4 py-2.5 w-10" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {gefilterd.length === 0 && (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-gray-400 text-sm">
                        {relaties.length === 0 ? 'Nog geen relaties — importeer ze via Bulk Import.' : 'Geen relaties gevonden'}
                      </td>
                    </tr>
                  )}
                  {gefilterd.map((r) => (
                    <tr key={r.id} className="hover:bg-gray-50/60 cursor-pointer transition-colors group">
                      <td className="px-4 py-3 font-mono text-xs text-gray-500">{r.crediteurnummer ?? '—'}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Link href={`/relaties/${r.id}`} className="font-medium text-gray-900 group-hover:text-primary transition-colors">
                            {r.naam}
                          </Link>
                          <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide
                            ${r.type === 'consignatie' ? 'bg-blue-50 text-blue-600' : 'bg-gray-100 text-gray-500'}`}>
                            {r.type}
                          </span>
                          {r.onvolledig && (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-amber-50 text-amber-600 border border-amber-200 rounded text-[10px] font-semibold">
                              <AlertTriangle className="w-2.5 h-2.5" />
                              Aanvullen vereist
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center text-gray-700">{vlootCounts.get(r.id) ?? r.echopers}</td>
                      <td className="px-4 py-3">
                        {(() => {
                          const b = accusMap.get(r.id);
                          if (!b || (b.nieuw30 + b.nieuw20 + b.oud20 === 0)) return <span className="text-gray-300 text-xs">—</span>;
                          return (
                            <div className="flex flex-wrap gap-1">
                              {b.nieuw30 > 0 && (
                                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-yellow-50 text-yellow-700 border border-yellow-200 rounded text-[10px] font-semibold whitespace-nowrap">
                                  {b.nieuw30}× 30Ah
                                </span>
                              )}
                              {b.nieuw20 > 0 && (
                                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-blue-50 text-blue-700 border border-blue-200 rounded text-[10px] font-semibold whitespace-nowrap">
                                  {b.nieuw20}× 20Ah
                                </span>
                              )}
                              {b.oud20 > 0 && (
                                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-gray-100 text-gray-500 border border-gray-200 rounded text-[10px] font-semibold whitespace-nowrap">
                                  {b.oud20}× 20Ah oud
                                </span>
                              )}
                            </div>
                          );
                        })()}
                      </td>
                      <td className="px-4 py-3 text-gray-600">{landLabels[r.land] ?? r.land}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium
                          ${r.status === 'actief' ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${r.status === 'actief' ? 'bg-green-500' : 'bg-gray-400'}`} />
                          {r.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-xs">{r.adres}, {r.plaats}</td>
                      <td className="px-4 py-3">
                        <button
                          onClick={(e) => { e.stopPropagation(); setVerwijderRelatie(r); }}
                          className="opacity-0 group-hover:opacity-100 p-1.5 rounded hover:bg-red-50 text-gray-300 hover:text-red-500 transition-all"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {!laden && (
              <div className="px-4 py-2.5 border-t border-gray-100 bg-gray-50/40 text-xs text-gray-400">
                {gefilterd.length} van {relaties.length} relaties
              </div>
            )}
          </div>
        </>
      ) : (
        /* ── Verwijderd tab ───────────────────────────────── */
        <>
          <div className="flex flex-wrap gap-3 mb-4">
            <div className="relative flex-1 min-w-48">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Zoek in verwijderde relaties..."
                className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                value={zoek}
                onChange={(e) => setZoek(e.target.value)}
              />
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            {laden ? (
              <div className="py-16 text-center text-sm text-gray-400">Laden...</div>
            ) : verwijderdGefilterd.length === 0 ? (
              <div className="py-16 flex flex-col items-center gap-3 text-gray-400">
                <Archive className="w-10 h-10 opacity-30" />
                <p className="text-sm">Geen verwijderde relaties</p>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50/60">
                    <Th>Naam</Th>
                    <Th>Type</Th>
                    <Th>Adres</Th>
                    <Th>Verwijderd op</Th>
                    <th className="px-4 py-2.5 w-40" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {verwijderdGefilterd.map((r) => (
                    <tr key={r.id} className="hover:bg-gray-50/40 transition-colors group">
                      <td className="px-4 py-3">
                        <p className="font-medium text-gray-500">{r.naam}</p>
                        {r.crediteurnummer && <p className="text-xs font-mono text-gray-400">{r.crediteurnummer}</p>}
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide bg-gray-100 text-gray-400">
                          {r.type}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-400">{r.adres ? `${r.adres}, ${r.plaats}` : '—'}</td>
                      <td className="px-4 py-3 text-xs text-gray-400">
                        {r.deleted_at ? new Date(r.deleted_at).toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' }) : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2 justify-end">
                          <button
                            onClick={() => herstel(r)}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-green-700 bg-green-50 hover:bg-green-100 border border-green-200 transition-colors"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                            Herstellen
                          </button>
                          <button
                            onClick={() => setDefinitiefRelatie(r)}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-red-600 bg-red-50 hover:bg-red-100 border border-red-200 transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            Definitief
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {!laden && verwijderdGefilterd.length > 0 && (
              <div className="px-4 py-2.5 border-t border-gray-100 bg-gray-50/40 text-xs text-gray-400">
                {verwijderdGefilterd.length} verwijderde {verwijderdGefilterd.length === 1 ? 'relatie' : 'relaties'}
              </div>
            )}
          </div>
        </>
      )}

      {showAccusModal && (
        <ImportAccusModal
          onClose={() => setShowAccusModal(false)}
          onSuccess={() => { setShowAccusModal(false); laadAlles(); }}
        />
      )}
      {showImportModal && (
        <ImportLocatiesModal
          onClose={() => setShowImportModal(false)}
          onSuccess={() => { setShowImportModal(false); laadAlles(); }}
        />
      )}
      {showVlootModal && (
        <ImportVlootModal
          onClose={() => setShowVlootModal(false)}
          onSuccess={() => { setShowVlootModal(false); laadAlles(); }}
        />
      )}
      {showNieuwModal && (
        <NieuweRelatieModal
          onClose={() => setShowNieuwModal(false)}
          onSuccess={() => { setShowNieuwModal(false); laadAlles(); }}
        />
      )}
      {verwijderRelatie && (
        <VerwijderRelatieModal
          relatie={verwijderRelatie}
          onClose={() => setVerwijderRelatie(null)}
          onSuccess={() => { setVerwijderRelatie(null); laadAlles(); }}
        />
      )}
      {definitiefRelatie && (
        <DefinitiefVerwijderenModal
          relatie={definitiefRelatie}
          onClose={() => setDefinitiefRelatie(null)}
          onSuccess={() => { setDefinitiefRelatie(null); laadAlles(); }}
        />
      )}
    </DashboardLayout>
  );
}

function Th({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <th className={`px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap ${className}`}>
      <span className="flex items-center gap-1">
        {children}
        <ArrowUpDown className="w-3 h-3 opacity-40" />
      </span>
    </th>
  );
}

function NieuweRelatieModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [naam, setNaam] = useState('');
  const [type, setType] = useState('consignatie');
  const [status, setStatus] = useState('actief');
  const [land, setLand] = useState('NL');
  const [adres, setAdres] = useState('');
  const [postcode, setPostcode] = useState('');
  const [plaats, setPlaats] = useState('');
  const [telefoon, setTelefoon] = useState('');
  const [email, setEmail] = useState('');
  const [contactpersoon, setContactpersoon] = useState('');
  const [bezig, setBezig] = useState(false);
  const [fout, setFout] = useState('');

  async function opslaan() {
    if (!naam.trim()) { setFout('Naam is verplicht.'); return; }
    setFout(''); setBezig(true);
    const { error } = await supabase.from('relaties').insert({
      naam: naam.trim(),
      type,
      status,
      land,
      adres: adres.trim(),
      postcode: postcode.trim(),
      plaats: plaats.trim(),
      telefoon: telefoon.trim(),
      email: email.trim(),
      contactpersoon: contactpersoon.trim(),
      echopers: 0,
      accus: 0,
      onvolledig: !adres.trim() || !postcode.trim() || !plaats.trim(),
    });
    setBezig(false);
    if (error) { setFout(error.message); return; }
    onSuccess();
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col max-h-[92vh]">
        <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-100 flex-shrink-0">
          <div className="flex-1">
            <p className="text-sm font-bold text-gray-900">Nieuwe relatie aanmaken</p>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors">
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Naam *</label>
            <input value={naam} onChange={(e) => setNaam(e.target.value)} placeholder="Bijv. Strandhotel Scheveningen"
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20" autoFocus />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Type</label>
              <select value={type} onChange={(e) => setType(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none appearance-none bg-white">
                <option value="consignatie">Consignatie</option>
                <option value="klant">Klant</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Status</label>
              <select value={status} onChange={(e) => setStatus(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none appearance-none bg-white">
                <option value="actief">Actief</option>
                <option value="inactief">Inactief</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Adres</label>
              <input value={adres} onChange={(e) => setAdres(e.target.value)} placeholder="Straatnaam 1"
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Postcode</label>
              <input value={postcode} onChange={(e) => setPostcode(e.target.value)} placeholder="1234 AB"
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Stad / Plaats</label>
              <input value={plaats} onChange={(e) => setPlaats(e.target.value)} placeholder="Amsterdam"
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Land</label>
              <select value={land} onChange={(e) => setLand(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none appearance-none bg-white">
                <option value="NL">Nederland</option>
                <option value="BE">België</option>
                <option value="DE">Duitsland</option>
                <option value="FR">Frankrijk</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Contactpersoon</label>
              <input value={contactpersoon} onChange={(e) => setContactpersoon(e.target.value)} placeholder="Naam"
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Telefoon</label>
              <input value={telefoon} onChange={(e) => setTelefoon(e.target.value)} placeholder="+31 6 ..."
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">E-mail</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="info@locatie.nl"
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20" />
          </div>
          {fout && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{fout}</p>
          )}
        </div>
        <div className="px-5 pb-5 pt-3 border-t border-gray-100 flex gap-2 flex-shrink-0">
          <button onClick={opslaan} disabled={bezig || !naam.trim()}
            className="flex-1 py-2.5 bg-[#F3A713] text-[#1A1A1A] text-sm font-bold rounded-xl hover:bg-[#D4900E] transition-colors disabled:opacity-60">
            {bezig ? 'Opslaan...' : 'Relatie aanmaken'}
          </button>
          <button onClick={onClose} className="px-4 py-2.5 border border-gray-200 text-gray-600 text-sm font-medium rounded-xl hover:bg-gray-50 transition-colors">
            Annuleer
          </button>
        </div>
      </div>
    </div>
  );
}

function VerwijderRelatieModal({ relatie, onClose, onSuccess }: { relatie: DbRelatie; onClose: () => void; onSuccess: () => void }) {
  const [bezig, setBezig] = useState(false);
  const [fout, setFout] = useState('');

  async function verwijder() {
    setBezig(true);
    setFout('');
    const { error } = await supabase
      .from('relaties')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', relatie.id);
    setBezig(false);
    if (error) { setFout(error.message); return; }
    onSuccess();
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-100">
          <div className="w-9 h-9 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
            <Trash2 className="w-4 h-4 text-red-600" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-bold text-gray-900">Relatie verwijderen</p>
            <p className="text-xs text-gray-500 mt-0.5">{relatie.naam}</p>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors">
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>
        <div className="px-5 py-4 space-y-3">
          <p className="text-sm text-gray-700">
            Weet je zeker dat je <span className="font-semibold">{relatie.naam}</span> wilt verwijderen?
          </p>
          <div className="bg-blue-50 border border-blue-200 rounded-lg px-3 py-2.5 text-xs text-blue-800 flex items-start gap-2">
            <RotateCcw className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
            <span>De relatie wordt naar de prullenbak verplaatst en is terug te vinden via het tabblad <strong>Verwijderd</strong>.</span>
          </div>
          {fout && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{fout}</p>}
        </div>
        <div className="px-5 pb-5 flex gap-2">
          <button
            onClick={verwijder}
            disabled={bezig}
            className="flex-1 py-2.5 bg-red-600 text-white text-sm font-bold rounded-xl hover:bg-red-700 transition-colors disabled:opacity-60"
          >
            {bezig ? 'Verwijderen...' : 'Verwijderen'}
          </button>
          <button onClick={onClose} className="px-4 py-2.5 border border-gray-200 text-gray-600 text-sm font-medium rounded-xl hover:bg-gray-50 transition-colors">
            Annuleer
          </button>
        </div>
      </div>
    </div>
  );
}

function DefinitiefVerwijderenModal({ relatie, onClose, onSuccess }: { relatie: DbRelatie; onClose: () => void; onSuccess: () => void }) {
  const [bezig, setBezig] = useState(false);
  const [fout, setFout] = useState('');
  const [bevestig, setBevestig] = useState('');

  async function verwijder() {
    setBezig(true);
    setFout('');
    await supabase.from('contactpersonen').delete().eq('relatie_id', relatie.id);
    await supabase.from('voertuigen').update({ relatie_id: null }).eq('relatie_id', relatie.id);
    const { error } = await supabase.from('relaties').delete().eq('id', relatie.id);
    setBezig(false);
    if (error) { setFout(error.message); return; }
    onSuccess();
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-100">
          <div className="w-9 h-9 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
            <Trash2 className="w-4 h-4 text-red-600" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-bold text-gray-900">Definitief verwijderen</p>
            <p className="text-xs text-gray-500 mt-0.5">{relatie.naam}</p>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors">
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>
        <div className="px-5 py-4 space-y-3">
          <p className="text-sm text-gray-700">
            Dit verwijdert <span className="font-semibold">{relatie.naam}</span> permanent. Dit kan niet ongedaan worden gemaakt.
          </p>
          <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2.5 text-xs text-red-800 space-y-1">
            <p className="font-semibold">Gevolgen:</p>
            <ul className="list-disc list-inside space-y-0.5 text-red-700">
              <li>Alle contactpersonen worden verwijderd</li>
              <li>Gekoppelde voertuigen worden losgekoppeld</li>
            </ul>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">
              Typ <span className="font-mono font-bold text-gray-700">{relatie.naam}</span> ter bevestiging
            </label>
            <input
              value={bevestig}
              onChange={(e) => setBevestig(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-400"
              placeholder={relatie.naam}
            />
          </div>
          {fout && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{fout}</p>}
        </div>
        <div className="px-5 pb-5 flex gap-2">
          <button
            onClick={verwijder}
            disabled={bezig || bevestig !== relatie.naam}
            className="flex-1 py-2.5 bg-red-600 text-white text-sm font-bold rounded-xl hover:bg-red-700 transition-colors disabled:opacity-40"
          >
            {bezig ? 'Verwijderen...' : 'Definitief verwijderen'}
          </button>
          <button onClick={onClose} className="px-4 py-2.5 border border-gray-200 text-gray-600 text-sm font-medium rounded-xl hover:bg-gray-50 transition-colors">
            Annuleer
          </button>
        </div>
      </div>
    </div>
  );
}

function FilterSelect({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: { value: string; label: string }[] }) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="appearance-none pl-3 pr-8 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-gray-700"
      >
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
    </div>
  );
}
