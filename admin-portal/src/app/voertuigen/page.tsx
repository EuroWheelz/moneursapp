'use client';

import { useState, useEffect, useMemo } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import {
  Plus, Search, ChevronDown, ChevronRight, Bike, Upload,
  AlertCircle, MapPin, RefreshCw, X, ArrowRight,
} from 'lucide-react';
import { supabase, DbVoertuig } from '@/lib/supabase';
import ImportVlootModal from '@/components/ImportVlootModal';
import HerlinkVlootModal from '@/components/HerlinkVlootModal';
import VoertuigVerledenModal from '@/components/VoertuigVerledenModal';

const statusKleur: Record<string, string> = {
  Operationeel: 'bg-green-50 text-green-700',
  'Reparatie op locatie': 'bg-orange-50 text-orange-700',
  'Reparatie in loods': 'bg-red-50 text-red-700',
  'In loods': 'bg-gray-100 text-gray-600',
};

type RelatieInfo = { naam: string; crediteurnummer: string | null; plaats: string; land: string };

type LocatieGroep = {
  relatieId: string;
  info: RelatieInfo;
  voertuigen: (DbVoertuig & { relaties?: RelatieInfo })[];
};

export default function VoertuigenPage() {
  const [alleVoertuigen, setAlleVoertuigen] = useState<(DbVoertuig & { relaties?: RelatieInfo })[]>([]);
  const [laden, setLaden] = useState(true);
  const [zoek, setZoek] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [actiefFilter, setActiefFilter] = useState('');
  const [zonderLocatieActief, setZonderLocatieActief] = useState(false);
  const [uitgeklapt, setUitgeklapt] = useState<Set<string>>(new Set());
  const [showImport, setShowImport] = useState(false);
  const [showHerlink, setShowHerlink] = useState(false);
  const [showToevoegen, setShowToevoegen] = useState(false);
  const [verledenKenteken, setVerledenKenteken] = useState<string | null>(null);

  useEffect(() => { laadAlles(); }, []);

  async function laadAlles() {
    setLaden(true);
    const PAGE = 1000;
    let all: (DbVoertuig & { relaties?: RelatieInfo })[] = [];
    let from = 0;
    while (true) {
      const { data, error } = await supabase
        .from('voertuigen')
        .select('*, relaties(naam, crediteurnummer, plaats, land)')
        .is('opdracht_id', null)
        .order('kenteken', { ascending: true })
        .range(from, from + PAGE - 1);
      if (error || !data || data.length === 0) break;
      all = [...all, ...(data as (DbVoertuig & { relaties?: RelatieInfo })[])];
      if (data.length < PAGE) break;
      from += PAGE;
    }
    setAlleVoertuigen(all);
    setLaden(false);
  }

  const { groepen, zonderLocatie } = useMemo(() => {
    let filtered = alleVoertuigen;

    if (statusFilter) filtered = filtered.filter((v) => v.object_status === statusFilter);
    if (actiefFilter) filtered = filtered.filter((v) => v.actief === (actiefFilter === 'ja'));

    const zoekLow = zoek.toLowerCase();
    if (zoekLow) {
      filtered = filtered.filter((v) => {
        const r = v.relaties;
        return (
          v.kenteken?.toLowerCase().includes(zoekLow) ||
          v.model?.toLowerCase().includes(zoekLow) ||
          v.meldcode?.toLowerCase().includes(zoekLow) ||
          v.barcode?.toLowerCase().includes(zoekLow) ||
          v.uitvoering?.toLowerCase().includes(zoekLow) ||
          r?.naam?.toLowerCase().includes(zoekLow) ||
          r?.crediteurnummer?.toLowerCase().includes(zoekLow) ||
          r?.plaats?.toLowerCase().includes(zoekLow)
        );
      });
    }

    const zonderLocatie = filtered.filter((v) => !v.relatie_id);
    const metLocatie = filtered.filter((v) => !!v.relatie_id);

    const map = new Map<string, LocatieGroep>();
    for (const v of metLocatie) {
      const rid = v.relatie_id!;
      if (!map.has(rid)) {
        map.set(rid, {
          relatieId: rid,
          info: v.relaties ?? { naam: 'Onbekend', crediteurnummer: null, plaats: '', land: '' },
          voertuigen: [],
        });
      }
      map.get(rid)!.voertuigen.push(v);
    }

    const groepen = Array.from(map.values()).sort((a, b) =>
      a.info.naam.localeCompare(b.info.naam)
    );
    return { groepen, zonderLocatie };
  }, [alleVoertuigen, zoek, statusFilter, actiefFilter]);

  // Auto-expand all matching groups when searching
  useEffect(() => {
    if (zoek) setUitgeklapt(new Set([...groepen.map((g) => g.relatieId), '__zonder__']));
  }, [zoek]); // eslint-disable-line react-hooks/exhaustive-deps

  function toggleUitgeklapt(id: string) {
    setUitgeklapt((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function allesUitklappen() { setUitgeklapt(new Set([...groepen.map((g) => g.relatieId), '__zonder__'])); }
  function allesInklappen() { setUitgeklapt(new Set()); }

  const totaalVoertuigen = alleVoertuigen.length;
  const actiefTotaal = alleVoertuigen.filter((v) => v.actief).length;
  const zonderLocatieCount = alleVoertuigen.filter((v) => !v.relatie_id).length;

  const zichtbareGroepen = zonderLocatieActief ? [] : groepen;
  const toonZonder = zonderLocatieActief || (zoek && zonderLocatie.length > 0);

  return (
    <DashboardLayout
      title="Voertuigen"
      actions={
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowImport(true)}
            className="flex items-center gap-2 px-4 py-2 bg-white text-gray-700 border border-gray-200 rounded-lg text-sm font-semibold shadow-sm hover:bg-gray-50 active:scale-95 transition-all"
          >
            <Upload className="w-4 h-4 text-gray-400" />
            Vloot importeren
          </button>
          <button
            onClick={() => setShowHerlink(true)}
            className="flex items-center gap-2 px-4 py-2 bg-white text-gray-700 border border-gray-200 rounded-lg text-sm font-semibold shadow-sm hover:bg-gray-50 active:scale-95 transition-all"
          >
            <RefreshCw className="w-4 h-4 text-gray-400" />
            Herlinken
          </button>
          <button
            onClick={() => setShowToevoegen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-[#F3A713] text-[#1A1A1A] rounded-lg text-sm font-semibold shadow-sm hover:bg-[#D4900E] active:scale-95 transition-all">
            <Plus className="w-4 h-4" />
            Voertuig toevoegen
          </button>
        </div>
      }
    >
      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        <StatKaart label="Totaal vloot" waarde={totaalVoertuigen} sub={`${groepen.length} locaties`} kleur="bg-gray-50 text-gray-600" icon={<Bike className="w-4 h-4" />} />
        <StatKaart label="Actief" waarde={actiefTotaal} sub={`${totaalVoertuigen - actiefTotaal} inactief`} kleur="bg-green-50 text-green-700" icon={<Bike className="w-4 h-4" />} />
        <StatKaart label="Zonder locatie" waarde={zonderLocatieCount} sub="niet gekoppeld" kleur={zonderLocatieCount > 0 ? 'bg-amber-50 text-amber-700' : 'bg-gray-50 text-gray-400'} icon={<AlertCircle className="w-4 h-4" />} />
        <StatKaart label="Locaties" waarde={groepen.length} sub="met vloot" kleur="bg-blue-50 text-blue-700" icon={<MapPin className="w-4 h-4" />} />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-4">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Zoek kenteken, locatie, meldcode, model..."
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            value={zoek}
            onChange={(e) => setZoek(e.target.value)}
          />
        </div>

        <FilterSelect value={statusFilter} onChange={setStatusFilter} options={[
          { value: '', label: 'Alle statussen' },
          { value: 'Operationeel', label: 'Operationeel' },
          { value: 'Reparatie op locatie', label: 'Reparatie op locatie' },
          { value: 'Reparatie in loods', label: 'Reparatie in loods' },
          { value: 'In loods', label: 'In loods' },
        ]} />

        <FilterSelect value={actiefFilter} onChange={setActiefFilter} options={[
          { value: '', label: 'Actief & inactief' },
          { value: 'ja', label: 'Alleen actief' },
          { value: 'nee', label: 'Alleen inactief' },
        ]} />

        <button
          onClick={() => setZonderLocatieActief((p) => !p)}
          className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold border transition-colors ${
            zonderLocatieActief
              ? 'bg-amber-50 border-amber-300 text-amber-700'
              : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
          }`}
        >
          <AlertCircle className="w-4 h-4" />
          Zonder locatie
          {zonderLocatieCount > 0 && (
            <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${zonderLocatieActief ? 'bg-amber-200 text-amber-800' : 'bg-gray-100 text-gray-600'}`}>
              {zonderLocatieCount}
            </span>
          )}
        </button>

        <div className="flex items-center gap-1 ml-auto">
          <button onClick={allesUitklappen} className="px-3 py-2 text-xs text-gray-500 hover:text-gray-700 hover:bg-gray-50 rounded-lg border border-gray-200 transition-colors">
            Alles uitklappen
          </button>
          <button onClick={allesInklappen} className="px-3 py-2 text-xs text-gray-500 hover:text-gray-700 hover:bg-gray-50 rounded-lg border border-gray-200 transition-colors">
            Alles inklappen
          </button>
        </div>
      </div>

      {/* Groepen */}
      {laden ? (
        <div className="bg-white rounded-xl border border-gray-200 py-16 text-center text-sm text-gray-400">
          Vloot laden...
        </div>
      ) : (
        <div className="space-y-2">
          {/* Zonder locatie groep */}
          {toonZonder && zonderLocatie.length > 0 && (
            <GroepRij
              id="__zonder__"
              icon={<AlertCircle className="w-4 h-4 text-amber-500" />}
              naam="Zonder locatie"
              crediteurnummer={null}
              plaats=""
              voertuigen={zonderLocatie}
              isOpen={uitgeklapt.has('__zonder__')}
              onToggle={() => toggleUitgeklapt('__zonder__')}
              accentKleur="border-amber-200 bg-amber-50/40"
              onVerledenClick={setVerledenKenteken}
              onVerplaatst={laadAlles}
            />
          )}

          {/* Locatie groepen */}
          {zichtbareGroepen.map((g) => (
            <GroepRij
              key={g.relatieId}
              id={g.relatieId}
              icon={<MapPin className="w-4 h-4 text-primary" />}
              naam={g.info.naam}
              crediteurnummer={g.info.crediteurnummer}
              plaats={g.info.plaats}
              voertuigen={g.voertuigen}
              isOpen={uitgeklapt.has(g.relatieId)}
              onToggle={() => toggleUitgeklapt(g.relatieId)}
              onVerledenClick={setVerledenKenteken}
              onVerplaatst={laadAlles}
            />
          ))}

          {zichtbareGroepen.length === 0 && !toonZonder && (
            <div className="bg-white rounded-xl border border-gray-200 py-16 text-center text-sm text-gray-400">
              {zoek || statusFilter || actiefFilter
                ? 'Geen voertuigen gevonden met deze filters.'
                : 'Nog geen voertuigen — importeer via "Vloot importeren".'}
            </div>
          )}
        </div>
      )}

      {showImport && (
        <ImportVlootModal
          onClose={() => setShowImport(false)}
          onSuccess={() => { setShowImport(false); laadAlles(); }}
        />
      )}
      {showHerlink && (
        <HerlinkVlootModal
          onClose={() => setShowHerlink(false)}
          onSuccess={() => { setShowHerlink(false); laadAlles(); }}
        />
      )}
      {showToevoegen && (
        <NieuwVoertuigModal
          onClose={() => setShowToevoegen(false)}
          onSuccess={() => { setShowToevoegen(false); laadAlles(); }}
        />
      )}
      {verledenKenteken && (
        <VoertuigVerledenModal
          kenteken={verledenKenteken}
          onClose={() => setVerledenKenteken(null)}
        />
      )}
    </DashboardLayout>
  );
}

/* ─── GroepRij ──────────────────────────────────────────────────────── */

type GroepRijProps = {
  id: string;
  icon: React.ReactNode;
  naam: string;
  crediteurnummer: string | null;
  plaats: string;
  voertuigen: (DbVoertuig & { relaties?: any })[];
  onVerledenClick?: (kenteken: string) => void;
  onVerplaatst: () => void;
  isOpen: boolean;
  onToggle: () => void;
  accentKleur?: string;
};

function GroepRij({ icon, naam, crediteurnummer, plaats, voertuigen, isOpen, onToggle, accentKleur, onVerledenClick, onVerplaatst }: GroepRijProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showVerplaats, setShowVerplaats] = useState(false);
  const actiefCount = voertuigen.filter((v) => v.actief).length;

  useEffect(() => { if (!isOpen) setSelectedIds(new Set()); }, [isOpen]);

  const allSelected = voertuigen.length > 0 && selectedIds.size === voertuigen.length;
  const someSelected = selectedIds.size > 0 && !allSelected;

  function toggleSelectAll() {
    setSelectedIds(allSelected ? new Set() : new Set(voertuigen.map((v) => v.id)));
  }

  function toggleSelect(vid: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(vid)) next.delete(vid); else next.add(vid);
      return next;
    });
  }

  const selectedVoertuigen = voertuigen.filter((v) => selectedIds.has(v.id));

  return (
    <div className={`bg-white rounded-xl border border-gray-200 overflow-hidden ${accentKleur ?? ''}`}>
      {/* Header */}
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50/60 transition-colors text-left"
      >
        <span className="text-gray-300 flex-shrink-0">
          {isOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </span>
        <span className="flex-shrink-0">{icon}</span>

        <div className="flex-1 min-w-0">
          <span className="font-semibold text-gray-800 text-sm">{naam}</span>
          {crediteurnummer && (
            <span className="ml-2 font-mono text-xs text-gray-400">{crediteurnummer}</span>
          )}
          {plaats && <span className="ml-2 text-xs text-gray-400">{plaats}</span>}
        </div>

        <div className="flex items-center gap-3 flex-shrink-0">
          <span className="text-xs text-gray-400">
            {actiefCount} actief
          </span>
          <span className="px-2.5 py-0.5 bg-gray-100 rounded-full text-xs font-bold text-gray-600">
            {voertuigen.length}
          </span>
        </div>
      </button>

      {/* Tabel */}
      {isOpen && (
        <div className="border-t border-gray-100">
          <table className="w-full">
            <thead className="bg-gray-50/70">
              <tr>
                <th className="px-3 py-2 w-8">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    ref={(el) => { if (el) el.indeterminate = someSelected; }}
                    onChange={toggleSelectAll}
                    className="rounded border-gray-300 cursor-pointer"
                  />
                </th>
                {['Kenteken', 'Model / Uitvoering', 'Kleur', 'Barcode / Meldcode', 'Objectstatus', 'Actief'].map((h) => (
                  <th key={h} className="px-3 py-2 text-left text-[10px] font-semibold text-gray-400 uppercase tracking-wider whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {voertuigen.map((v) => (
                <tr key={v.id} className={`hover:bg-gray-50/60 transition-colors ${selectedIds.has(v.id) ? 'bg-blue-50/40' : ''}`}>
                  <td className="px-3 py-2 w-8">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(v.id)}
                      onChange={() => toggleSelect(v.id)}
                      className="rounded border-gray-300 cursor-pointer"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <button
                      onClick={() => onVerledenClick?.(v.kenteken)}
                      className="font-mono font-semibold text-primary text-xs hover:underline text-left"
                      title="Voertuigverleden bekijken"
                    >
                      {v.kenteken}
                    </button>
                    {v.tenaamstelling && <p className="text-[10px] text-gray-400">{v.tenaamstelling}</p>}
                  </td>
                  <td className="px-3 py-2 text-xs text-gray-600">
                    {v.model || <span className="text-gray-300">—</span>}
                    {v.uitvoering && <p className="text-[10px] text-gray-400">{v.uitvoering}</p>}
                  </td>
                  <td className="px-3 py-2">
                    {v.kleur ? (
                      <span className="w-5 h-5 rounded-full border border-black/10 inline-block flex-shrink-0" style={{ backgroundColor: v.kleur }} title={v.kleur} />
                    ) : (
                      <span className="w-5 h-5 rounded-full border border-dashed border-gray-300 inline-block flex-shrink-0" title="Geen kleur" />
                    )}
                  </td>
                  <td className="px-3 py-2 font-mono text-[11px]">
                    <span className="text-gray-400">{v.barcode || <span className="text-gray-200">—</span>}</span>
                    {v.meldcode && <p className="text-primary font-bold">{v.meldcode}</p>}
                  </td>
                  <td className="px-3 py-2">
                    <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${statusKleur[v.object_status] ?? 'bg-gray-100 text-gray-600'}`}>
                      {v.object_status || 'Onbekend'}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <span className={`inline-block w-2 h-2 rounded-full ${v.actief ? 'bg-green-500' : 'bg-gray-300'}`} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {selectedIds.size > 0 && (
            <div className="flex items-center justify-between px-4 py-2.5 bg-blue-50 border-t border-blue-100">
              <span className="text-sm text-blue-700 font-medium">
                {selectedIds.size} voertuig{selectedIds.size !== 1 ? 'en' : ''} geselecteerd
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setSelectedIds(new Set())}
                  className="px-3 py-1.5 text-xs text-blue-600 hover:text-blue-800 font-medium transition-colors"
                >
                  Wis selectie
                </button>
                <button
                  onClick={() => setShowVerplaats(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-xs font-semibold rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <ArrowRight className="w-3.5 h-3.5" />
                  Verplaatsen
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {showVerplaats && (
        <VerplaatsVoertuigModal
          voertuigen={selectedVoertuigen}
          onClose={() => setShowVerplaats(false)}
          onSuccess={() => { setShowVerplaats(false); setSelectedIds(new Set()); onVerplaatst(); }}
        />
      )}
    </div>
  );
}

/* ─── Helpers ────────────────────────────────────────────────────────── */

function StatKaart({ label, waarde, sub, kleur, icon }: { label: string; waarde: number; sub: string; kleur: string; icon: React.ReactNode }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl px-4 py-3 flex items-center gap-3">
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${kleur}`}>
        {icon}
      </div>
      <div>
        <p className="text-lg font-bold text-gray-900">{waarde}</p>
        <p className="text-xs text-gray-400 leading-tight">{label}</p>
        <p className="text-[10px] text-gray-300 leading-tight">{sub}</p>
      </div>
    </div>
  );
}

function NieuwVoertuigModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [kenteken, setKenteken] = useState('');
  const [model, setModel] = useState('');
  const [kleur, setKleur] = useState('#345022');
  const [meldcode, setMeldcode] = useState('');
  const [barcode, setBarcode] = useState('');
  const [uitvoering, setUitvoering] = useState('');
  const [objectStatus, setObjectStatus] = useState('Operationeel');
  const [relatieId, setRelatieId] = useState('');
  const [relaties, setRelaties] = useState<{ id: string; naam: string }[]>([]);
  const [bezig, setBezig] = useState(false);
  const [fout, setFout] = useState('');

  useEffect(() => {
    supabase.from('relaties').select('id, naam').eq('status', 'actief').order('naam')
      .then(({ data }) => setRelaties(data ?? []));
  }, []);

  async function opslaan() {
    if (!kenteken.trim()) { setFout('Kenteken is verplicht.'); return; }
    setFout(''); setBezig(true);
    const { error } = await supabase.from('voertuigen').insert({
      kenteken: kenteken.trim().toUpperCase(),
      model: model.trim(),
      kleur: kleur || null,
      meldcode: meldcode.trim(),
      barcode: barcode.trim(),
      uitvoering: uitvoering.trim(),
      object_status: objectStatus,
      relatie_id: relatieId || null,
      actief: true,
      opmerking: '',
      tenaamstelling: '',
      contract_type: '',
    });
    setBezig(false);
    if (error) { setFout(error.message); return; }
    onSuccess();
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col max-h-[92vh]">
        <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-100 flex-shrink-0">
          <p className="flex-1 text-sm font-bold text-gray-900">Voertuig toevoegen</p>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors">
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Kenteken *</label>
              <input value={kenteken} onChange={(e) => setKenteken(e.target.value)} placeholder="AA-123-BB"
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 font-mono uppercase"
                autoFocus />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Meldcode</label>
              <input value={meldcode} onChange={(e) => setMeldcode(e.target.value)} placeholder="EW-0001-A"
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 font-mono" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Model</label>
              <input value={model} onChange={(e) => setModel(e.target.value)} placeholder="E-chopper"
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Uitvoering</label>
              <input value={uitvoering} onChange={(e) => setUitvoering(e.target.value)} placeholder="Standard"
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Barcode</label>
              <input value={barcode} onChange={(e) => setBarcode(e.target.value)} placeholder="123456789"
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 font-mono" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Kleur</label>
              <div className="flex items-center gap-2">
                <input type="color" value={kleur} onChange={(e) => setKleur(e.target.value)}
                  className="w-10 h-9 border border-gray-200 rounded-lg cursor-pointer p-0.5" />
                <span className="text-sm text-gray-500 font-mono">{kleur}</span>
              </div>
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Objectstatus</label>
            <select value={objectStatus} onChange={(e) => setObjectStatus(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none appearance-none bg-white">
              <option>Operationeel</option>
              <option>Reparatie op locatie</option>
              <option>Reparatie in loods</option>
              <option>In loods</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Locatie / Relatie</label>
            <select value={relatieId} onChange={(e) => setRelatieId(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none appearance-none bg-white">
              <option value="">— Geen locatie —</option>
              {relaties.map((r) => <option key={r.id} value={r.id}>{r.naam}</option>)}
            </select>
          </div>
          {fout && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{fout}</p>}
        </div>
        <div className="px-5 pb-5 pt-3 border-t border-gray-100 flex gap-2 flex-shrink-0">
          <button onClick={opslaan} disabled={bezig || !kenteken.trim()}
            className="flex-1 py-2.5 bg-[#F3A713] text-[#1A1A1A] text-sm font-bold rounded-xl hover:bg-[#D4900E] transition-colors disabled:opacity-60">
            {bezig ? 'Opslaan...' : 'Voertuig toevoegen'}
          </button>
          <button onClick={onClose} className="px-4 py-2.5 border border-gray-200 text-gray-600 text-sm font-medium rounded-xl hover:bg-gray-50 transition-colors">
            Annuleer
          </button>
        </div>
      </div>
    </div>
  );
}

function VerplaatsVoertuigModal({
  voertuigen,
  onClose,
  onSuccess,
}: {
  voertuigen: (DbVoertuig & { relaties?: any })[];
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [relaties, setRelaties] = useState<{ id: string; naam: string; crediteurnummer: string | null; plaats: string }[]>([]);
  const [zoekRelatie, setZoekRelatie] = useState('');
  const [doelGeselecteerd, setDoelGeselecteerd] = useState(false);
  const [doelRelatieId, setDoelRelatieId] = useState<string | null>(null);
  const [bezig, setBezig] = useState(false);
  const [fout, setFout] = useState('');

  useEffect(() => {
    supabase.from('relaties').select('id, naam, crediteurnummer, plaats').eq('status', 'actief').order('naam')
      .then(({ data }) => setRelaties(data ?? []));
  }, []);

  const gefilterd = zoekRelatie
    ? relaties.filter((r) =>
        r.naam.toLowerCase().includes(zoekRelatie.toLowerCase()) ||
        (r.crediteurnummer ?? '').toLowerCase().includes(zoekRelatie.toLowerCase()) ||
        (r.plaats ?? '').toLowerCase().includes(zoekRelatie.toLowerCase())
      )
    : relaties;

  function kiesRelatie(id: string | null) {
    setDoelRelatieId(id);
    setDoelGeselecteerd(true);
  }

  async function bevestig() {
    if (!doelGeselecteerd) return;
    setBezig(true); setFout('');
    const ids = voertuigen.map((v) => v.id);
    const { error } = await supabase.from('voertuigen').update({ relatie_id: doelRelatieId }).in('id', ids);
    setBezig(false);
    if (error) { setFout(error.message); return; }
    onSuccess();
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col max-h-[85vh]">
        <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-100 flex-shrink-0">
          <ArrowRight className="w-5 h-5 text-blue-600" />
          <p className="flex-1 text-sm font-bold text-gray-900">Voertuigen verplaatsen</p>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors">
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
              Te verplaatsen ({voertuigen.length})
            </p>
            <div className="flex flex-wrap gap-1.5">
              {voertuigen.map((v) => (
                <span key={v.id} className="px-2 py-1 bg-gray-100 rounded-lg text-xs font-mono font-semibold text-gray-700">
                  {v.kenteken}
                </span>
              ))}
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Nieuwe locatie</p>
            <div className="relative mb-2">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
              <input
                type="text"
                placeholder="Zoek locatie..."
                value={zoekRelatie}
                onChange={(e) => setZoekRelatie(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20"
                autoFocus
              />
            </div>
            <div className="border border-gray-200 rounded-xl overflow-hidden max-h-56 overflow-y-auto">
              <button
                onClick={() => kiesRelatie(null)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-gray-50 transition-colors border-b border-gray-100 ${doelGeselecteerd && doelRelatieId === null ? 'bg-blue-50' : ''}`}
              >
                <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${doelGeselecteerd && doelRelatieId === null ? 'border-blue-600 bg-blue-600' : 'border-gray-300'}`}>
                  {doelGeselecteerd && doelRelatieId === null && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                </div>
                <span className="text-sm text-gray-500 italic">Zonder locatie (ontkoppelen)</span>
              </button>
              {gefilterd.map((r) => (
                <button
                  key={r.id}
                  onClick={() => kiesRelatie(r.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-gray-50 transition-colors border-b border-gray-100 last:border-0 ${doelGeselecteerd && doelRelatieId === r.id ? 'bg-blue-50' : ''}`}
                >
                  <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${doelGeselecteerd && doelRelatieId === r.id ? 'border-blue-600 bg-blue-600' : 'border-gray-300'}`}>
                    {doelGeselecteerd && doelRelatieId === r.id && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <span className="text-sm font-medium text-gray-800">{r.naam}</span>
                    {r.crediteurnummer && <span className="ml-2 text-xs text-gray-400 font-mono">{r.crediteurnummer}</span>}
                    {r.plaats && <span className="ml-1 text-xs text-gray-400">· {r.plaats}</span>}
                  </div>
                </button>
              ))}
              {gefilterd.length === 0 && (
                <p className="px-3 py-3 text-sm text-gray-400 italic text-center">Geen locaties gevonden.</p>
              )}
            </div>
          </div>

          {fout && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{fout}</p>}
        </div>

        <div className="px-5 pb-5 pt-3 border-t border-gray-100 flex gap-2 flex-shrink-0">
          <button
            onClick={bevestig}
            disabled={bezig || !doelGeselecteerd}
            className="flex-1 py-2.5 bg-blue-600 text-white text-sm font-bold rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-60"
          >
            {bezig ? 'Verplaatsen...' : `${voertuigen.length} voertuig${voertuigen.length !== 1 ? 'en' : ''} verplaatsen`}
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
      <select value={value} onChange={(e) => onChange(e.target.value)}
        className="appearance-none pl-3 pr-8 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-gray-700">
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
    </div>
  );
}
