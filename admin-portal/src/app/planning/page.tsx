'use client';

import { useState, useEffect } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { supabase, type DbOpdracht } from '@/lib/supabase';
import {
  Plus, Search, ChevronDown, ChevronUp, MapPin, Truck,
  Lock, Unlock, Sparkles, Calendar, AlertTriangle, Clock,
  Wrench, Battery, Bike, ArrowLeftRight, Zap, X, CheckCircle,
  Building2, Trash2, Pencil, CalendarClock, RotateCcw, Archive, GripVertical,
} from 'lucide-react';

/* ─── Types ─────────────────────────────────────────────── */

type VerhuurLocatie = {
  id: string; naam: string; adres: string; postcode: string;
  stad: string; land: string; contactpersoon: string; telefoon: string;
};

type KentekenRij = { kenteken: string; probleem: string };

/* ─── Constanten ─────────────────────────────────────────── */

const VERHUURLOCATIES: VerhuurLocatie[] = [
  { id: '1', naam: 'Strandhotel Scheveningen', adres: 'Gevers Deynootplein 30', postcode: '2586 CK', stad: 'Scheveningen', land: 'NL', contactpersoon: 'Lisa de Groot', telefoon: '+31 6 1234 5678' },
  { id: '2', naam: 'Vakantiepark De Koog', adres: 'Rommelpot 8', postcode: '1796 AZ', stad: 'De Koog', land: 'NL', contactpersoon: 'Mark Visser', telefoon: '+31 6 8765 4321' },
  { id: '3', naam: 'Camping Les Dunes', adres: 'Duinweg 4', postcode: '8670', stad: 'Koksijde', land: 'BE', contactpersoon: 'Camping reception', telefoon: '+32 58 123 456' },
  { id: '4', naam: 'Familie Janssen', adres: 'Kerkstraat 12', postcode: '1012 AB', stad: 'Amsterdam', land: 'NL', contactpersoon: 'P. Janssen', telefoon: '+31 6 2222 3333' },
  { id: '5', naam: 'Resort Borkum', adres: 'Strandpromenade 1', postcode: '26757', stad: 'Borkum', land: 'DE', contactpersoon: 'Hans Müller', telefoon: '+49 4922 123456' },
  { id: '6', naam: 'Hotelpark Julianadorp', adres: 'Zandweg 22', postcode: '1787 PK', stad: 'Julianadorp', land: 'NL', contactpersoon: 'Petra van Dam', telefoon: '+31 6 5555 1234' },
  { id: '7', naam: 'Camping Le Nord', adres: 'Rue du Littoral 7', postcode: '59240', stad: 'Dunkerque', land: 'FR', contactpersoon: 'Jean Dupont', telefoon: '+33 3 28 12 34 56' },
];

const OPDRACHTTYPEN = [
  { id: 'onderhoud', label: 'Onderhoud', kleur: 'bg-blue-100 text-blue-700', icon: Wrench },
  { id: 'reparatie', label: 'Reparatie', kleur: 'bg-orange-100 text-orange-700', icon: Wrench },
  { id: 'accu', label: 'Accu', kleur: 'bg-yellow-100 text-yellow-700', icon: Battery },
  { id: 'plaatsen', label: 'Plaatsen', kleur: 'bg-green-100 text-green-700', icon: Bike },
  { id: 'terughalen', label: 'Terughalen', kleur: 'bg-red-100 text-red-700', icon: Bike },
  { id: 'evaluatie', label: 'Evaluatie', kleur: 'bg-purple-100 text-purple-700', icon: Calendar },
  { id: 'voertuigruil', label: 'Voertuigruil', kleur: 'bg-teal-100 text-teal-700', icon: ArrowLeftRight },
  { id: 'pechhulp', label: 'Pechhulp', kleur: 'bg-red-200 text-red-800', icon: Zap },
];

const MONTEURS = [
  { id: 'm1', naam: 'Jan Bakker', busCapaciteit: 8 },
  { id: 'm2', naam: 'Kevin Smit', busCapaciteit: 4 },
  { id: 'm3', naam: 'Sophie van Dam', busCapaciteit: 8 },
];

function monteurNaam(id: string | null) {
  return MONTEURS.find((m) => m.id === id)?.naam ?? null;
}

function formatDatum(d: string) {
  return new Date(d).toLocaleDateString('nl-NL', { weekday: 'short', day: 'numeric', month: 'short' });
}

/* ─── Hoofdpagina ────────────────────────────────────────── */

function huidigeWeekDagen() {
  const nu = new Date();
  const dow = nu.getDay();
  const diffNaarMa = dow === 0 ? -6 : 1 - dow;
  const ma = new Date(nu);
  ma.setDate(nu.getDate() + diffNaarMa);
  return Array.from({ length: 5 }, (_, i) => {
    const d = new Date(ma);
    d.setDate(ma.getDate() + i);
    return {
      datum: d.toISOString().split('T')[0],
      kort: d.toLocaleDateString('nl-NL', { weekday: 'short' }),
      dagNr: d.getDate(),
      maand: d.toLocaleDateString('nl-NL', { month: 'short' }),
    };
  });
}

const WEEK_DAGEN = huidigeWeekDagen();
const VANDAAG = new Date().toISOString().split('T')[0];

export default function PlanningPage() {
  const [kaartIngeklapt, setKaartIngeklapt] = useState(false);
  const [uitgeklapt, setUitgeklapt] = useState<Record<string, boolean>>({ m1: true });
  const [typeFilter, setTypeFilter] = useState('');
  const [zoek, setZoek] = useState('');
  const [planFilter, setPlanFilter] = useState<'alle' | 'gepland' | 'nietgepland' | 'afgerond' | 'verwijderd'>('alle');
  const [verwijderd, setVerwijderd] = useState<DbOpdracht[]>([]);
  const [showNieuwModal, setShowNieuwModal] = useState(false);
  const [herplanOpdracht, setHerplanOpdracht] = useState<DbOpdracht | null>(null);
  const [ontgrendeld, setOntgrendeld] = useState<Set<string>>(new Set());

  const [opdrachten, setOpdrachten] = useState<DbOpdracht[]>([]);
  const [laden, setLaden] = useState(true);
  const [succesBericht, setSuccesBericht] = useState('');
  const [slepenId, setSlepenId] = useState<string | null>(null);
  const [sleepDoel, setSleepDoel] = useState<string | null>(null); // datum of 'geen-datum'

  useEffect(() => {
    if (planFilter === 'verwijderd') laadVerwijderd();
  }, [planFilter]);

  useEffect(() => {
    laadOpdrachten();
    const channel = supabase
      .channel('opdrachten-admin')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'opdrachten' }, (payload) => {
        if (payload.eventType === 'INSERT') {
          const nieuw = payload.new as DbOpdracht;
          if (!nieuw.deleted_at) setOpdrachten((p) => [nieuw, ...p]);
        } else if (payload.eventType === 'UPDATE') {
          const bijgewerkt = payload.new as DbOpdracht;
          if (bijgewerkt.deleted_at) {
            setOpdrachten((p) => p.filter((o) => o.id !== bijgewerkt.id));
          } else {
            // Merge: bewaar voertuigen/pech_stops (realtime payload bevat geen nested relaties)
            setOpdrachten((p) => p.map((o) => o.id === bijgewerkt.id ? { ...o, ...bijgewerkt } : o));
          }
        } else if (payload.eventType === 'DELETE') {
          setOpdrachten((p) => p.filter((o) => o.id !== payload.old.id));
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  async function laadOpdrachten() {
    setLaden(true);
    const { data } = await supabase
      .from('opdrachten')
      .select('*, voertuigen(*), pech_stops(*)')
      .is('deleted_at', null)
      .order('created_at', { ascending: false });
    if (data) setOpdrachten(data as DbOpdracht[]);
    setLaden(false);
  }

  async function laadVerwijderd() {
    const { data } = await supabase
      .from('opdrachten')
      .select('*, voertuigen(*), pech_stops(*)')
      .not('deleted_at', 'is', null)
      .order('deleted_at', { ascending: false });
    if (!data) return;

    // Auto-archiveer + hard-delete opdrachten ouder dan 30 dagen
    const grens = new Date();
    grens.setDate(grens.getDate() - 30);
    const teOud = data.filter((o: any) => new Date(o.deleted_at) < grens);

    for (const op of teOud) {
      // Sla op als JSON-bestand
      await fetch('/api/archief', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ opdracht: op }) });
      // Hard delete
      await supabase.from('voertuigen').delete().eq('opdracht_id', op.id);
      await supabase.from('pech_stops').delete().eq('opdracht_id', op.id);
      await supabase.from('opdrachten').delete().eq('id', op.id);
    }

    setVerwijderd(data.filter((o: any) => new Date(o.deleted_at) >= grens) as DbOpdracht[]);
  }

  async function verplaatsOpdracht(opdrachtId: string, nieuwDatum: string | null, nieuwMonteurId?: string) {
    setSlepenId(null);
    setSleepDoel(null);
    const updates: Partial<DbOpdracht> = { datum: nieuwDatum, updated_at: new Date().toISOString() };
    if (nieuwMonteurId !== undefined) updates.monteur_id = nieuwMonteurId;
    const { error } = await supabase.from('opdrachten').update(updates).eq('id', opdrachtId);
    if (!error) {
      setOpdrachten((p) => p.map((o) => o.id === opdrachtId ? { ...o, ...updates } : o));
      const monteur = nieuwMonteurId ? monteurNaam(nieuwMonteurId) : null;
      const label = nieuwDatum ? formatDatum(nieuwDatum) : 'onbekende datum';
      toonSucces(monteur ? `Verplaatst naar ${monteur} · ${label}` : nieuwDatum ? `Verplaatst naar ${label}` : 'Datum verwijderd — staat op "onbekend"');
    }
  }

  async function wisselVolgordeAdmin(opdrachtId: string, dagOps: DbOpdracht[], richting: 'omhoog' | 'omlaag') {
    const gesorteerd = [...dagOps].sort((a, b) => a.route_volgorde - b.route_volgorde);
    const idx = gesorteerd.findIndex((o) => o.id === opdrachtId);
    const buurIdx = richting === 'omhoog' ? idx - 1 : idx + 1;
    if (buurIdx < 0 || buurIdx >= gesorteerd.length) return;

    const huidig = gesorteerd[idx];
    const buur = gesorteerd[buurIdx];

    setOpdrachten((p) => p.map((o) => {
      if (o.id === huidig.id) return { ...o, route_volgorde: buur.route_volgorde };
      if (o.id === buur.id) return { ...o, route_volgorde: huidig.route_volgorde };
      return o;
    }));

    await Promise.all([
      supabase.from('opdrachten').update({ route_volgorde: buur.route_volgorde }).eq('id', huidig.id),
      supabase.from('opdrachten').update({ route_volgorde: huidig.route_volgorde }).eq('id', buur.id),
    ]);
  }

  function toonSucces(tekst: string) {
    setSuccesBericht(tekst);
    setTimeout(() => setSuccesBericht(''), 4000);
  }

  function toggleLock(id: string) {
    setOntgrendeld((prev) => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  }

  const alleNietUitgevoerd = opdrachten.filter((o) => o.status !== 'uitgevoerd');
  const alleAfgerond = opdrachten.filter((o) => o.status === 'uitgevoerd');

  const gefilterd = planFilter === 'afgerond'
    ? alleAfgerond.filter((op) => {
        const typeMatch = !typeFilter || op.type === typeFilter;
        const zoekMatch = !zoek || op.locatie.toLowerCase().includes(zoek.toLowerCase()) || op.postcode.includes(zoek);
        return typeMatch && zoekMatch;
      })
    : alleNietUitgevoerd.filter((op) => {
        const typeMatch = !typeFilter || op.type === typeFilter;
        const zoekMatch = !zoek || op.locatie.toLowerCase().includes(zoek.toLowerCase()) || op.postcode.includes(zoek);
        const planMatch =
          planFilter === 'alle' || planFilter === 'verwijderd' ? true :
          planFilter === 'gepland' ? !!op.monteur_id :
          !op.monteur_id;
        return typeMatch && zoekMatch && planMatch;
      });

  const aantalGepland = alleNietUitgevoerd.filter((o) => !!o.monteur_id).length;
  const aantalNietGepland = alleNietUitgevoerd.filter((o) => !o.monteur_id).length;

  return (
    <DashboardLayout
      title="Planning & Opdrachten"
      actions={
        <button
          onClick={() => setShowNieuwModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-[#F3A713] text-[#1A1A1A] rounded-lg text-sm font-semibold shadow-sm hover:bg-[#D4900E] active:scale-95 transition-all"
        >
          <Plus className="w-4 h-4" />
          Opdracht aanmaken
        </button>
      }
    >
      {/* Succes toast */}
      {succesBericht && (
        <div className="fixed top-4 right-4 z-50 flex items-center gap-2 bg-green-600 text-white px-4 py-3 rounded-xl shadow-lg text-sm font-medium">
          <CheckCircle className="w-4 h-4" />
          {succesBericht}
        </div>
      )}

      <div className="flex gap-4 h-[calc(100vh-8rem)] overflow-hidden">

        {/* ── Linkerkolom ─────────────────────────────────────── */}
        <div className="w-80 flex-shrink-0 flex flex-col gap-3 overflow-hidden">
          <div className="bg-white rounded-xl border border-gray-200 flex flex-col overflow-hidden flex-1">

            {/* Header + filters */}
            <div className="p-3 border-b border-gray-100 space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Opdrachten</p>
                <span className="text-xs font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full">{gefilterd.length}</span>
              </div>

              {/* Plan-status tabs */}
              <div className="flex flex-col gap-1">
                <div className="flex rounded-lg border border-gray-200 overflow-hidden text-[11px] font-semibold">
                  {([
                    { key: 'alle', label: 'Alle', count: alleNietUitgevoerd.length },
                    { key: 'nietgepland', label: 'Niet gepland', count: aantalNietGepland },
                    { key: 'gepland', label: 'Gepland', count: aantalGepland },
                  ] as const).map((tab) => (
                    <button
                      key={tab.key}
                      onClick={() => setPlanFilter(tab.key)}
                      className={`flex-1 py-1.5 px-1 flex items-center justify-center gap-1 transition-colors ${
                        planFilter === tab.key
                          ? 'bg-primary text-white'
                          : 'text-gray-500 hover:bg-gray-50'
                      }`}
                    >
                      {tab.label}
                      <span className={`rounded-full px-1 ${planFilter === tab.key ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-500'}`}>
                        {tab.count}
                      </span>
                    </button>
                  ))}
                </div>
                <div className="flex gap-1">
                  <button
                    onClick={() => setPlanFilter('afgerond')}
                    className={`flex-1 py-1.5 px-2 flex items-center justify-center gap-1.5 rounded-lg border text-[11px] font-semibold transition-colors ${
                      planFilter === 'afgerond'
                        ? 'bg-green-600 text-white border-green-600'
                        : 'text-green-700 border-green-200 hover:bg-green-50'
                    }`}
                  >
                    <CheckCircle className="w-3 h-3" />
                    Afgerond
                    <span className={`rounded-full px-1.5 text-[10px] ${planFilter === 'afgerond' ? 'bg-white/20 text-white' : 'bg-green-100 text-green-700'}`}>
                      {alleAfgerond.length}
                    </span>
                  </button>
                  <button
                    onClick={() => setPlanFilter('verwijderd')}
                    className={`flex-1 py-1.5 px-2 flex items-center justify-center gap-1.5 rounded-lg border text-[11px] font-semibold transition-colors ${
                      planFilter === 'verwijderd'
                        ? 'bg-red-600 text-white border-red-600'
                        : 'text-red-500 border-red-200 hover:bg-red-50'
                    }`}
                  >
                    <Trash2 className="w-3 h-3" />
                    Verwijderd
                    {verwijderd.length > 0 && (
                      <span className={`rounded-full px-1.5 text-[10px] ${planFilter === 'verwijderd' ? 'bg-white/20 text-white' : 'bg-red-100 text-red-600'}`}>
                        {verwijderd.length}
                      </span>
                    )}
                  </button>
                </div>
              </div>

              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Postcode of locatie..."
                  className="w-full pl-8 pr-2 py-1.5 text-xs border border-gray-200 rounded-lg bg-gray-50 focus:outline-none focus:ring-1 focus:ring-primary/30"
                  value={zoek}
                  onChange={(e) => setZoek(e.target.value)}
                />
              </div>
              <div className="relative">
                <select
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value)}
                  className="w-full appearance-none pl-2 pr-6 py-1.5 text-xs border border-gray-200 rounded-lg bg-gray-50 focus:outline-none"
                >
                  <option value="">Alle types</option>
                  {OPDRACHTTYPEN.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
                </select>
                <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400 pointer-events-none" />
              </div>
            </div>

            {/* Lijst */}
            <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
              {planFilter === 'afgerond' ? (
                /* ── Afgerond lijst ── */
                gefilterd.length === 0 ? (
                  <div className="text-center py-8 text-xs text-gray-400">Geen afgeronde opdrachten</div>
                ) : gefilterd.map((op) => {
                  const typeInfo = OPDRACHTTYPEN.find((t) => t.id === op.type);
                  const monteur = monteurNaam(op.monteur_id);
                  return (
                    <div key={op.id} className="bg-green-50 border border-green-200 border-l-[3px] border-l-green-500 rounded-lg p-2.5">
                      <div className="flex items-start gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 mb-1">
                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${typeInfo?.kleur}`}>{typeInfo?.label}</span>
                            <span className="font-mono text-[10px] text-gray-400 ml-auto">{op.id}</span>
                          </div>
                          <p className="text-xs font-semibold text-gray-800 truncate">{op.locatie}</p>
                          <div className="flex items-center gap-2 mt-1 text-[10px] text-gray-400">
                            {monteur && <span className="text-green-700 font-semibold">{monteur}</span>}
                            {op.datum && <span>· {formatDatum(op.datum)}</span>}
                            {op.km_gereden != null && (
                              <span className="ml-auto flex items-center gap-0.5 font-semibold text-gray-600">
                                {op.km_gereden} km
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })
              ) : planFilter === 'verwijderd' ? (
                /* ── Verwijderd lijst ── */
                verwijderd.length === 0 ? (
                  <div className="text-center py-8 text-xs text-gray-400">Geen verwijderde opdrachten</div>
                ) : verwijderd.map((op) => {
                  const typeInfo = OPDRACHTTYPEN.find((t) => t.id === op.type);
                  const verwijderdOp = new Date(op.deleted_at!);
                  const dagenOver = 30 - Math.floor((Date.now() - verwijderdOp.getTime()) / 86400000);
                  return (
                    <div key={op.id} className="bg-red-50 border border-red-200 border-l-[3px] border-l-red-500 rounded-lg p-2.5 space-y-2">
                      <div className="flex items-start gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 mb-1">
                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${typeInfo?.kleur}`}>{typeInfo?.label}</span>
                            <span className="font-mono text-[10px] text-gray-400 ml-auto">{op.id}</span>
                          </div>
                          <p className="text-xs font-semibold text-gray-800 truncate">{op.locatie}</p>
                          <p className="text-[10px] text-red-500 mt-0.5">
                            Verwijderd {verwijderdOp.toLocaleDateString('nl-NL')} · nog {dagenOver} dag{dagenOver !== 1 ? 'en' : ''} beschikbaar
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 pt-1 border-t border-red-200">
                        <button
                          onClick={async () => {
                            await supabase.from('opdrachten').update({ deleted_at: null }).eq('id', op.id);
                            setVerwijderd((p) => p.filter((o) => o.id !== op.id));
                          }}
                          className="flex items-center gap-1 px-2 py-1 bg-white text-green-700 border border-green-300 rounded text-[10px] font-semibold hover:bg-green-50 transition-colors"
                        >
                          <RotateCcw className="w-3 h-3" />
                          Herstel
                        </button>
                        <DefinitieVerwijderKnop
                          opdracht={op}
                          onVerwijderd={() => setVerwijderd((p) => p.filter((o) => o.id !== op.id))}
                        />
                      </div>
                    </div>
                  );
                })
              ) : laden ? (
                <div className="text-center py-8 text-xs text-gray-400">Laden...</div>
              ) : gefilterd.length === 0 ? (
                <div className="text-center py-8 text-xs text-gray-400">Geen opdrachten gevonden</div>
              ) : gefilterd.map((op) => {
                const typeInfo = OPDRACHTTYPEN.find((t) => t.id === op.type);
                const isGepland = !!op.monteur_id;
                const monteur = monteurNaam(op.monteur_id);
                return (
                  <div
                    key={op.id}
                    className={`relative bg-white border rounded-lg p-2.5 cursor-pointer hover:shadow-sm transition-all group ${
                      isGepland ? 'border-l-[3px] border-l-primary border-gray-200' : 'border-l-[3px] border-l-amber-400 border-gray-200'
                    }`}
                    onClick={() => setHerplanOpdracht(op)}
                  >
                    <div className="flex items-start gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 mb-1">
                          {op.urgent && <AlertTriangle className="w-3 h-3 text-red-500 flex-shrink-0" />}
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${typeInfo?.kleur}`}>
                            {typeInfo?.label}
                          </span>
                          <span className="font-mono text-[10px] text-gray-400 ml-auto">{op.id}</span>
                        </div>
                        <p className="text-xs font-semibold text-gray-800 truncate">{op.locatie}</p>
                        <div className="flex items-center gap-2 mt-1 text-[10px] text-gray-400">
                          <span className="flex items-center gap-0.5"><MapPin className="w-2.5 h-2.5" />{op.postcode}</span>
                          {(op.voertuigen ?? []).length > 0 && <span>{(op.voertuigen ?? []).length} voertuigen</span>}
                          {op.deadline && <span className="flex items-center gap-0.5 text-amber-500"><Clock className="w-2.5 h-2.5" />{op.deadline}</span>}
                        </div>
                      </div>
                      <PrioIndicator prio={op.prioriteit} />
                    </div>

                    {/* Plan-status indicator */}
                    <div className="mt-2 pt-1.5 border-t border-gray-100 flex items-center gap-1.5">
                      {isGepland ? (
                        <>
                          <div className="w-1.5 h-1.5 rounded-full bg-primary flex-shrink-0" />
                          <span className="text-[10px] text-primary font-semibold truncate">{monteur}</span>
                          <span className="text-[10px] text-gray-400">·</span>
                          <span className="text-[10px] text-gray-400">
                            {op.datum ? formatDatum(op.datum) : <span className="italic text-gray-400">Geen datum</span>}
                          </span>
                          <Pencil className="w-2.5 h-2.5 text-gray-300 ml-auto group-hover:text-primary transition-colors" />
                        </>
                      ) : (
                        <>
                          <div className="w-1.5 h-1.5 rounded-full bg-amber-400 flex-shrink-0" />
                          <span className="text-[10px] text-amber-600 font-semibold">Niet gepland</span>
                          <CalendarClock className="w-2.5 h-2.5 text-gray-300 ml-auto group-hover:text-amber-500 transition-colors" />
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* ── Rechterkolom ────────────────────────────────────── */}
        <div className="flex-1 flex flex-col gap-3 overflow-hidden min-w-0">

          {/* Kaart */}
          <div className={`bg-white rounded-xl border border-gray-200 flex-shrink-0 overflow-hidden transition-all ${kaartIngeklapt ? 'h-10' : 'h-44'}`}>
            <div
              className="flex items-center justify-between px-4 h-10 cursor-pointer hover:bg-gray-50 transition-colors"
              onClick={() => setKaartIngeklapt(!kaartIngeklapt)}
            >
              <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
                <MapPin className="w-4 h-4 text-gray-400" />
                Kaart
              </div>
              {kaartIngeklapt ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronUp className="w-4 h-4 text-gray-400" />}
            </div>
            {!kaartIngeklapt && (
              <div className="h-[calc(100%-2.5rem)] bg-gradient-to-br from-blue-50 to-green-50 flex items-center justify-center">
                <div className="text-center text-gray-400">
                  <MapPin className="w-8 h-8 mx-auto mb-1 opacity-30" />
                  <p className="text-xs">Kaartintegratie (Google Maps API)</p>
                </div>
              </div>
            )}
          </div>

          {/* Monteur agendas */}
          <div className="flex-1 overflow-y-auto space-y-2">
            {MONTEURS.map((monteur) => {
              const isOpen = !!uitgeklapt[monteur.id];
              // Alleen met datum in de weekgrid; zonder datum staat in de linkerkolom
              const monteurOpdrachten = opdrachten.filter((o) => o.monteur_id === monteur.id && o.status !== 'uitgevoerd' && o.datum);
              return (
                <div key={monteur.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                  {/* Monteur header */}
                  <div
                    className="flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-gray-50/60 transition-colors"
                    onClick={() => setUitgeklapt((prev) => ({ ...prev, [monteur.id]: !prev[monteur.id] }))}
                  >
                    <div className="w-7 h-7 rounded-full bg-primary/10 text-primary font-bold text-xs flex items-center justify-center flex-shrink-0">
                      {monteur.naam.split(' ').map((n) => n[0]).join('').slice(0, 2)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-semibold text-gray-800">{monteur.naam}</span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-gray-400">
                      <span className="flex items-center gap-1"><Truck className="w-3.5 h-3.5" />{monteur.busCapaciteit}</span>
                      <span className={`font-semibold px-1.5 py-0.5 rounded-full ${monteurOpdrachten.length > 0 ? 'bg-primary/10 text-primary' : 'bg-gray-100 text-gray-400'}`}>
                        {monteurOpdrachten.length} opdrachten
                      </span>
                      {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </div>
                  </div>

                  {isOpen && (
                    <div className="border-t border-gray-100">
                      {/* Week agenda grid */}
                      <div className="grid grid-cols-5 gap-px bg-gray-100">
                        {WEEK_DAGEN.map((wd) => {
                          const dagOps = monteurOpdrachten.filter((o) => o.datum === wd.datum);
                          const isVandaag = wd.datum === VANDAAG;
                          const isDoel = sleepDoel === `${monteur.id}::${wd.datum}` && slepenId !== null;
                          return (
                            <div
                              key={wd.datum}
                              className={`p-2 min-h-[100px] transition-colors ${
                                isDoel
                                  ? 'bg-primary/10 ring-2 ring-primary/40 ring-inset'
                                  : isVandaag ? 'bg-primary/5' : 'bg-white'
                              }`}
                              onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; setSleepDoel(`${monteur.id}::${wd.datum}`); }}
                              onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setSleepDoel(null); }}
                              onDrop={(e) => { e.preventDefault(); const id = e.dataTransfer.getData('opdrachtId'); if (id) verplaatsOpdracht(id, wd.datum, monteur.id); }}
                            >
                              {/* Dag header */}
                              <div className={`flex items-baseline gap-1 mb-2 pb-1.5 border-b ${isVandaag ? 'border-primary/25' : 'border-gray-100'}`}>
                                <span className={`text-[10px] font-bold uppercase tracking-wide ${isVandaag ? 'text-primary' : 'text-gray-400'}`}>
                                  {wd.kort}
                                </span>
                                <span className={`text-base font-black leading-none ${isVandaag ? 'text-primary' : 'text-gray-600'}`}>
                                  {wd.dagNr}
                                </span>
                                <span className={`text-[9px] ${isVandaag ? 'text-primary/70' : 'text-gray-300'}`}>
                                  {wd.maand}
                                </span>
                                {isVandaag && (
                                  <span className="ml-auto text-[9px] font-bold text-primary bg-primary/10 px-1 rounded">
                                    NU
                                  </span>
                                )}
                              </div>

                              {/* Opdrachten in deze dag */}
                              <div className="space-y-1">
                                {[...dagOps].sort((a, b) => a.route_volgorde - b.route_volgorde).map((op, opIdx, sortedOps) => {
                                  const typeInfo = OPDRACHTTYPEN.find((t) => t.id === op.type);
                                  const isUnlocked = ontgrendeld.has(op.id);
                                  const wordtGesleept = slepenId === op.id;
                                  const tijdLabel = op.tijd_start
                                    ? `${op.tijd_start.slice(0,5)}${op.tijd_eind ? `–${op.tijd_eind.slice(0,5)}` : ''}`
                                    : null;
                                  return (
                                    <div
                                      key={op.id}
                                      draggable
                                      onDragStart={(e) => { e.dataTransfer.setData('opdrachtId', op.id); e.dataTransfer.effectAllowed = 'move'; setSlepenId(op.id); }}
                                      onDragEnd={() => { setSlepenId(null); setSleepDoel(null); }}
                                      className={`rounded p-1.5 text-[10px] border transition-all select-none ${
                                        wordtGesleept ? 'opacity-40 scale-95' :
                                        isUnlocked ? 'border-amber-300 bg-amber-50' :
                                        `${typeInfo?.kleur} border-transparent`
                                      } cursor-grab active:cursor-grabbing`}
                                    >
                                      <div className="flex items-center gap-1 min-w-0">
                                        <GripVertical className="w-2.5 h-2.5 opacity-30 flex-shrink-0" />
                                        <button
                                          onClick={() => toggleLock(op.id)}
                                          className="flex-shrink-0 p-0.5 hover:bg-black/10 rounded transition-colors"
                                          title={isUnlocked ? 'Vergrendelen' : 'Ontgrendelen'}
                                        >
                                          {isUnlocked
                                            ? <Unlock className="w-2.5 h-2.5 text-amber-600" />
                                            : <Lock className="w-2.5 h-2.5 opacity-40" />}
                                        </button>
                                        <span
                                          className="font-semibold truncate flex-1 cursor-pointer"
                                          onClick={() => { if (!isUnlocked) setHerplanOpdracht(op); }}
                                        >
                                          {op.locatie}
                                        </span>
                                        {op.urgent && <AlertTriangle className="w-2.5 h-2.5 text-red-500 flex-shrink-0" />}
                                        {/* Volgorde knoppen */}
                                        <div className="flex flex-col gap-0 flex-shrink-0">
                                          <button
                                            onClick={(e) => { e.stopPropagation(); wisselVolgordeAdmin(op.id, dagOps, 'omhoog'); }}
                                            disabled={opIdx === 0}
                                            className="p-0.5 hover:bg-black/10 rounded transition-colors disabled:opacity-20"
                                          >
                                            <ChevronUp className="w-2.5 h-2.5" />
                                          </button>
                                          <button
                                            onClick={(e) => { e.stopPropagation(); wisselVolgordeAdmin(op.id, dagOps, 'omlaag'); }}
                                            disabled={opIdx === sortedOps.length - 1}
                                            className="p-0.5 hover:bg-black/10 rounded transition-colors disabled:opacity-20"
                                          >
                                            <ChevronDown className="w-2.5 h-2.5" />
                                          </button>
                                        </div>
                                      </div>
                                      {/* Tijd + id rij */}
                                      <div className="flex items-center gap-1.5 mt-0.5 pl-5">
                                        <span className="text-[9px] opacity-50 truncate">{op.id}</span>
                                        {tijdLabel && (
                                          <span className={`flex items-center gap-0.5 text-[9px] font-bold px-1 py-0.5 rounded ${op.tijd_vastzetten ? 'bg-amber-200 text-amber-800' : 'bg-black/10'}`}>
                                            {op.tijd_vastzetten && <Lock className="w-2 h-2 flex-shrink-0" />}
                                            {tijdLabel}
                                          </span>
                                        )}
                                      </div>
                                      {isUnlocked && (
                                        <div className="flex items-center gap-1 mt-1.5 pt-1 border-t border-amber-200">
                                          <button
                                            onClick={() => { setHerplanOpdracht(op); setOntgrendeld((p) => { const n = new Set(p); n.delete(op.id); return n; }); }}
                                            className="flex items-center gap-0.5 px-1.5 py-0.5 bg-primary text-white rounded text-[9px] font-semibold hover:bg-primary/90"
                                          >
                                            <CalendarClock className="w-2.5 h-2.5" /> Herplan
                                          </button>
                                          <VerwijderKnop
                                            opdrachtId={op.id}
                                            onVerwijderd={() => {
                                              setOntgrendeld((p) => { const n = new Set(p); n.delete(op.id); return n; });
                                              toonSucces(`Opdracht ${op.id} verwijderd`);
                                            }}
                                          />
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                                {dagOps.length === 0 && (
                                  <div className={`border border-dashed rounded h-8 flex items-center justify-center text-[9px] transition-colors ${
                                    isDoel ? 'border-primary text-primary font-semibold bg-primary/5' : 'border-gray-200 text-gray-200 hover:border-primary/30 hover:text-gray-300'
                                  }`}>
                                    {isDoel ? '↓ loslaten' : 'leeg'}
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {/* Drop-zone: datum wissen (sleep opdracht hierover) */}
                      {slepenId !== null && (
                        <div
                          className={`border-t border-dashed transition-colors px-3 py-2 ${
                            sleepDoel === 'geen-datum' ? 'bg-amber-100 border-amber-400' : 'border-amber-200 bg-amber-50/40'
                          }`}
                          onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; setSleepDoel('geen-datum'); }}
                          onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setSleepDoel(null); }}
                          onDrop={(e) => { e.preventDefault(); const id = e.dataTransfer.getData('opdrachtId'); if (id) verplaatsOpdracht(id, null); }}
                        >
                          <p className="text-[10px] font-bold text-amber-600 uppercase flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {sleepDoel === 'geen-datum' ? '↓ Loslaten = datum verwijderen' : 'Sleep hierheen om datum te wissen'}
                          </p>
                        </div>
                      )}

                      {monteurOpdrachten.length === 0 && (
                        <div className="px-4 py-4 text-xs text-gray-400 text-center">Geen opdrachten ingepland deze week</div>
                      )}

                      {/* AI */}
                      <div className="px-3 py-2 bg-gray-50/60 border-t border-gray-100 flex items-center gap-2">
                        <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                        <span className="text-xs text-gray-500 italic flex-1">Voorgesteld in de buurt van {monteur.naam.split(' ')[0]}</span>
                        <button className="flex items-center gap-1 text-xs font-medium text-purple-600 hover:text-purple-700 px-2 py-1 rounded hover:bg-purple-50">
                          <Sparkles className="w-3 h-3" />
                          AI vul aan
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}

            <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-center gap-3">
              <Truck className="w-5 h-5 text-amber-600 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-amber-800">Bakwagen (12 capaciteit)</p>
                <p className="text-xs text-amber-600">Los bedrijfsmiddel · Beschikbaar om in te plannen</p>
              </div>
              <button className="text-xs px-2.5 py-1 bg-amber-600 text-white rounded-lg font-medium hover:bg-amber-700 transition-colors">
                Inplannen
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── Modals ───────────────────────────────────────────── */}
      {showNieuwModal && (
        <NieuweOpdrachtModal
          onClose={() => setShowNieuwModal(false)}
          onSuccess={(id) => { setShowNieuwModal(false); toonSucces(`Opdracht ${id} aangemaakt`); }}
        />
      )}

      {herplanOpdracht && (
        <HerplanModal
          opdracht={herplanOpdracht}
          onClose={() => setHerplanOpdracht(null)}
          onOpgeslagen={(id, wijzigingen) => {
            setOpdrachten((p) => p.map((o) => o.id === id ? { ...o, ...wijzigingen } : o));
            setHerplanOpdracht(null);
            toonSucces(`Opdracht ${id} bijgewerkt`);
          }}
          onVerwijderd={(id) => { setHerplanOpdracht(null); toonSucces(`Opdracht ${id} verwijderd`); }}
        />
      )}
    </DashboardLayout>
  );
}

/* ─── Verwijder knop met inline bevestiging ─────────────── */

function VerwijderKnop({ opdrachtId, onVerwijderd }: { opdrachtId: string; onVerwijderd: () => void }) {
  const [bevestig, setBevestig] = useState(false);

  if (bevestig) {
    return (
      <div className="flex items-center gap-1">
        <span className="text-[10px] text-red-600 font-semibold">Zeker?</span>
        <button
          onClick={async () => {
            await supabase.from('opdrachten').update({ deleted_at: new Date().toISOString() }).eq('id', opdrachtId);
            onVerwijderd();
          }}
          className="px-1.5 py-0.5 bg-red-600 text-white rounded text-[10px] font-bold hover:bg-red-700"
        >
          Ja
        </button>
        <button
          onClick={() => setBevestig(false)}
          className="px-1.5 py-0.5 bg-gray-200 text-gray-600 rounded text-[10px] font-bold hover:bg-gray-300"
        >
          Nee
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={() => setBevestig(true)}
      className="flex items-center gap-1 px-2 py-1 bg-red-50 text-red-600 border border-red-200 rounded-md text-[10px] font-semibold hover:bg-red-100 transition-colors"
    >
      <Trash2 className="w-3 h-3" />
      Verwijder
    </button>
  );
}

/* ─── Definitief verwijderen knop (vanuit verwijderd-tab) ── */

function DefinitieVerwijderKnop({ opdracht, onVerwijderd }: { opdracht: DbOpdracht; onVerwijderd: () => void }) {
  const [bevestig, setBevestig] = useState(false);

  if (bevestig) {
    return (
      <div className="flex items-center gap-1 ml-auto">
        <span className="text-[10px] text-red-600 font-semibold">Definitief?</span>
        <button
          onClick={async () => {
            await fetch('/api/archief', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ opdracht }) });
            await supabase.from('voertuigen').delete().eq('opdracht_id', opdracht.id);
            await supabase.from('pech_stops').delete().eq('opdracht_id', opdracht.id);
            await supabase.from('opdrachten').delete().eq('id', opdracht.id);
            onVerwijderd();
          }}
          className="px-1.5 py-0.5 bg-red-600 text-white rounded text-[10px] font-bold hover:bg-red-700"
        >
          Ja
        </button>
        <button onClick={() => setBevestig(false)} className="px-1.5 py-0.5 bg-gray-200 text-gray-600 rounded text-[10px] font-bold hover:bg-gray-300">
          Nee
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={() => setBevestig(true)}
      className="flex items-center gap-1 px-2 py-1 bg-red-50 text-red-600 border border-red-200 rounded text-[10px] font-semibold hover:bg-red-100 transition-colors ml-auto"
    >
      <Archive className="w-3 h-3" />
      Definitief verwijderen
    </button>
  );
}

/* ─── Herplan Modal ─────────────────────────────────────── */

function HerplanModal({ opdracht, onClose, onOpgeslagen, onVerwijderd }: {
  opdracht: DbOpdracht;
  onClose: () => void;
  onOpgeslagen: (id: string, wijzigingen: Partial<DbOpdracht>) => void;
  onVerwijderd: (id: string) => void;
}) {
  const [datum, setDatum] = useState(opdracht.datum ?? '');
  const [datumOnbekend, setDatumOnbekend] = useState(!opdracht.datum);
  const [tijdStart, setTijdStart] = useState(opdracht.tijd_start?.slice(0, 5) ?? '');
  const [tijdEind, setTijdEind] = useState(opdracht.tijd_eind?.slice(0, 5) ?? '');
  const [tijdVastzetten, setTijdVastzetten] = useState(opdracht.tijd_vastzetten ?? false);
  const [monteurId, setMonteurId] = useState(opdracht.monteur_id ?? '');
  const [urgent, setUrgent] = useState(opdracht.urgent);
  const [prioriteit, setPrioriteit] = useState(opdracht.prioriteit);
  const [opslaan, setOpslaan] = useState(false);
  const [bevestigVerwijder, setBevestigVerwijder] = useState(false);

  const typeInfo = OPDRACHTTYPEN.find((t) => t.id === opdracht.type);

  async function opslaan_fn() {
    setOpslaan(true);
    const nieuweWaarden = {
      datum: datum || null,
      monteur_id: monteurId || null,
      urgent,
      prioriteit,
      tijd_start: tijdStart || null,
      tijd_eind: tijdEind || null,
      tijd_vastzetten: tijdVastzetten,
      updated_at: new Date().toISOString(),
    };
    await supabase.from('opdrachten').update(nieuweWaarden).eq('id', opdracht.id);
    setOpslaan(false);
    onOpgeslagen(opdracht.id, nieuweWaarden);
  }

  async function verwijderen() {
    await supabase.from('opdrachten').update({ deleted_at: new Date().toISOString() }).eq('id', opdracht.id);
    onVerwijderd(opdracht.id);
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md flex flex-col">
        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-100">
          <div className={`p-2 rounded-lg ${typeInfo?.kleur}`}>
            {typeInfo && <typeInfo.icon className="w-4 h-4" />}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-gray-900 truncate">{opdracht.locatie}</p>
            <p className="text-xs text-gray-400">{opdracht.id} · {typeInfo?.label}</p>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors">
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        <div className="px-5 py-4 space-y-4">
          {/* Datum */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
              Datum <span className="normal-case font-normal text-gray-400">(optioneel)</span>
            </label>
            <input
              type="date"
              value={datumOnbekend ? '' : datum}
              disabled={datumOnbekend}
              onChange={(e) => setDatum(e.target.value)}
              className={`w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 ${datumOnbekend ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : ''}`}
            />
            <label className="flex items-center gap-2 mt-1.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={datumOnbekend}
                onChange={(e) => { setDatumOnbekend(e.target.checked); if (e.target.checked) setDatum(''); }}
                className="w-3.5 h-3.5 accent-primary"
              />
              <span className="text-[11px] text-gray-500">Datum nog niet bekend</span>
            </label>
          </div>

          {/* Tijdstip */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
              Tijdstip <span className="normal-case font-normal text-gray-400">(optioneel)</span>
            </label>
            <div className="flex items-center gap-2">
              <input
                type="time"
                value={tijdStart}
                onChange={(e) => setTijdStart(e.target.value)}
                className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
              <span className="text-xs text-gray-400 flex-shrink-0">t/m</span>
              <input
                type="time"
                value={tijdEind}
                onChange={(e) => setTijdEind(e.target.value)}
                className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>
            <label className="flex items-center gap-2 mt-1.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={tijdVastzetten}
                onChange={(e) => setTijdVastzetten(e.target.checked)}
                className="w-3.5 h-3.5 accent-amber-500"
              />
              <span className="text-[11px] text-gray-500">
                Tijd vastzetten <span className="text-gray-400">(monteur kan volgorde niet wisselen)</span>
              </span>
            </label>
          </div>

          {/* Monteur */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Monteur</label>
            <select
              value={monteurId}
              onChange={(e) => setMonteurId(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none appearance-none"
            >
              <option value="">— Niet ingepland —</option>
              {MONTEURS.map((m) => <option key={m.id} value={m.id}>{m.naam}</option>)}
            </select>
            {!monteurId && (
              <p className="text-[11px] text-amber-600 mt-1 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" />
                Geen monteur geselecteerd — opdracht staat op &quot;niet gepland&quot;
              </p>
            )}
          </div>

          {/* Prioriteit + urgent */}
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Prioriteit</label>
              <select
                value={prioriteit}
                onChange={(e) => setPrioriteit(Number(e.target.value))}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none appearance-none"
              >
                <option value={1}>P1 — Hoog</option>
                <option value={2}>P2 — Middel</option>
                <option value={3}>P3 — Laag</option>
              </select>
            </div>
            <div className="flex items-end pb-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={urgent}
                  onChange={(e) => setUrgent(e.target.checked)}
                  className="w-4 h-4 accent-red-500"
                />
                <span className="text-sm text-gray-700 font-medium">Urgent</span>
              </label>
            </div>
          </div>

          {/* Adres info (readonly) */}
          <div className="bg-gray-50 rounded-lg px-3 py-2.5 text-xs text-gray-500 space-y-0.5">
            <p className="font-semibold text-gray-700">{opdracht.adres}, {opdracht.postcode} {opdracht.stad}</p>
            {opdracht.contactpersoon && <p>{opdracht.contactpersoon} · {opdracht.telefoon}</p>}
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 pb-5 space-y-2">
          <div className="flex gap-2">
            <button
              onClick={opslaan_fn}
              disabled={opslaan}
              className="flex-1 py-2.5 bg-[#F3A713] text-[#1A1A1A] text-sm font-bold rounded-xl hover:bg-[#D4900E] transition-colors disabled:opacity-60"
            >
              {opslaan ? 'Opslaan...' : '✓ Wijzigingen opslaan'}
            </button>
            <button onClick={onClose} className="px-4 py-2.5 border border-gray-200 text-gray-600 text-sm font-medium rounded-xl hover:bg-gray-50 transition-colors">
              Annuleer
            </button>
          </div>

          {/* Verwijderen */}
          {!bevestigVerwijder ? (
            <button
              onClick={() => setBevestigVerwijder(true)}
              className="w-full py-2 text-sm text-red-500 hover:text-red-700 hover:bg-red-50 rounded-xl transition-colors flex items-center justify-center gap-2"
            >
              <Trash2 className="w-4 h-4" />
              Opdracht verwijderen
            </button>
          ) : (
            <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
              <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0" />
              <span className="text-xs text-red-700 font-medium flex-1">Definitief verwijderen?</span>
              <button onClick={verwijderen} className="px-3 py-1 bg-red-600 text-white text-xs font-bold rounded-lg hover:bg-red-700">Ja, verwijder</button>
              <button onClick={() => setBevestigVerwijder(false)} className="px-3 py-1 bg-gray-200 text-gray-700 text-xs font-bold rounded-lg hover:bg-gray-300">Annuleer</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── Nieuwe Opdracht Modal ─────────────────────────────── */

function NieuweOpdrachtModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: (id: string) => void }) {
  const [stap, setStap] = useState(1);
  const [opslaan, setOpslaan] = useState(false);
  const [fout, setFout] = useState('');
  const [datumOnbekend, setDatumOnbekend] = useState(false);
  const [form, setForm] = useState({
    type: '', locatie: '', adres: '', postcode: '', stad: '',
    datum: '',
    prioriteit: 3, urgent: false, notitie: '',
    contactpersoon: '', telefoon: '', monteur_id: '',
  });
  const [kentekens, setKentekens] = useState<KentekenRij[]>([]);
  const [nieuweKenteken, setNieuweKenteken] = useState('');

  function stel(veld: string, waarde: unknown) { setForm((p) => ({ ...p, [veld]: waarde })); }

  function kiesLocatie(loc: VerhuurLocatie) {
    setForm((p) => ({ ...p, locatie: loc.naam, adres: loc.adres, postcode: loc.postcode, stad: loc.stad, contactpersoon: loc.contactpersoon, telefoon: loc.telefoon }));
  }

  function voegKentekenToe() {
    const k = nieuweKenteken.trim().toUpperCase();
    if (!k || kentekens.some((r) => r.kenteken === k)) return;
    setKentekens((p) => [...p, { kenteken: k, probleem: '' }]);
    setNieuweKenteken('');
  }

  async function indienen() {
    if (!form.type || !form.locatie || !form.adres || !form.postcode || !form.stad) {
      setFout('Vul alle verplichte velden in.'); return;
    }
    setFout(''); setOpslaan(true);
    const id = `OP-${Math.floor(1000 + Math.random() * 9000)}`;
    const { error } = await supabase.from('opdrachten').insert({
      id, type: form.type, status: 'ingepland', locatie: form.locatie,
      adres: form.adres, postcode: form.postcode, stad: form.stad,
      datum: form.datum || null,
      prioriteit: form.prioriteit, urgent: form.urgent,
      deadline: null, notitie: form.notitie, contactpersoon: form.contactpersoon,
      telefoon: form.telefoon, route_volgorde: 1,
      monteur_id: form.monteur_id || null, sleutel_ophalen: false,
    });
    if (error) { setFout(error.message); setOpslaan(false); return; }
    if (kentekens.length > 0) {
      await supabase.from('voertuigen').insert(kentekens.map((r) => ({ opdracht_id: id, kenteken: r.kenteken, kleur: '#345022', probleem: r.probleem })));
    }
    setOpslaan(false); onSuccess(id);
  }

  const stapEenOk = form.type && form.locatie && form.adres && form.postcode && form.stad;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[92vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Opdracht aanmaken</h2>
            <p className="text-xs text-gray-400">Stap {stap} van 2</p>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg"><X className="w-4 h-4 text-gray-500" /></button>
        </div>
        <div className="px-6 pt-3 pb-1 flex gap-2">
          {[1, 2].map((s) => <div key={s} className={`flex-1 h-1.5 rounded-full ${s <= stap ? 'bg-primary' : 'bg-gray-100'}`} />)}
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          {stap === 1 ? (
            <div className="space-y-5">
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Opdrachttype *</label>
                <div className="grid grid-cols-4 gap-2">
                  {OPDRACHTTYPEN.map((t) => (
                    <button key={t.id} type="button" onClick={() => stel('type', t.id)}
                      className={`p-2 rounded-lg border-2 text-center transition-all ${form.type === t.id ? 'border-primary bg-primary/10' : `border-transparent hover:border-primary/30 ${t.kleur}`}`}>
                      <t.icon className="w-4 h-4 mx-auto mb-1" />
                      <span className="text-[10px] font-semibold block">{t.label}</span>
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Verhuurlocatie</label>
                <LocatieDropdown locaties={VERHUURLOCATIES} geselecteerd={form.locatie} onKies={kiesLocatie} />
              </div>
              <div className="flex items-center gap-3">
                <div className="flex-1 h-px bg-gray-100" /><span className="text-xs text-gray-400">of vul handmatig in</span><div className="flex-1 h-px bg-gray-100" />
              </div>
              <Veld label="Locatienaam *" value={form.locatie} onChange={(v) => stel('locatie', v)} placeholder="Naam van het park / hotel" />
              <div className="grid grid-cols-2 gap-3">
                <Veld label="Adres *" value={form.adres} onChange={(v) => stel('adres', v)} placeholder="Straat 1" />
                <Veld label="Postcode *" value={form.postcode} onChange={(v) => stel('postcode', v)} placeholder="1234 AB" />
              </div>
              <Veld label="Stad *" value={form.stad} onChange={(v) => stel('stad', v)} placeholder="Amsterdam" />
              {fout && <FoutBanner tekst={fout} />}
            </div>
          ) : (
            <div className="space-y-4">
              {form.locatie && (
                <div className="flex items-center gap-3 bg-primary/5 border border-primary/20 rounded-xl px-4 py-3">
                  <Building2 className="w-4 h-4 text-primary flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-800">{form.locatie}</p>
                    <p className="text-xs text-gray-500">{form.adres}, {form.postcode} {form.stad}</p>
                  </div>
                  <button onClick={() => setStap(1)} className="text-xs text-primary font-medium hover:underline">Wijzig</button>
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                    Datum <span className="normal-case font-normal text-gray-400">(optioneel)</span>
                  </label>
                  <input
                    type="date"
                    value={datumOnbekend ? '' : form.datum}
                    disabled={datumOnbekend}
                    onChange={(e) => stel('datum', e.target.value)}
                    className={`w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 ${datumOnbekend ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : ''}`}
                  />
                  <label className="flex items-center gap-2 mt-1.5 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={datumOnbekend}
                      onChange={(e) => { setDatumOnbekend(e.target.checked); if (e.target.checked) stel('datum', ''); }}
                      className="w-3.5 h-3.5 accent-primary"
                    />
                    <span className="text-[11px] text-gray-500">Datum nog niet bekend</span>
                  </label>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Monteur</label>
                  <select value={form.monteur_id} onChange={(e) => stel('monteur_id', e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none appearance-none">
                    <option value="">— Nog in te plannen —</option>
                    {MONTEURS.map((m) => <option key={m.id} value={m.id}>{m.naam}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Prioriteit</label>
                  <select value={form.prioriteit} onChange={(e) => stel('prioriteit', Number(e.target.value))} className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none appearance-none">
                    <option value={1}>P1 — Hoog</option><option value={2}>P2 — Middel</option><option value={3}>P3 — Laag</option>
                  </select>
                </div>
                <div className="flex items-end pb-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={form.urgent} onChange={(e) => stel('urgent', e.target.checked)} className="w-4 h-4 accent-red-500" />
                    <span className="text-sm text-gray-700 font-medium">Urgent</span>
                  </label>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Veld label="Contactpersoon" value={form.contactpersoon} onChange={(v) => stel('contactpersoon', v)} placeholder="Naam" />
                <Veld label="Telefoon" value={form.telefoon} onChange={(v) => stel('telefoon', v)} placeholder="+31 6 ..." />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                  Voertuigen {kentekens.length > 0 && <span className="normal-case font-normal text-gray-400">({kentekens.length})</span>}
                </label>
                <div className="flex gap-2 mb-2">
                  <input type="text" value={nieuweKenteken} onChange={(e) => setNieuweKenteken(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); voegKentekenToe(); } }}
                    placeholder="Kenteken (bijv. EW-001-A)"
                    className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 uppercase placeholder:normal-case" />
                  <button type="button" onClick={voegKentekenToe} className="px-3 py-2 bg-primary text-white rounded-lg hover:bg-primary/90">
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
                {kentekens.length > 0 && (
                  <div className="border border-gray-200 rounded-xl overflow-hidden divide-y divide-gray-100">
                    {kentekens.map((rij) => (
                      <div key={rij.kenteken} className="flex items-center gap-3 px-3 py-2.5">
                        <span className="font-mono text-xs font-bold text-gray-700 bg-gray-100 px-2 py-1 rounded w-24 text-center flex-shrink-0">{rij.kenteken}</span>
                        <input type="text" value={rij.probleem} onChange={(e) => setKentekens((p) => p.map((r) => r.kenteken === rij.kenteken ? { ...r, probleem: e.target.value } : r))}
                          placeholder="Omschrijf het probleem..." className="flex-1 text-sm text-gray-700 placeholder:text-gray-400 bg-transparent focus:outline-none" />
                        <button type="button" onClick={() => setKentekens((p) => p.filter((r) => r.kenteken !== rij.kenteken))} className="p-1 hover:bg-red-50 rounded">
                          <Trash2 className="w-3.5 h-3.5 text-gray-400 hover:text-red-500" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Algemene notitie</label>
                <textarea value={form.notitie} onChange={(e) => stel('notitie', e.target.value)} rows={2}
                  placeholder="Extra informatie voor de monteur..."
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none" />
              </div>
              {fout && <FoutBanner tekst={fout} />}
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-gray-100 flex gap-3">
          {stap === 2 && <button onClick={() => setStap(1)} className="px-4 py-2 border border-gray-200 text-gray-600 text-sm font-medium rounded-lg hover:bg-gray-50">Terug</button>}
          <button
            onClick={stap === 1 ? () => { if (!stapEenOk) { setFout('Kies een type en vul de locatiegegevens in.'); return; } setFout(''); setStap(2); } : indienen}
            disabled={opslaan}
            className="flex-1 py-2 bg-[#F3A713] text-[#1A1A1A] text-sm font-semibold rounded-lg hover:bg-[#D4900E] disabled:opacity-60"
          >
            {opslaan ? 'Opslaan...' : stap === 1 ? 'Volgende →' : 'Opdracht aanmaken'}
          </button>
          <button onClick={onClose} className="px-4 py-2 border border-gray-200 text-gray-600 text-sm font-medium rounded-lg hover:bg-gray-50">Annuleren</button>
        </div>
      </div>
    </div>
  );
}

/* ─── Locatie Dropdown ──────────────────────────────────── */

function LocatieDropdown({ locaties, geselecteerd, onKies }: { locaties: VerhuurLocatie[]; geselecteerd: string; onKies: (loc: VerhuurLocatie) => void }) {
  const [zoek, setZoek] = useState('');
  const [open, setOpen] = useState(false);
  const gefilterd = locaties.filter((l) => l.naam.toLowerCase().includes(zoek.toLowerCase()) || l.stad.toLowerCase().includes(zoek.toLowerCase()) || l.postcode.includes(zoek));
  const geselecteerdeLoc = locaties.find((l) => l.naam === geselecteerd);
  return (
    <div className="relative">
      <button type="button" onClick={() => setOpen(!open)}
        className={`w-full flex items-center gap-2 px-3 py-2 text-sm border rounded-lg text-left ${open ? 'border-primary ring-2 ring-primary/20' : 'border-gray-200 hover:border-gray-300'}`}>
        <Building2 className="w-4 h-4 text-gray-400 flex-shrink-0" />
        {geselecteerdeLoc
          ? <span className="flex-1 font-medium text-gray-800">{geselecteerdeLoc.naam} <span className="font-normal text-gray-400 ml-1">{geselecteerdeLoc.stad}</span></span>
          : <span className="flex-1 text-gray-400">Kies een verhuurlocatie...</span>}
        <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute z-10 top-full mt-1 w-full bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden">
          <div className="p-2 border-b border-gray-100">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
              <input autoFocus type="text" placeholder="Zoek locatie..." value={zoek} onChange={(e) => setZoek(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:outline-none" />
            </div>
          </div>
          <div className="max-h-52 overflow-y-auto">
            {gefilterd.length === 0
              ? <div className="px-4 py-6 text-center text-sm text-gray-400">Geen locaties gevonden</div>
              : gefilterd.map((loc) => (
                <button key={loc.id} type="button" onClick={() => { onKies(loc); setOpen(false); setZoek(''); }}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-gray-50 ${geselecteerd === loc.naam ? 'bg-primary/5' : ''}`}>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800">{loc.naam}</p>
                    <p className="text-xs text-gray-400">{loc.adres}, {loc.postcode} {loc.stad}</p>
                  </div>
                  <span className="text-[10px] font-semibold text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">{loc.land}</span>
                  {geselecteerd === loc.naam && <CheckCircle className="w-4 h-4 text-primary flex-shrink-0" />}
                </button>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Kleine helpers ─────────────────────────────────────── */

function Veld({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">{label}</label>
      <input type="text" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
        className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" />
    </div>
  );
}

function FoutBanner({ tekst }: { tekst: string }) {
  return (
    <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm text-red-700">
      <AlertTriangle className="w-4 h-4 flex-shrink-0" />
      {tekst}
    </div>
  );
}

function PrioIndicator({ prio }: { prio: number }) {
  const colors = ['', 'bg-red-500', 'bg-orange-400', 'bg-blue-400'];
  const labels = ['', 'P1', 'P2', 'P3'];
  if (!prio) return null;
  return <span className={`text-[10px] font-bold text-white px-1 py-0.5 rounded ${colors[prio] ?? 'bg-gray-300'}`}>{labels[prio]}</span>;
}
