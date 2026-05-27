'use client';

import { useState, useEffect } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { supabase, type DbOpdracht, type DbMonteur } from '@/lib/supabase';
import MapComponent from '@/components/MapComponent';
import {
  Plus, Search, ChevronDown, ChevronUp, MapPin, Truck,
  Lock, Unlock, Sparkles, Calendar, AlertTriangle, Clock,
  Wrench, Battery, Bike, ArrowLeftRight, Zap, X, CheckCircle,
  Building2, Trash2, Pencil, CalendarClock, RotateCcw, Archive, GripVertical,
  Home, Navigation, Route,
} from 'lucide-react';

/* ─── Types ─────────────────────────────────────────────── */

type VerhuurLocatie = {
  id: string; naam: string; adres: string; postcode: string;
  stad: string; land: string; contactpersoon: string; telefoon: string;
  crediteurnummer: string | null; gesloten_dagen: number[];
};

type KentekenRij = { kenteken: string; probleem: string; voertuig_id?: string };

/* ─── Constanten ─────────────────────────────────────────── */


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


function formatDatum(d: string) {
  return new Date(d).toLocaleDateString('nl-NL', { weekday: 'short', day: 'numeric', month: 'short' });
}

/* ─── Hoofdpagina ────────────────────────────────────────── */

function huidigeWeekDagen(offsetWeken = 0) {
  const nu = new Date();
  const dow = nu.getDay();
  const diffNaarMa = dow === 0 ? -6 : 1 - dow;
  const ma = new Date(nu);
  ma.setDate(nu.getDate() + diffNaarMa + offsetWeken * 7);
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
  const [bewerkOpdracht, setBewerkOpdracht] = useState<DbOpdracht | null>(null);
  const [ontgrendeld, setOntgrendeld] = useState<Set<string>>(new Set());

  const [monteurs, setMonteurs] = useState<DbMonteur[]>([]);
  const [opdrachten, setOpdrachten] = useState<DbOpdracht[]>([]);
  const [laden, setLaden] = useState(true);
  const [succesBericht, setSuccesBericht] = useState('');
  const [foutBericht, setFoutBericht] = useState('');
  const [slepenId, setSlepenId] = useState<string | null>(null);
  const [sleepDoel, setSleepDoel] = useState<string | null>(null); // datum of 'geen-datum'
  const [routeGeometry, setRouteGeometry] = useState<any>(null);
  const [selectedDag, setSelectedDag] = useState<{ monteurId: string; datum: string } | null>(null);
  const [dagVanuitHuis, setDagVanuitHuis] = useState<Record<string, boolean>>({});
  const [dagRoute, setDagRoute] = useState<{ stops: any[]; startPunt: any; geometry: any; km_totaal: number; uren_totaal: number } | null>(null);
  const [dagRouteLaden, setDagRouteLaden] = useState(false);
  const [showConceptModal, setShowConceptModal] = useState(false);
  const [sorteer, setSorteer] = useState<'aanmaak' | 'postcode' | 'prioriteit' | 'locatie'>('aanmaak');
  const [geslotenDagenMap, setGeslotenDagenMap] = useState<Record<string, number[]>>({});
  const [geslotenDropPending, setGeslotenDropPending] = useState<{ opdrachtId: string; datum: string; monteurId: string | null } | null>(null);
  const [weekOffset, setWeekOffset] = useState(0);
  const weekDagen = huidigeWeekDagen(weekOffset);

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

  function monteurNaam(id: string | null) {
    return monteurs.find((m) => m.id === id) ? `${monteurs.find((m) => m.id === id)!.voornaam} ${monteurs.find((m) => m.id === id)!.naam}` : null;
  }

  async function laadOpdrachten() {
    setLaden(true);
    const [{ data: opData }, { data: mData }, { data: rData }] = await Promise.all([
      supabase.from('opdrachten').select('*, voertuigen(*), pech_stops(*)').is('deleted_at', null).order('created_at', { ascending: false }),
      supabase.from('monteurs').select('*').order('naam'),
      supabase.from('relaties').select('naam, gesloten_dagen').is('deleted_at', null),
    ]);
    if (opData) setOpdrachten(opData as DbOpdracht[]);
    if (mData) setMonteurs(mData as DbMonteur[]);
    if (rData) {
      const map: Record<string, number[]> = {};
      for (const r of rData as { naam: string; gesloten_dagen: number[] | null }[]) {
        if (r.gesloten_dagen && r.gesloten_dagen.length > 0)
          map[r.naam.toLowerCase().trim()] = r.gesloten_dagen;
      }
      setGeslotenDagenMap(map);
    }
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

  async function slaOpdrachtDatumOp(opdrachtId: string, nieuwDatum: string | null, nieuwMonteurId?: string | null) {
    const updates: Partial<DbOpdracht> = { datum: nieuwDatum, updated_at: new Date().toISOString() };
    if (nieuwMonteurId !== undefined) updates.monteur_id = nieuwMonteurId ?? null;
    if (nieuwDatum === null) updates.status = 'afgerond';
    const { error } = await supabase.from('opdrachten').update(updates).eq('id', opdrachtId);
    if (!error) {
      setOpdrachten((p) => p.map((o) => o.id === opdrachtId ? { ...o, ...updates } : o));
      const monteur = nieuwMonteurId ? monteurNaam(nieuwMonteurId) : null;
      const label = nieuwDatum ? formatDatum(nieuwDatum) : 'onbekende datum';
      toonSucces(monteur ? `Verplaatst naar ${monteur} · ${label}` : nieuwDatum ? `Verplaatst naar ${label}` : 'Opdracht vrijgemaakt — geen datum of monteur');
    }
  }

  async function verplaatsOpdracht(opdrachtId: string, nieuwDatum: string | null, nieuwMonteurId?: string | null) {
    setSlepenId(null);
    setSleepDoel(null);

    const op = opdrachten.find((o) => o.id === opdrachtId);
    if (op?.status === 'uitgevoerd' || op?.status === 'afgerond') {
      toonFout(`Opdracht ${opdrachtId} is afgerond en kan niet worden verplaatst — maak een nieuwe opdracht aan.`);
      return;
    }

    // Controleer of de locatie op de doeldatum gesloten is
    if (nieuwDatum && op?.locatie) {
      const dag = new Date(nieuwDatum + 'T12:00:00').getDay();
      const { data: r } = await supabase.from('relaties').select('gesloten_dagen').ilike('naam', op.locatie).maybeSingle();
      const gesloten: number[] = r?.gesloten_dagen ?? [];
      if (gesloten.length > 0 && gesloten.includes(dag)) {
        setGeslotenDropPending({ opdrachtId, datum: nieuwDatum, monteurId: nieuwMonteurId ?? null });
        return;
      }
    }

    await slaOpdrachtDatumOp(opdrachtId, nieuwDatum, nieuwMonteurId);
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


  async function optimaliseerRoute(monteurId: string, datum: string) {
    const dagOps = opdrachten.filter((o) => o.monteur_id === monteurId && o.datum === datum);
    if (dagOps.length < 2) {
      alert('Minimaal 2 opdrachten nodig om te optimaliseren.');
      return;
    }

    setLaden(true);
    try {
      const res = await fetch('/api/optimize-route', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          locations: dagOps.map(op => ({
            id: op.id,
            adres: op.adres,
            postcode: op.postcode,
            stad: op.stad,
            lat: op.pech_stops?.[0]?.lat,
            lng: op.pech_stops?.[0]?.lng
          }))
        })
      });
      const data = await res.json();
      if (data.order) {
        const updates = data.order.map((id: string, index: number) => 
          supabase.from('opdrachten').update({ route_volgorde: index + 1 }).eq('id', id)
        );
        await Promise.all(updates);
        
        setOpdrachten((prev) => prev.map(op => {
          const newIndex = data.order.indexOf(op.id);
          if (newIndex !== -1) return { ...op, route_volgorde: newIndex + 1 };
          return op;
        }));
        
        if (data.geometry) setRouteGeometry(data.geometry);
        toonSucces(`Route geoptimaliseerd voor ${monteurNaam(monteurId)}`);
      } else {
        alert('Fout bij optimaliseren: ' + (data.error || 'onbekend'));
      }
    } catch (err) {
      console.error(err);
      alert('Er is een fout opgetreden.');
    } finally {
      setLaden(false);
    }
  }

  useEffect(() => {
    if (!selectedDag) { setDagRoute(null); return; }
    laadDagRoute(selectedDag.monteurId, selectedDag.datum);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDag, dagVanuitHuis]);

  async function laadDagRoute(monteurId: string, datum: string) {
    setDagRouteLaden(true);
    try {
      const key = `${monteurId}_${datum}`;
      const vanuit_huis = dagVanuitHuis[key] ?? false;
      const res = await fetch('/api/route-dag', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ monteur_id: monteurId, datum, vanuit_huis }),
      });
      const data = await res.json();
      setDagRoute(data);
      if (data.geometry) setRouteGeometry(data.geometry);
    } catch {
      setDagRoute(null);
    }
    setDagRouteLaden(false);
  }

  function toonSucces(tekst: string) {
    setSuccesBericht(tekst);
    setTimeout(() => setSuccesBericht(''), 4000);
  }

  function toonFout(tekst: string) {
    setFoutBericht(tekst);
    setTimeout(() => setFoutBericht(''), 6000);
  }

  function toggleLock(id: string) {
    setOntgrendeld((prev) => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  }

  const alleNietUitgevoerd = opdrachten.filter((o) => o.status !== 'uitgevoerd');
  const alleAfgerond = opdrachten.filter((o) => o.status === 'uitgevoerd' || o.status === 'afgerond');

  function sorteerLijst(lijst: DbOpdracht[]) {
    return [...lijst].sort((a, b) => {
      if (sorteer === 'postcode') return (a.postcode ?? '').localeCompare(b.postcode ?? '');
      if (sorteer === 'prioriteit') return (a.prioriteit ?? 3) - (b.prioriteit ?? 3);
      if (sorteer === 'locatie') return (a.locatie ?? '').localeCompare(b.locatie ?? '', 'nl');
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
  }

  const gefilterd = sorteerLijst(
    planFilter === 'afgerond'
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
        })
  );

  const aantalGepland = alleNietUitgevoerd.filter((o) => !!o.monteur_id).length;
  const aantalNietGepland = alleNietUitgevoerd.filter((o) => !o.monteur_id).length;

  return (
    <DashboardLayout
      title="Planning & Opdrachten"
      actions={
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowConceptModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-semibold shadow-sm hover:bg-purple-700 active:scale-95 transition-all"
          >
            <Sparkles className="w-4 h-4" />
            Concept planning
          </button>
          <button
            onClick={() => setShowNieuwModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-[#F3A713] text-[#1A1A1A] rounded-lg text-sm font-semibold shadow-sm hover:bg-[#D4900E] active:scale-95 transition-all"
          >
            <Plus className="w-4 h-4" />
            Opdracht aanmaken
          </button>
        </div>
      }
    >
      {/* Succes toast */}
      {succesBericht && (
        <div className="fixed top-4 right-4 z-50 flex items-center gap-2 bg-green-600 text-white px-4 py-3 rounded-xl shadow-lg text-sm font-medium">
          <CheckCircle className="w-4 h-4" />
          {succesBericht}
        </div>
      )}

      {/* Fout toast */}
      {foutBericht && (
        <div className="fixed top-4 right-4 z-50 flex items-center gap-2 bg-red-600 text-white px-4 py-3 rounded-xl shadow-lg text-sm font-medium max-w-sm">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          <span>{foutBericht}</span>
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
              <div className="relative">
                <select
                  value={sorteer}
                  onChange={(e) => setSorteer(e.target.value as typeof sorteer)}
                  className="w-full appearance-none pl-2 pr-6 py-1.5 text-xs border border-gray-200 rounded-lg bg-gray-50 focus:outline-none"
                >
                  <option value="aanmaak">Datum aanmaak</option>
                  <option value="locatie">Locatie (A→Z)</option>
                  <option value="postcode">Postcode (A→Z)</option>
                  <option value="prioriteit">Prioriteit</option>
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
                  const gedaanTeksten = (op.voertuigen ?? []).filter((v) => v.gedaan).map((v) => ({ kenteken: v.kenteken, gedaan: v.gedaan as string }));
                  const heeftNotes = !!op.notitie?.trim() || gedaanTeksten.length > 0;
                  return (
                    <div
                      key={op.id}
                      className="bg-green-50 border border-green-200 border-l-[3px] border-l-green-500 rounded-lg p-2.5 cursor-pointer hover:bg-green-100/60 transition-colors"
                      onClick={() => setHerplanOpdracht(op)}
                    >
                      <div className="flex items-start gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 mb-1">
                            <CheckCircle className="w-3 h-3 text-green-600 flex-shrink-0" />
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
                          {heeftNotes && (
                            <div className="mt-1.5 pt-1.5 border-t border-green-200 space-y-1">
                              {op.notitie?.trim() && (
                                <p className="text-[10px] text-green-800 italic line-clamp-2 leading-relaxed">{op.notitie.trim()}</p>
                              )}
                              {gedaanTeksten.map((g, i) => (
                                <p key={i} className="text-[10px] text-green-700 line-clamp-1">
                                  <span className="font-semibold">{g.kenteken}:</span> {g.gedaan}
                                </p>
                              ))}
                            </div>
                          )}
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
                    draggable
                    onDragStart={(e) => { e.dataTransfer.setData('opdrachtId', op.id); e.dataTransfer.effectAllowed = 'move'; setSlepenId(op.id); }}
                    onDragEnd={() => { setSlepenId(null); setSleepDoel(null); }}
                    className={`relative bg-white border rounded-lg p-2.5 hover:shadow-sm transition-all group cursor-grab active:cursor-grabbing select-none ${
                      slepenId === op.id ? 'opacity-40 scale-95' : ''
                    } ${isGepland ? 'border-l-[3px] border-l-primary border-gray-200' : 'border-l-[3px] border-l-amber-400 border-gray-200'}`}
                    onClick={() => setHerplanOpdracht(op)}
                  >
                    <div className="flex items-start gap-2">
                      <GripVertical className="w-3 h-3 text-gray-300 flex-shrink-0 mt-0.5" />
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
                        {op.notitie?.trim() && (
                          <p className="text-[10px] text-gray-500 italic mt-1 line-clamp-2 leading-relaxed">{op.notitie.trim()}</p>
                        )}
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
                        </>
                      ) : (
                        <>
                          <div className="w-1.5 h-1.5 rounded-full bg-amber-400 flex-shrink-0" />
                          <span className="text-[10px] text-amber-600 font-semibold">Niet gepland</span>
                        </>
                      )}
                      <button
                        onClick={(e) => { e.stopPropagation(); setBewerkOpdracht(op); }}
                        className="ml-auto p-0.5 hover:bg-gray-100 rounded transition-colors"
                        title="Volledig bewerken"
                      >
                        <Pencil className="w-2.5 h-2.5 text-gray-300 hover:text-primary transition-colors" />
                      </button>
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
          <div className={`bg-white rounded-xl border border-gray-200 flex-shrink-0 overflow-hidden transition-all ${kaartIngeklapt ? 'h-10' : 'h-[350px]'}`}>
            <div
              className="flex items-center justify-between px-4 h-10 cursor-pointer hover:bg-gray-50 transition-colors"
              onClick={() => setKaartIngeklapt(!kaartIngeklapt)}
            >
              <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
                <MapPin className="w-4 h-4 text-gray-400" />
                {selectedDag ? (
                  <span className="flex items-center gap-1.5">
                    <Route className="w-3.5 h-3.5 text-purple-500" />
                    <span className="text-purple-700 font-semibold">
                      {monteurs.find(m => m.id === selectedDag.monteurId)?.voornaam} · {new Date(selectedDag.datum).toLocaleDateString('nl-NL', { weekday: 'short', day: 'numeric', month: 'short' })}
                    </span>
                    {dagRouteLaden && <span className="text-xs text-gray-400 animate-pulse">Laden...</span>}
                    {dagRoute && !dagRouteLaden && (
                      <span className="flex items-center gap-2 text-xs text-gray-500 ml-1">
                        <span className="font-semibold text-gray-700">{dagRoute.km_totaal} km</span>
                        <span>·</span>
                        <span className="font-semibold text-gray-700">{dagRoute.uren_totaal}u</span>
                        <span>·</span>
                        <span>{dagRoute.stops.length} stops</span>
                      </span>
                    )}
                    <button onClick={(e) => { e.stopPropagation(); setSelectedDag(null); setDagRoute(null); setRouteGeometry(null); }}
                      className="ml-1 p-0.5 hover:bg-gray-200 rounded transition-colors">
                      <X className="w-3 h-3 text-gray-500" />
                    </button>
                  </span>
                ) : (
                  <span>Kaart — klik op een dag om route te zien</span>
                )}
              </div>
              {kaartIngeklapt ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronUp className="w-4 h-4 text-gray-400" />}
            </div>
            {!kaartIngeklapt && (
              <div className="h-[310px] w-full bg-gray-50">
                <MapComponent
                  locations={
                    selectedDag && dagRoute?.stops.length
                      ? [
                          { id: 'start', lat: dagRoute.startPunt.lat, lng: dagRoute.startPunt.lng, label: '0' },
                          ...dagRoute.stops.map((s: any) => ({ id: s.id, lat: s.lat, lng: s.lng, label: s.label })),
                        ]
                      : opdrachten
                          .filter((o) => o.pech_stops?.[0]?.lat && o.pech_stops?.[0]?.lng)
                          .map((o, i) => ({
                            id: o.id,
                            lat: o.pech_stops![0].lat!,
                            lng: o.pech_stops![0].lng!,
                            label: (i + 1).toString(),
                          }))
                  }
                  routeGeometry={routeGeometry}
                  onMarkerClick={(id) => {
                    if (id === 'start') return;
                    const op = opdrachten.find((o) => o.id === id);
                    if (op) setHerplanOpdracht(op);
                  }}
                />
              </div>
            )}
          </div>

          {/* Week navigatie */}
          <div className="flex items-center justify-between bg-white rounded-xl border border-gray-200 px-3 py-2 flex-shrink-0">
            <button
              onClick={() => setWeekOffset((w) => w - 1)}
              className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ChevronDown className="w-3.5 h-3.5 rotate-90" />
              Vorige week
            </button>
            <div className="text-center">
              <p className="text-xs font-bold text-gray-800">
                {weekDagen[0].dagNr} {weekDagen[0].maand} – {weekDagen[4].dagNr} {weekDagen[4].maand}
              </p>
              <p className="text-[10px] text-gray-400">
                Week {Math.ceil((new Date(weekDagen[0].datum).getTime() - new Date(new Date(weekDagen[0].datum).getFullYear(), 0, 1).getTime()) / (7 * 24 * 60 * 60 * 1000)) + 1}
                {weekOffset !== 0 && (
                  <button onClick={() => setWeekOffset(0)} className="ml-2 text-primary underline font-semibold">
                    Terug naar huidig
                  </button>
                )}
              </p>
            </div>
            <button
              onClick={() => setWeekOffset((w) => w + 1)}
              className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            >
              Volgende week
              <ChevronDown className="w-3.5 h-3.5 -rotate-90" />
            </button>
          </div>

          {/* Monteur agendas */}
          <div className="flex-1 overflow-y-auto space-y-2">
            {monteurs.map((monteur) => {
              const isOpen = !!uitgeklapt[monteur.id];
              // Alleen met datum in de weekgrid; zonder datum staat in de linkerkolom
              const monteurOpdrachten = opdrachten.filter((o) => o.monteur_id === monteur.id && o.status !== 'uitgevoerd' && o.status !== 'afgerond' && o.datum);
              const monteurAfgerond = opdrachten.filter((o) => o.monteur_id === monteur.id && (o.status === 'uitgevoerd' || o.status === 'afgerond') && o.datum);
              const vollNaam = `${monteur.voornaam} ${monteur.naam}`;
              return (
                <div key={monteur.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                  {/* Monteur header */}
                  <div
                    className="flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-gray-50/60 transition-colors"
                    onClick={() => setUitgeklapt((prev) => ({ ...prev, [monteur.id]: !prev[monteur.id] }))}
                  >
                    <div className="w-7 h-7 rounded-full bg-primary/10 text-primary font-bold text-xs flex items-center justify-center flex-shrink-0">
                      {`${monteur.voornaam[0] ?? ''}${monteur.naam[0] ?? ''}`.toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-semibold text-gray-800">{vollNaam}</span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-gray-400">
                      <span className="flex items-center gap-1"><Truck className="w-3.5 h-3.5" />{monteur.bus_capaciteit}</span>
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
                        {weekDagen.map((wd) => {
                          const dagOps = monteurOpdrachten.filter((o) => o.datum === wd.datum);
                          const dagOpsAfgerond = monteurAfgerond.filter((o) => o.datum === wd.datum);
                          const isVandaag = wd.datum === VANDAAG;
                          const isDoel = sleepDoel === `${monteur.id}::${wd.datum}` && slepenId !== null;
                          const isGeselecteerd = selectedDag?.monteurId === monteur.id && selectedDag?.datum === wd.datum;
                          const dagKey = `${monteur.id}_${wd.datum}`;
                          const vanuitHuis = dagVanuitHuis[dagKey] ?? false;
                          return (
                            <div
                              key={wd.datum}
                              className={`p-2 min-h-[100px] transition-colors ${
                                isGeselecteerd
                                  ? 'bg-purple-50 ring-2 ring-purple-300 ring-inset'
                                  : isDoel
                                  ? 'bg-primary/10 ring-2 ring-primary/40 ring-inset'
                                  : isVandaag ? 'bg-primary/5' : 'bg-white'
                              }`}
                              onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; setSleepDoel(`${monteur.id}::${wd.datum}`); }}
                              onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setSleepDoel(null); }}
                              onDrop={(e) => { e.preventDefault(); const id = e.dataTransfer.getData('opdrachtId'); if (id) verplaatsOpdracht(id, wd.datum, monteur.id); }}
                            >
                              {/* Dag header */}
                              <div
                                className={`flex items-center gap-1 mb-2 pb-1.5 border-b cursor-pointer select-none ${isVandaag ? 'border-primary/25' : 'border-gray-100'} ${isGeselecteerd ? 'border-purple-200' : ''}`}
                                onClick={() => {
                                  if (isGeselecteerd) { setSelectedDag(null); setDagRoute(null); setRouteGeometry(null); }
                                  else if (dagOps.length > 0) setSelectedDag({ monteurId: monteur.id, datum: wd.datum });
                                }}
                                title={dagOps.length > 0 ? 'Klik om route te zien' : ''}
                              >
                                <span className={`text-[10px] font-bold uppercase tracking-wide ${isVandaag ? 'text-primary' : isGeselecteerd ? 'text-purple-600' : 'text-gray-400'}`}>
                                  {wd.kort}
                                </span>
                                <span className={`text-base font-black leading-none ${isVandaag ? 'text-primary' : isGeselecteerd ? 'text-purple-700' : 'text-gray-600'}`}>
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
                                {!isVandaag && dagOps.length > 0 && (
                                  <button
                                    onClick={(e) => { e.stopPropagation(); setDagVanuitHuis(p => ({ ...p, [dagKey]: !vanuitHuis })); if (isGeselecteerd) laadDagRoute(monteur.id, wd.datum); }}
                                    title={vanuitHuis ? 'Vertrekt vanuit huis' : 'Vertrekt vanuit loods'}
                                    className={`ml-auto p-0.5 rounded transition-colors ${vanuitHuis ? 'text-blue-600 bg-blue-100' : 'text-gray-300 hover:text-gray-400'}`}
                                  >
                                    <Home className="w-3 h-3" />
                                  </button>
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
                                {/* Afgeronde opdrachten — dimmed, niet sleepbaar */}
                                {dagOpsAfgerond.map((op) => {
                                  const typeInfo = OPDRACHTTYPEN.find((t) => t.id === op.type);
                                  const gedaanTeksten = (op.voertuigen ?? [])
                                    .filter((v) => v.gedaan)
                                    .map((v) => v.gedaan as string);
                                  const samenvatting = op.notitie?.trim() || gedaanTeksten[0] || null;
                                  return (
                                    <div
                                      key={op.id}
                                      onClick={() => setHerplanOpdracht(op)}
                                      className="rounded p-1.5 text-[10px] border border-green-200 bg-green-50 opacity-60 hover:opacity-90 transition-opacity cursor-pointer"
                                    >
                                      <div className="flex items-center gap-1 min-w-0">
                                        <CheckCircle className="w-2.5 h-2.5 text-green-600 flex-shrink-0" />
                                        <span className="font-semibold truncate flex-1 text-green-900">{op.locatie}</span>
                                        <span className={`px-1 py-0.5 rounded text-[9px] font-semibold shrink-0 ${typeInfo?.kleur}`}>
                                          {typeInfo?.label}
                                        </span>
                                      </div>
                                      {samenvatting ? (
                                        <p className="text-[9px] text-green-700 mt-0.5 pl-3.5 line-clamp-2 italic leading-tight">{samenvatting}</p>
                                      ) : (
                                        <p className="text-[9px] text-green-500 mt-0.5 pl-3.5 italic">Afgerond ✓</p>
                                      )}
                                      {gedaanTeksten.length > 1 && (
                                        <p className="text-[9px] text-green-500 mt-0.5 pl-3.5">+{gedaanTeksten.length - 1} voertuig{gedaanTeksten.length > 2 ? 'en' : ''}</p>
                                      )}
                                    </div>
                                  );
                                })}

                                {dagOps.length === 0 && dagOpsAfgerond.length === 0 && (
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
                          onDrop={(e) => { e.preventDefault(); const id = e.dataTransfer.getData('opdrachtId'); if (id) verplaatsOpdracht(id, null, null); }}
                        >
                          <p className="text-[10px] font-bold text-amber-600 uppercase flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {sleepDoel === 'geen-datum' ? '↓ Loslaten = vrijmaken (geen datum + geen monteur)' : 'Sleep hierheen om vrij te maken'}
                          </p>
                        </div>
                      )}

                      {monteurOpdrachten.length === 0 && (
                        <div className="px-4 py-4 text-xs text-gray-400 text-center">Geen opdrachten ingepland deze week</div>
                      )}

                      {/* Routeoptimalisatie footer */}
                      <div className="px-3 py-2 bg-gray-50/60 border-t border-gray-100 flex items-center gap-2">
                        <Navigation className="w-3.5 h-3.5 text-gray-400" />
                        <span className="text-xs text-gray-400 flex-1">Klik op een dag om route te bekijken</span>
                        <button
                          onClick={() => {
                            const dagMetOps = weekDagen.find(wd => opdrachten.some(o => o.monteur_id === monteur.id && o.datum === wd.datum));
                            if (dagMetOps) optimaliseerRoute(monteur.id, dagMetOps.datum);
                          }}
                          className="flex items-center gap-1 text-xs font-medium text-gray-500 hover:text-purple-600 px-2 py-1 rounded hover:bg-purple-50 transition-colors"
                        >
                          <Sparkles className="w-3 h-3" />
                          Optimaliseer
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
      {showConceptModal && (
        <ConceptPlanningModal
          monteurs={monteurs}
          datumVanInit={weekDagen[0].datum}
          datumTotInit={weekDagen[4].datum}
          onClose={() => setShowConceptModal(false)}
          onToegepast={(toegepast) => {
            setShowConceptModal(false);
            laadOpdrachten();
            toonSucces(`${toegepast} opdrachten ingepland`);
          }}
        />
      )}

      {showNieuwModal && (
        <NieuweOpdrachtModal
          monteurs={monteurs}
          onClose={() => setShowNieuwModal(false)}
          onSuccess={(id) => { setShowNieuwModal(false); toonSucces(`Opdracht ${id} aangemaakt`); }}
        />
      )}

      {herplanOpdracht && (
        <HerplanModal
          monteurs={monteurs}
          opdracht={herplanOpdracht}
          onClose={() => setHerplanOpdracht(null)}
          onNieuweOpdracht={() => { setHerplanOpdracht(null); setShowNieuwModal(true); }}
          onOpgeslagen={(id, wijzigingen) => {
            setOpdrachten((p) => p.map((o) => o.id === id ? { ...o, ...wijzigingen } : o));
            setHerplanOpdracht(null);
            toonSucces(`Opdracht ${id} bijgewerkt`);
          }}
          onVerwijderd={(id) => { setHerplanOpdracht(null); toonSucces(`Opdracht ${id} verwijderd`); }}
          onBewerken={() => { setBewerkOpdracht(herplanOpdracht); setHerplanOpdracht(null); }}
        />
      )}

      {bewerkOpdracht && (
        <BewerkOpdrachtModal
          monteurs={monteurs}
          opdracht={bewerkOpdracht}
          onClose={() => setBewerkOpdracht(null)}
          onOpgeslagen={(id, bijgewerkt) => {
            setOpdrachten((p) => p.map((o) => o.id === id ? { ...o, ...bijgewerkt } : o));
            setBewerkOpdracht(null);
            toonSucces(`Opdracht ${id} opgeslagen`);
          }}
          onVerwijderd={(id) => { setBewerkOpdracht(null); toonSucces(`Opdracht ${id} verwijderd`); }}
        />
      )}

      {geslotenDropPending && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
            <div className="p-5 border-b border-gray-100 flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-orange-100 flex items-center justify-center flex-shrink-0">
                <AlertTriangle className="w-5 h-5 text-orange-500" />
              </div>
              <div>
                <p className="font-semibold text-gray-900 text-sm">Locatie gesloten op deze dag</p>
                <p className="text-xs text-gray-500 mt-0.5">Wil je de opdracht toch verplaatsen naar {formatDatum(geslotenDropPending.datum)}?</p>
              </div>
            </div>
            <div className="p-4 space-y-2">
              <button
                onClick={() => setGeslotenDropPending(null)}
                className="w-full text-left px-3 py-2.5 bg-orange-50 border border-orange-200 rounded-xl text-sm font-medium text-orange-700 hover:bg-orange-100 transition-colors"
              >
                1. Nee, ik plan hem later opnieuw in.
              </button>
              <button
                onClick={() => setGeslotenDropPending(null)}
                className="w-full text-left px-3 py-2.5 bg-orange-50 border border-orange-200 rounded-xl text-sm font-medium text-orange-700 hover:bg-orange-100 transition-colors"
              >
                2. Ja, graag (sleep naar een andere datum).
              </button>
              <button
                onClick={async () => {
                  const { opdrachtId, datum, monteurId } = geslotenDropPending;
                  setGeslotenDropPending(null);
                  await slaOpdrachtDatumOp(opdrachtId, datum, monteurId ?? undefined);
                }}
                className="w-full text-left px-3 py-2.5 bg-white border border-gray-200 rounded-xl text-sm font-medium text-gray-500 hover:bg-gray-50 transition-colors"
              >
                3. Nee, plan de opdracht tóch op deze dag.
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}

/* ─── Gesloten dag helpers ───────────────────────────────── */

function isDagGesloten(locatieNaam: string, datum: string, map: Record<string, number[]>): boolean {
  if (!datum || !locatieNaam) return false;
  const gesloten = map[locatieNaam.toLowerCase().trim()];
  if (!gesloten || gesloten.length === 0) return false;
  return gesloten.includes(new Date(datum + 'T12:00:00').getDay());
}

function GeslotenDagMelding({ onPlanLater, onVerplaats, onTochPlannen }: {
  onPlanLater: () => void;
  onVerplaats: () => void;
  onTochPlannen: () => void;
}) {
  return (
    <div className="mt-2 p-3 bg-orange-50 border border-orange-200 rounded-xl">
      <div className="flex items-start gap-2 mb-2.5">
        <AlertTriangle className="w-4 h-4 text-orange-500 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-xs font-semibold text-orange-800">Op deze dag is de verhuurlocatie gesloten.</p>
          <p className="text-xs text-orange-600 mt-0.5">Wil je hem verplaatsen naar een ander moment?</p>
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <button type="button" onClick={onPlanLater} className="w-full text-left px-2.5 py-1.5 bg-white border border-orange-200 rounded-lg hover:bg-orange-50 text-[11px] font-medium text-orange-700 transition-colors">
          1. Nee, ik plan hem later opnieuw in.
        </button>
        <button type="button" onClick={onVerplaats} className="w-full text-left px-2.5 py-1.5 bg-white border border-orange-200 rounded-lg hover:bg-orange-50 text-[11px] font-medium text-orange-700 transition-colors">
          2. Ja, graag (kies een andere datum hieronder).
        </button>
        <button type="button" onClick={onTochPlannen} className="w-full text-left px-2.5 py-1.5 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 text-[11px] font-medium text-gray-500 transition-colors">
          3. Nee, plan de opdracht tóch op deze dag.
        </button>
      </div>
    </div>
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

function HerplanModal({ monteurs, opdracht, onClose, onOpgeslagen, onVerwijderd, onBewerken, onNieuweOpdracht }: {
  monteurs: DbMonteur[];
  opdracht: DbOpdracht;
  onClose: () => void;
  onOpgeslagen: (id: string, wijzigingen: Partial<DbOpdracht>) => void;
  onVerwijderd: (id: string) => void;
  onBewerken: () => void;
  onNieuweOpdracht?: () => void;
}) {
  const [datum, setDatum] = useState(opdracht.datum ?? '');
  const [datumOnbekend, setDatumOnbekend] = useState(!opdracht.datum);
  const [geslotenWaarschuwing, setGeslotenWaarschuwing] = useState(false);
  const [pendingDatum, setPendingDatum] = useState('');
  const [geslotenDagen, setGeslotenDagen] = useState<number[]>([]);

  useEffect(() => {
    supabase.from('relaties').select('gesloten_dagen').ilike('naam', opdracht.locatie).maybeSingle()
      .then(({ data }) => { if (data?.gesloten_dagen) setGeslotenDagen(data.gesloten_dagen); });
  }, [opdracht.locatie]);
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

  if (opdracht.status === 'uitgevoerd' || opdracht.status === 'afgerond') {
    const gedaanVoertuigen = (opdracht.voertuigen ?? []).filter((v) => v.gedaan);
    const heeftNotes = !!opdracht.notitie?.trim() || gedaanVoertuigen.length > 0;
    return (
      <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm flex flex-col overflow-hidden">
          {/* Header */}
          <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-100">
            <div className="w-9 h-9 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
              <CheckCircle className="w-5 h-5 text-green-600" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-gray-900 truncate">{opdracht.locatie}</p>
              <p className="text-xs text-gray-400">{opdracht.id} · {typeInfo?.label} · Afgerond</p>
            </div>
            <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors">
              <X className="w-4 h-4 text-gray-500" />
            </button>
          </div>

          <div className="px-5 py-4 space-y-4 overflow-y-auto max-h-[60vh]">
            {/* Info rij */}
            <div className="bg-gray-50 rounded-lg px-3 py-2.5 text-xs text-gray-500 space-y-0.5">
              <p className="font-semibold text-gray-700">{opdracht.adres}, {opdracht.postcode} {opdracht.stad}</p>
              {opdracht.datum && <p>Datum: {formatDatum(opdracht.datum)}</p>}
              {opdracht.contactpersoon && <p>{opdracht.contactpersoon} · {opdracht.telefoon}</p>}
              {opdracht.km_gereden != null && <p>{opdracht.km_gereden} km gereden</p>}
            </div>

            {/* Monteur opmerkingen */}
            {heeftNotes ? (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Opmerkingen monteur</p>
                {opdracht.notitie?.trim() && (
                  <div className="bg-green-50 border border-green-200 rounded-lg px-3 py-2.5 text-xs text-green-800 leading-relaxed whitespace-pre-wrap">
                    {opdracht.notitie.trim()}
                  </div>
                )}
                {gedaanVoertuigen.length > 0 && (
                  <div className="space-y-1.5">
                    {gedaanVoertuigen.map((v) => (
                      <div key={v.id} className="flex items-start gap-2 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
                        <CheckCircle className="w-3.5 h-3.5 text-green-600 flex-shrink-0 mt-0.5" />
                        <div className="min-w-0">
                          <p className="text-[11px] font-semibold text-gray-700">{v.kenteken}</p>
                          <p className="text-xs text-green-800 leading-relaxed whitespace-pre-wrap">{v.gedaan}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <p className="text-xs text-gray-400 italic text-center py-2">Geen opmerkingen achtergelaten door monteur</p>
            )}
          </div>

          <div className="px-5 pb-5 flex gap-3 border-t border-gray-100 pt-4">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors"
            >
              Sluiten
            </button>
            <button
              onClick={() => { onNieuweOpdracht ? onNieuweOpdracht() : onClose(); }}
              className="flex-1 px-4 py-2.5 bg-primary text-white rounded-xl text-sm font-bold hover:bg-primary/90 transition-colors flex items-center justify-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Nieuwe opdracht
            </button>
          </div>
        </div>
      </div>
    );
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
          <button onClick={onBewerken} className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-primary hover:bg-primary/10 rounded-lg transition-colors" title="Volledig bewerken">
            <Pencil className="w-3 h-3" /> Bewerken
          </button>
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
              onChange={(e) => {
                const val = e.target.value;
                const dag = val ? new Date(val + 'T12:00:00').getDay() : -1;
                if (val && geslotenDagen.length > 0 && geslotenDagen.includes(dag)) {
                  setPendingDatum(val);
                  setGeslotenWaarschuwing(true);
                } else {
                  setDatum(val);
                  setGeslotenWaarschuwing(false);
                }
              }}
              className={`w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 ${datumOnbekend ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : ''}`}
            />
            {geslotenWaarschuwing && (
              <GeslotenDagMelding
                onPlanLater={() => { setDatum(''); setDatumOnbekend(true); setGeslotenWaarschuwing(false); }}
                onVerplaats={() => { setDatum(''); setGeslotenWaarschuwing(false); }}
                onTochPlannen={() => { setDatum(pendingDatum); setGeslotenWaarschuwing(false); }}
              />
            )}
            <label className="flex items-center gap-2 mt-1.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={datumOnbekend}
                onChange={(e) => { setDatumOnbekend(e.target.checked); if (e.target.checked) { setDatum(''); setGeslotenWaarschuwing(false); } }}
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
              {monteurs.map((m) => <option key={m.id} value={m.id}>{m.voornaam} {m.naam}</option>)}
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

function NieuweOpdrachtModal({ monteurs, onClose, onSuccess }: { monteurs: DbMonteur[]; onClose: () => void; onSuccess: (id: string) => void }) {
  const [stap, setStap] = useState(1);
  const [opslaan, setOpslaan] = useState(false);
  const [fout, setFout] = useState('');
  const [datumOnbekend, setDatumOnbekend] = useState(false);
  const [form, setForm] = useState({
    type: '', type_detail: '', locatie: '', adres: '', postcode: '', stad: '',
    datum: '',
    prioriteit: 3, urgent: false, notitie: '',
    contactpersoon: '', telefoon: '', monteur_id: '',
    relatie_id: '', crediteurnummer: '', aantalMee: 0,
  });
  const [kentekens, setKentekens] = useState<KentekenRij[]>([]);
  const [nieuweKenteken, setNieuweKenteken] = useState('');
  const [locaties, setLocaties] = useState<VerhuurLocatie[]>([]);
  const [vlootVoertuigen, setVlootVoertuigen] = useState<{ id: string; kenteken: string; kleur: string | null; model: string; meldcode: string; object_status: string }[]>([]);
  const [ladenVoertuigen, setLadenVoertuigen] = useState(false);
  const [geslotenWaarschuwing, setGeslotenWaarschuwing] = useState(false);
  const [pendingDatum, setPendingDatum] = useState('');

  useEffect(() => {
    async function laadLocaties() {
      const PAGE = 1000;
      const all: VerhuurLocatie[] = [];
      let from = 0;
      while (true) {
        const { data } = await supabase
          .from('relaties')
          .select('id, naam, adres, postcode, plaats, land, contactpersoon, telefoon, crediteurnummer, status, gesloten_dagen')
          .range(from, from + PAGE - 1)
          .order('naam', { ascending: true });
        if (!data || data.length === 0) break;
        data.forEach((r: any) => all.push({
          id: r.id,
          naam: r.naam,
          adres: r.adres ?? '',
          postcode: r.postcode ?? '',
          stad: r.plaats ?? '',
          land: r.land ?? 'NL',
          contactpersoon: r.contactpersoon ?? '',
          telefoon: r.telefoon ?? '',
          crediteurnummer: r.crediteurnummer ?? null,
          gesloten_dagen: r.gesloten_dagen ?? [],
        }));
        if (data.length < PAGE) break;
        from += PAGE;
      }
      setLocaties(all);
    }
    laadLocaties();
  }, []);

  useEffect(() => {
    if (!form.relatie_id) { setVlootVoertuigen([]); return; }
    setLadenVoertuigen(true);
    setKentekens([]);
    supabase
      .from('voertuigen')
      .select('id, kenteken, kleur, model, meldcode, object_status')
      .eq('relatie_id', form.relatie_id)
      .eq('actief', true)
      .order('object_status', { ascending: true })
      .order('kenteken', { ascending: true })
      .then(({ data }) => {
        setVlootVoertuigen((data ?? []).map((v: any) => ({
          id: v.id, kenteken: v.kenteken, kleur: v.kleur, model: v.model ?? '', meldcode: v.meldcode ?? '', object_status: v.object_status ?? 'Operationeel',
        })));
        setLadenVoertuigen(false);
      });
  }, [form.relatie_id]);

  function stel(veld: string, waarde: unknown) { setForm((p) => ({ ...p, [veld]: waarde })); }

  // Sync aantalMee met het aantal geselecteerde kentekens
  useEffect(() => {
    if (kentekens.length > 0) stel('aantalMee', kentekens.length);
  }, [kentekens.length]);

  function kiesLocatie(loc: VerhuurLocatie) {
    setForm((p) => ({ ...p, relatie_id: loc.id, crediteurnummer: loc.crediteurnummer ?? '', locatie: loc.naam, adres: loc.adres, postcode: loc.postcode, stad: loc.stad, contactpersoon: loc.contactpersoon, telefoon: loc.telefoon }));
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
      id, type: form.type, type_detail: form.type_detail || '', status: 'ingepland', locatie: form.locatie,
      crediteurnummer: form.crediteurnummer || '',
      adres: form.adres, postcode: form.postcode, stad: form.stad,
      datum: form.datum || null,
      prioriteit: form.prioriteit, urgent: form.urgent,
      deadline: null, notitie: form.notitie, contactpersoon: form.contactpersoon,
      telefoon: form.telefoon, route_volgorde: 1,
      monteur_id: form.monteur_id || null, sleutel_ophalen: false,
      aantal_voertuigen: form.aantalMee || 1,
    });
    if (error) { setFout(error.message); setOpslaan(false); return; }
    if (kentekens.length > 0) {
      let nieuweStatus = 'Operationeel';
      if (form.type === 'reparatie' || form.type === 'onderhoud') nieuweStatus = 'Reparatie op locatie';
      if (form.type === 'terughalen') nieuweStatus = 'In loods';

      const bestaand = kentekens.filter((k) => k.voertuig_id);
      const nieuw = kentekens.filter((k) => !k.voertuig_id);

      // Bestaande vlootvoertuigen koppelen aan deze opdracht
      for (const k of bestaand) {
        await supabase.from('voertuigen').update({
          opdracht_id: id,
          probleem: k.probleem || null,
          ...(nieuweStatus !== 'Operationeel' ? { object_status: nieuweStatus } : {}),
        }).eq('id', k.voertuig_id!);
      }

      // Nieuwe (handmatig ingevoerde) kentekens invoegen
      if (nieuw.length > 0) {
        await supabase.from('voertuigen').insert(nieuw.map((r) => ({
          opdracht_id: id, kenteken: r.kenteken, kleur: null, probleem: r.probleem || null,
          object_status: nieuweStatus,
        })));
      }
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
                    <button key={t.id} type="button" onClick={() => { stel('type', t.id); stel('type_detail', ''); }}
                      className={`p-2 rounded-lg border-2 text-center transition-all ${form.type === t.id ? 'border-primary bg-primary/10' : `border-transparent hover:border-primary/30 ${t.kleur}`}`}>
                      <t.icon className="w-4 h-4 mx-auto mb-1" />
                      <span className="text-[10px] font-semibold block">{t.label}</span>
                    </button>
                  ))}
                </div>
                {form.type === 'plaatsen' && (
                  <div className="mt-2 flex gap-2">
                    {['Eerste uitlevering', 'Uitleveren & terugplaatsen'].map((d) => (
                      <button key={d} type="button" onClick={() => stel('type_detail', d)}
                        className={`flex-1 py-1.5 rounded-lg text-xs font-semibold border-2 transition-all ${form.type_detail === d ? 'border-green-500 bg-green-50 text-green-700' : 'border-gray-200 text-gray-500 hover:border-green-300'}`}>
                        {d}
                      </button>
                    ))}
                  </div>
                )}
                {form.type === 'terughalen' && (
                  <div className="mt-2 flex gap-2 flex-wrap">
                    {['Winterstalling', 'Defect', 'Afschalen', 'Definitief stoppen'].map((d) => (
                      <button key={d} type="button" onClick={() => stel('type_detail', d)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold border-2 transition-all ${form.type_detail === d ? 'border-red-500 bg-red-50 text-red-700' : 'border-gray-200 text-gray-500 hover:border-red-300'}`}>
                        {d}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Verhuurlocatie</label>
                <LocatieDropdown locaties={locaties} geselecteerd={form.locatie} onKies={kiesLocatie} />
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
              {/* Voertuigen mee / ruilen */}
              <div className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3">
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2.5">
                  Voertuigen mee in bus
                </label>
                <div className="flex items-center gap-3 flex-wrap">
                  <button type="button"
                    onClick={() => stel('aantalMee', Math.max(0, form.aantalMee - 1))}
                    className="w-9 h-9 rounded-full border-2 border-gray-300 flex items-center justify-center hover:border-primary hover:text-primary text-gray-600 font-bold text-xl leading-none transition-colors flex-shrink-0">
                    −
                  </button>
                  <span className="text-3xl font-black text-gray-800 w-8 text-center tabular-nums">{form.aantalMee}</span>
                  <button type="button"
                    onClick={() => stel('aantalMee', Math.min(12, form.aantalMee + 1))}
                    className="w-9 h-9 rounded-full border-2 border-gray-300 flex items-center justify-center hover:border-primary hover:text-primary text-gray-600 font-bold text-xl leading-none transition-colors flex-shrink-0">
                    +
                  </button>
                  <div className="flex gap-1 ml-1">
                    {Array.from({ length: 12 }, (_, i) => (
                      <button key={i} type="button" onClick={() => stel('aantalMee', i + 1)}
                        className={`w-4 h-4 rounded-sm transition-colors ${i < form.aantalMee ? 'bg-primary' : 'bg-gray-200 hover:bg-gray-300'}`} />
                    ))}
                  </div>
                  {form.aantalMee === 0 && (
                    <span className="text-xs text-gray-400 italic">0 = voertuigen staan al op locatie</span>
                  )}
                </div>
                {kentekens.length > 0 && form.aantalMee !== kentekens.length && (
                  <p className="text-[11px] text-amber-600 mt-2 flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" />
                    {kentekens.length} voertuigen geselecteerd — klopt dat met het aantal mee?
                  </p>
                )}
              </div>

              {/* Monteur selectie met buscapaciteit */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Monteur</label>
                <div className="space-y-1.5">
                  <label className={`flex items-center gap-3 px-3 py-2.5 border rounded-xl cursor-pointer transition-all ${form.monteur_id === '' ? 'border-amber-400 bg-amber-50' : 'border-gray-200 hover:border-gray-300'}`}>
                    <input type="radio" name="monteur_nieuw" value="" checked={form.monteur_id === ''} onChange={() => stel('monteur_id', '')} className="sr-only" />
                    <div className="w-7 h-7 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
                      <Clock className="w-3.5 h-3.5 text-amber-600" />
                    </div>
                    <span className="text-sm text-amber-700 font-semibold flex-1">Nog in te plannen</span>
                  </label>
                  {monteurs.map((m) => {
                    const past = form.aantalMee === 0 || form.aantalMee <= m.bus_capaciteit;
                    const gekozen = form.monteur_id === m.id;
                    return (
                      <label key={m.id} className={`flex items-center gap-3 px-3 py-2.5 border rounded-xl cursor-pointer transition-all ${gekozen ? 'border-primary bg-primary/5' : !past ? 'border-red-200 bg-red-50/60' : 'border-gray-200 hover:border-primary/40'}`}>
                        <input type="radio" name="monteur_nieuw" value={m.id} checked={gekozen} onChange={() => stel('monteur_id', m.id)} className="sr-only" />
                        <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold ${gekozen ? 'bg-primary text-white' : 'bg-gray-100 text-gray-600'}`}>
                          {`${m.voornaam[0] ?? ''}${m.naam[0] ?? ''}`.toUpperCase()}
                        </div>
                        <span className={`text-sm font-semibold flex-1 ${!past ? 'text-red-400' : 'text-gray-800'}`}>{m.voornaam} {m.naam}</span>
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          <Truck className="w-3.5 h-3.5 text-gray-400" />
                          <div className="flex gap-0.5">
                            {Array.from({ length: m.bus_capaciteit }, (_, i) => (
                              <div key={i} className={`w-2 h-3 rounded-sm ${form.aantalMee > 0 && i < form.aantalMee ? (past ? 'bg-primary' : 'bg-red-400') : 'bg-gray-200'}`} />
                            ))}
                          </div>
                          <span className={`text-[11px] font-bold ml-0.5 ${!past ? 'text-red-500' : 'text-gray-500'}`}>
                            {form.aantalMee > 0 ? `${form.aantalMee}/${m.bus_capaciteit}` : m.bus_capaciteit}
                          </span>
                          {!past && <AlertTriangle className="w-3 h-3 text-red-500" />}
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Datum + prioriteit + urgent */}
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                    Datum <span className="normal-case font-normal text-gray-400">(optioneel)</span>
                  </label>
                  <input
                    type="date"
                    value={datumOnbekend ? '' : form.datum}
                    disabled={datumOnbekend}
                    onChange={(e) => {
                      const val = e.target.value;
                      const dag = val ? new Date(val + 'T12:00:00').getDay() : -1;
                      const gesloten = locaties.find((l) => l.naam === form.locatie)?.gesloten_dagen ?? [];
                      if (val && gesloten.length > 0 && gesloten.includes(dag)) {
                        setPendingDatum(val);
                        setGeslotenWaarschuwing(true);
                      } else {
                        stel('datum', val);
                        setGeslotenWaarschuwing(false);
                      }
                    }}
                    className={`w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 ${datumOnbekend ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : ''}`}
                  />
                  {geslotenWaarschuwing && (
                    <GeslotenDagMelding
                      onPlanLater={() => { stel('datum', ''); setDatumOnbekend(true); setGeslotenWaarschuwing(false); }}
                      onVerplaats={() => { stel('datum', ''); setGeslotenWaarschuwing(false); }}
                      onTochPlannen={() => { stel('datum', pendingDatum); setGeslotenWaarschuwing(false); }}
                    />
                  )}
                  <label className="flex items-center gap-2 mt-1.5 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={datumOnbekend}
                      onChange={(e) => { setDatumOnbekend(e.target.checked); if (e.target.checked) { stel('datum', ''); setGeslotenWaarschuwing(false); } }}
                      className="w-3.5 h-3.5 accent-primary"
                    />
                    <span className="text-[11px] text-gray-500">Datum nog niet bekend</span>
                  </label>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Prioriteit</label>
                  <select value={form.prioriteit} onChange={(e) => stel('prioriteit', Number(e.target.value))} className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none appearance-none">
                    <option value={1}>P1 — Hoog</option>
                    <option value={2}>P2 — Middel</option>
                    <option value={3}>P3 — Laag</option>
                  </select>
                  <label className="flex items-center gap-2 mt-2 cursor-pointer">
                    <input type="checkbox" checked={form.urgent} onChange={(e) => stel('urgent', e.target.checked)} className="w-3.5 h-3.5 accent-red-500" />
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
                  Voertuigen {kentekens.length > 0 && <span className="normal-case font-normal text-gray-400">({kentekens.length} geselecteerd)</span>}
                </label>

                {/* Vloot van locatie */}
                {form.relatie_id && (
                  <div className="border border-gray-200 rounded-xl overflow-hidden mb-3">
                    <div className="px-3 py-2 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
                      <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Vloot op locatie</span>
                      {ladenVoertuigen && <span className="text-[10px] text-gray-400">Laden...</span>}
                      {!ladenVoertuigen && vlootVoertuigen.length > 0 && (
                        <div className="flex gap-2">
                          <button type="button" onClick={() => setKentekens(vlootVoertuigen.map((v) => ({ kenteken: v.kenteken, probleem: '', voertuig_id: v.id })))}
                            className="text-[10px] text-primary font-semibold hover:underline">Alles</button>
                          <button type="button" onClick={() => setKentekens((p) => p.filter((k) => !k.voertuig_id))}
                            className="text-[10px] text-gray-400 hover:underline">Geen</button>
                        </div>
                      )}
                    </div>
                    {!ladenVoertuigen && vlootVoertuigen.length === 0 && (
                      <p className="px-3 py-3 text-xs text-gray-400 italic">Geen actieve voertuigen op deze locatie.</p>
                    )}
                    <div className="max-h-44 overflow-y-auto divide-y divide-gray-50">
                      {vlootVoertuigen.map((v) => {
                        const gekozen = kentekens.some((k) => k.voertuig_id === v.id);
                        const nietOperationeel = v.object_status && v.object_status !== 'Operationeel';
                        return (
                          <label key={v.id} className={`flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-gray-50/80 ${gekozen ? 'bg-primary/5' : ''}`}>
                            <input type="checkbox" checked={gekozen} className="w-3.5 h-3.5 accent-primary flex-shrink-0"
                              onChange={(e) => {
                                if (e.target.checked) setKentekens((p) => [...p, { kenteken: v.kenteken, probleem: '', voertuig_id: v.id }]);
                                else setKentekens((p) => p.filter((k) => k.voertuig_id !== v.id));
                              }} />
                            {v.kleur && <span className="w-3 h-3 rounded-full flex-shrink-0 border border-black/10" style={{ backgroundColor: v.kleur }} />}
                            <span className="font-mono text-xs font-semibold text-gray-800">{v.kenteken}</span>
                            {v.meldcode && <span className="text-[10px] text-gray-400 font-mono">{v.meldcode}</span>}
                            {v.model && <span className="text-[11px] text-gray-400 truncate flex-1">{v.model}</span>}
                            {nietOperationeel && (
                              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-orange-100 text-orange-700 flex-shrink-0">
                                {v.object_status}
                              </span>
                            )}
                          </label>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Handmatig kenteken toevoegen */}
                <div className="flex gap-2 mb-2">
                  <input type="text" value={nieuweKenteken} onChange={(e) => setNieuweKenteken(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); voegKentekenToe(); } }}
                    placeholder={form.relatie_id ? 'Ander kenteken toevoegen...' : 'Kenteken (bijv. EW-001-A)'}
                    className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 uppercase placeholder:normal-case" />
                  <button type="button" onClick={voegKentekenToe} className="px-3 py-2 bg-primary text-white rounded-lg hover:bg-primary/90">
                    <Plus className="w-4 h-4" />
                  </button>
                </div>

                {/* Geselecteerde kentekens met probleemomschrijving */}
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
  const gefilterd = locaties.filter((l) =>
    l.naam.toLowerCase().includes(zoek.toLowerCase()) ||
    l.stad.toLowerCase().includes(zoek.toLowerCase()) ||
    l.postcode.includes(zoek) ||
    (l.crediteurnummer ?? '').toLowerCase().includes(zoek.toLowerCase())
  );
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
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-gray-800">{loc.naam}</p>
                      {loc.crediteurnummer && <span className="font-mono text-[10px] text-gray-400">{loc.crediteurnummer}</span>}
                    </div>
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

/* ─── Volledig bewerk modal ──────────────────────────────── */

type VoertuigRij = { tempId: string; id?: string; vloot_id?: string; kenteken: string; kleur: string; probleem: string; verwijderd: boolean };

function BewerkOpdrachtModal({ monteurs, opdracht, onClose, onOpgeslagen, onVerwijderd }: {
  monteurs: DbMonteur[];
  opdracht: DbOpdracht;
  onClose: () => void;
  onOpgeslagen: (id: string, bijgewerkt: Partial<DbOpdracht>) => void;
  onVerwijderd: (id: string) => void;
}) {
  const [type, setType] = useState(opdracht.type);
  const [locatie, setLocatie] = useState(opdracht.locatie);
  const [adres, setAdres] = useState(opdracht.adres);
  const [postcode, setPostcode] = useState(opdracht.postcode);
  const [stad, setStad] = useState(opdracht.stad);
  const [datum, setDatum] = useState(opdracht.datum ?? '');
  const [datumOnbekend, setDatumOnbekend] = useState(!opdracht.datum);
  const [geslotenWaarschuwing, setGeslotenWaarschuwing] = useState(false);
  const [pendingDatum, setPendingDatum] = useState('');
  const [geslotenDagen, setGeslotenDagen] = useState<number[]>([]);

  useEffect(() => {
    supabase.from('relaties').select('gesloten_dagen').ilike('naam', locatie).maybeSingle()
      .then(({ data }) => { if (data?.gesloten_dagen) setGeslotenDagen(data.gesloten_dagen); else setGeslotenDagen([]); });
  }, [locatie]);

  const crediteurnummer = opdracht.crediteurnummer ?? '';
  const [vlootVoertuigen, setVlootVoertuigen] = useState<{ id: string; kenteken: string; kleur: string | null; model: string; meldcode: string; object_status: string }[]>([]);
  const [ladenVloot, setLadenVloot] = useState(false);

  useEffect(() => {
    setLadenVloot(true);
    const lookup = crediteurnummer
      ? supabase.from('relaties').select('id').eq('crediteurnummer', crediteurnummer).maybeSingle()
      : supabase.from('relaties').select('id').ilike('naam', locatie.trim()).maybeSingle();
    lookup.then(({ data }) => {
      if (data?.id) {
        supabase.from('voertuigen')
          .select('id, kenteken, kleur, model, meldcode, object_status')
          .eq('relatie_id', data.id)
          .neq('actief', false)
          .order('kenteken', { ascending: true })
          .then(({ data: vData }) => {
            setVlootVoertuigen((vData ?? []).map((v: any) => ({
              id: v.id, kenteken: v.kenteken, kleur: v.kleur, model: v.model ?? '', meldcode: v.meldcode ?? '', object_status: v.object_status ?? 'Operationeel',
            })));
            setLadenVloot(false);
          });
      } else {
        setVlootVoertuigen([]);
        setLadenVloot(false);
      }
    });
  }, [crediteurnummer, locatie]);

  const [monteurId, setMonteurId] = useState(opdracht.monteur_id ?? '');
  const [tijdStart, setTijdStart] = useState(opdracht.tijd_start?.slice(0, 5) ?? '');
  const [tijdEind, setTijdEind] = useState(opdracht.tijd_eind?.slice(0, 5) ?? '');
  const [tijdVastzetten, setTijdVastzetten] = useState(opdracht.tijd_vastzetten ?? false);
  const [prioriteit, setPrioriteit] = useState(opdracht.prioriteit);
  const [urgent, setUrgent] = useState(opdracht.urgent);
  const [contactpersoon, setContactpersoon] = useState(opdracht.contactpersoon ?? '');
  const [telefoon, setTelefoon] = useState(opdracht.telefoon ?? '');
  const [notitie, setNotitie] = useState(opdracht.notitie ?? '');
  const [bevestigVerwijder, setBevestigVerwijder] = useState(false);
  const [opslaan, setOpslaan] = useState(false);
  const [fout, setFout] = useState('');

  const [voertuigen, setVoertuigen] = useState<VoertuigRij[]>(
    (opdracht.voertuigen ?? []).map((v) => ({
      tempId: v.id, id: v.id, kenteken: v.kenteken, kleur: v.kleur ?? '#345022', probleem: v.probleem ?? '', verwijderd: false,
    }))
  );
  const [nieuwKenteken, setNieuwKenteken] = useState('');

  function voegVoertuigToe() {
    const k = nieuwKenteken.trim().toUpperCase();
    if (!k || voertuigen.some((v) => !v.verwijderd && v.kenteken === k)) return;
    setVoertuigen((p) => [...p, { tempId: `new-${Date.now()}`, kenteken: k, kleur: '#345022', probleem: '', verwijderd: false }]);
    setNieuwKenteken('');
  }

  function updateVoertuig(tempId: string, veld: 'kenteken' | 'kleur' | 'probleem', waarde: string) {
    setVoertuigen((p) => p.map((v) => v.tempId === tempId ? { ...v, [veld]: waarde } : v));
  }

  function verwijderVoertuig(tempId: string) {
    setVoertuigen((p) => p.map((v) => v.tempId === tempId ? { ...v, verwijderd: true } : v));
  }

  async function opslaan_fn() {
    if (!locatie.trim() || !adres.trim() || !postcode.trim() || !stad.trim()) {
      setFout('Locatie, adres, postcode en stad zijn verplicht.'); return;
    }
    setFout(''); setOpslaan(true);

    const bijgewerkt: Partial<DbOpdracht> = {
      type: type as DbOpdracht['type'],
      locatie: locatie.trim(),
      adres: adres.trim(),
      postcode: postcode.trim(),
      stad: stad.trim(),
      datum: datumOnbekend ? null : datum || null,
      monteur_id: monteurId || null,
      tijd_start: tijdStart || null,
      tijd_eind: tijdEind || null,
      tijd_vastzetten: tijdVastzetten,
      prioriteit,
      urgent,
      contactpersoon: contactpersoon.trim() || undefined,
      telefoon: telefoon.trim() || undefined,
      notitie: notitie.trim(),
      updated_at: new Date().toISOString(),
    };

    await supabase.from('opdrachten').update(bijgewerkt).eq('id', opdracht.id);

    // Voertuigen: verwijderen
    const teVerwijderen = voertuigen.filter((v) => v.verwijderd && v.id);
    await Promise.all(teVerwijderen.map((v) => supabase.from('voertuigen').delete().eq('id', v.id!)));

    // Voertuigen: bestaande updaten
    const teUpdaten = voertuigen.filter((v) => !v.verwijderd && v.id);
    await Promise.all(teUpdaten.map((v) => supabase.from('voertuigen').update({ kenteken: v.kenteken, kleur: v.kleur, probleem: v.probleem }).eq('id', v.id!)));

    // Voertuigen: nieuwe handmatig ingevoerde toevoegen
    let nieuweStatus = 'Operationeel';
    if (type === 'reparatie' || type === 'onderhoud') nieuweStatus = 'Reparatie op locatie';
    if (type === 'terughalen') nieuweStatus = 'In loods';

    const handmatigNieuw = voertuigen.filter((v) => !v.verwijderd && !v.id && !v.vloot_id);
    if (handmatigNieuw.length > 0) {
      await supabase.from('voertuigen').insert(handmatigNieuw.map((v) => ({ opdracht_id: opdracht.id, kenteken: v.kenteken, kleur: v.kleur, probleem: v.probleem })));
      if (nieuweStatus !== 'Operationeel') {
        await supabase.from('voertuigen').update({ object_status: nieuweStatus })
          .in('kenteken', handmatigNieuw.map((k) => k.kenteken)).is('opdracht_id', null);
      }
    }

    // Voertuigen: vlootvoertuigen koppelen aan deze opdracht
    const vlootNieuw = voertuigen.filter((v) => !v.verwijderd && !v.id && v.vloot_id);
    if (vlootNieuw.length > 0) {
      await Promise.all(vlootNieuw.map((v) =>
        supabase.from('voertuigen').update({
          opdracht_id: opdracht.id,
          probleem: v.probleem || null,
          ...(nieuweStatus !== 'Operationeel' ? { object_status: nieuweStatus } : {}),
        }).eq('id', v.vloot_id!)
      ));
    }

    setOpslaan(false);
    onOpgeslagen(opdracht.id, { ...bijgewerkt, voertuigen: voertuigen.filter((v) => !v.verwijderd).map((v) => ({ id: v.id ?? '', opdracht_id: opdracht.id, kenteken: v.kenteken, kleur: v.kleur, probleem: v.probleem, gedaan: null })) as any });
  }

  async function verwijderen() {
    await supabase.from('opdrachten').update({ deleted_at: new Date().toISOString() }).eq('id', opdracht.id);
    onVerwijderd(opdracht.id);
  }

  const zichtbareVoertuigen = voertuigen.filter((v) => !v.verwijderd);
  const typeInfo = OPDRACHTTYPEN.find((t) => t.id === type);

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[92vh]">

        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-100 flex-shrink-0">
          <div className={`p-2 rounded-lg ${typeInfo?.kleur ?? 'bg-gray-100'}`}>
            {typeInfo && <typeInfo.icon className="w-4 h-4" />}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-gray-900">Opdracht bewerken</p>
            <p className="text-xs text-gray-400">{opdracht.id}</p>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors">
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">

          {/* Type */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Opdrachttype</label>
            <div className="grid grid-cols-4 gap-2">
              {OPDRACHTTYPEN.map((t) => (
                <button key={t.id} type="button" onClick={() => setType(t.id)}
                  className={`p-2 rounded-lg border-2 text-center transition-all ${type === t.id ? 'border-primary bg-primary/10' : `border-transparent hover:border-primary/30 ${t.kleur}`}`}>
                  <t.icon className="w-4 h-4 mx-auto mb-1" />
                  <span className="text-[10px] font-semibold block">{t.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Locatie */}
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <Veld label="Locatienaam *" value={locatie} onChange={setLocatie} placeholder="Naam van het park / hotel" />
            </div>
            <Veld label="Adres *" value={adres} onChange={setAdres} placeholder="Straat 1" />
            <Veld label="Postcode *" value={postcode} onChange={setPostcode} placeholder="1234 AB" />
            <Veld label="Stad *" value={stad} onChange={setStad} placeholder="Amsterdam" />
          </div>

          {/* Planning */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                Datum <span className="normal-case font-normal text-gray-400">(optioneel)</span>
              </label>
              <input type="date" value={datumOnbekend ? '' : datum} disabled={datumOnbekend}
                onChange={(e) => {
                  const val = e.target.value;
                  const dag = val ? new Date(val + 'T12:00:00').getDay() : -1;
                  if (val && geslotenDagen.length > 0 && geslotenDagen.includes(dag)) {
                    setPendingDatum(val);
                    setGeslotenWaarschuwing(true);
                  } else {
                    setDatum(val);
                    setGeslotenWaarschuwing(false);
                  }
                }}
                className={`w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 ${datumOnbekend ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : ''}`} />
              {geslotenWaarschuwing && (
                <GeslotenDagMelding
                  onPlanLater={() => { setDatum(''); setDatumOnbekend(true); setGeslotenWaarschuwing(false); }}
                  onVerplaats={() => { setDatum(''); setGeslotenWaarschuwing(false); }}
                  onTochPlannen={() => { setDatum(pendingDatum); setGeslotenWaarschuwing(false); }}
                />
              )}
              <label className="flex items-center gap-2 mt-1.5 cursor-pointer select-none">
                <input type="checkbox" checked={datumOnbekend} onChange={(e) => { setDatumOnbekend(e.target.checked); if (e.target.checked) { setDatum(''); setGeslotenWaarschuwing(false); } }} className="w-3.5 h-3.5 accent-primary" />
                <span className="text-[11px] text-gray-500">Datum nog niet bekend</span>
              </label>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Monteur</label>
              <select value={monteurId} onChange={(e) => setMonteurId(e.target.value)} className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none appearance-none">
                <option value="">— Niet ingepland —</option>
                {monteurs.map((m) => <option key={m.id} value={m.id}>{m.voornaam} {m.naam}</option>)}
              </select>
            </div>
          </div>

          {/* Tijdstip */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
              Tijdstip <span className="normal-case font-normal text-gray-400">(optioneel)</span>
            </label>
            <div className="flex items-center gap-2">
              <input type="time" value={tijdStart} onChange={(e) => setTijdStart(e.target.value)} className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20" />
              <span className="text-xs text-gray-400">t/m</span>
              <input type="time" value={tijdEind} onChange={(e) => setTijdEind(e.target.value)} className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20" />
            </div>
            <label className="flex items-center gap-2 mt-1.5 cursor-pointer select-none">
              <input type="checkbox" checked={tijdVastzetten} onChange={(e) => setTijdVastzetten(e.target.checked)} className="w-3.5 h-3.5 accent-amber-500" />
              <span className="text-[11px] text-gray-500">Tijd vastzetten</span>
            </label>
          </div>

          {/* Prioriteit + urgent */}
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Prioriteit</label>
              <select value={prioriteit} onChange={(e) => setPrioriteit(Number(e.target.value))} className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none appearance-none">
                <option value={1}>P1 — Hoog</option>
                <option value={2}>P2 — Middel</option>
                <option value={3}>P3 — Laag</option>
              </select>
            </div>
            <div className="flex items-end pb-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={urgent} onChange={(e) => setUrgent(e.target.checked)} className="w-4 h-4 accent-red-500" />
                <span className="text-sm text-gray-700 font-medium">Urgent</span>
              </label>
            </div>
          </div>

          {/* Contact */}
          <div className="grid grid-cols-2 gap-3">
            <Veld label="Contactpersoon" value={contactpersoon} onChange={setContactpersoon} placeholder="Naam" />
            <Veld label="Telefoon" value={telefoon} onChange={setTelefoon} placeholder="+31 6 ..." />
          </div>

          {/* Voertuigen */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
              Voertuigen {zichtbareVoertuigen.length > 0 && <span className="normal-case font-normal text-gray-400">({zichtbareVoertuigen.length})</span>}
            </label>
            {zichtbareVoertuigen.length > 0 && (
              <div className="border border-gray-200 rounded-xl overflow-hidden divide-y divide-gray-100 mb-2">
                {zichtbareVoertuigen.map((v) => (
                  <div key={v.tempId} className="flex items-center gap-2 px-3 py-2">
                    <input type="color" value={v.kleur} onChange={(e) => updateVoertuig(v.tempId, 'kleur', e.target.value)}
                      className="w-7 h-7 rounded cursor-pointer border-0 p-0 flex-shrink-0" title="Kleur" />
                    <input type="text" value={v.kenteken} onChange={(e) => updateVoertuig(v.tempId, 'kenteken', e.target.value.toUpperCase())}
                      className="font-mono text-xs font-bold text-gray-700 bg-gray-50 px-2 py-1.5 rounded border border-gray-200 w-28 flex-shrink-0 focus:outline-none focus:ring-1 focus:ring-primary/30 uppercase" />
                    <input type="text" value={v.probleem} onChange={(e) => updateVoertuig(v.tempId, 'probleem', e.target.value)}
                      placeholder="Defect / opmerking..." className="flex-1 text-sm text-gray-700 placeholder:text-gray-400 bg-transparent px-2 py-1.5 border border-transparent rounded focus:outline-none focus:border-gray-200 focus:bg-gray-50" />
                    <button type="button" onClick={() => verwijderVoertuig(v.tempId)} className="p-1 hover:bg-red-50 rounded transition-colors flex-shrink-0">
                      <Trash2 className="w-3.5 h-3.5 text-gray-400 hover:text-red-500" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Vloot van locatie */}
            <div className="border border-gray-200 rounded-xl overflow-hidden mb-2">
              <div className="px-3 py-2 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
                <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Toevoegen uit vloot</span>
                {ladenVloot && <span className="text-[10px] text-gray-400">Laden...</span>}
              </div>
              {ladenVloot ? (
                <p className="px-3 py-3 text-xs text-gray-400 italic">Vloot laden...</p>
              ) : vlootVoertuigen.length === 0 ? (
                <p className="px-3 py-3 text-xs text-gray-400 italic">Geen vlootvoertuigen gevonden voor deze locatie.</p>
              ) : (
                <div className="max-h-44 overflow-y-auto divide-y divide-gray-50">
                  {vlootVoertuigen
                    .filter((v) => !voertuigen.some((r) => !r.verwijderd && r.kenteken === v.kenteken))
                    .map((v) => {
                      const nietOperationeel = v.object_status !== 'Operationeel';
                      return (
                        <label key={v.id} className="flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-gray-50/80">
                          <input type="checkbox" checked={false} className="w-3.5 h-3.5 accent-primary flex-shrink-0"
                            onChange={() => setVoertuigen((p) => [...p, { tempId: `vloot-${v.id}`, vloot_id: v.id, kenteken: v.kenteken, kleur: v.kleur ?? '#345022', probleem: '', verwijderd: false }])} />
                          {v.kleur && <span className="w-3 h-3 rounded-full flex-shrink-0 border border-black/10" style={{ backgroundColor: v.kleur }} />}
                          <span className="font-mono text-xs font-semibold text-gray-800">{v.kenteken}</span>
                          {v.meldcode && <span className="text-[10px] text-gray-400 font-mono">{v.meldcode}</span>}
                          {v.model && <span className="text-[11px] text-gray-400 truncate flex-1">{v.model}</span>}
                          {nietOperationeel && (
                            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-orange-100 text-orange-700 flex-shrink-0">
                              {v.object_status}
                            </span>
                          )}
                        </label>
                      );
                    })}
                  {vlootVoertuigen.filter((v) => !voertuigen.some((r) => !r.verwijderd && r.kenteken === v.kenteken)).length === 0 && (
                    <p className="px-3 py-3 text-xs text-gray-400 italic">Alle voertuigen van deze locatie zijn al toegevoegd.</p>
                  )}
                </div>
              )}
            </div>

            <div className="flex gap-2">
              <input type="text" value={nieuwKenteken} onChange={(e) => setNieuwKenteken(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); voegVoertuigToe(); } }}
                placeholder="Kenteken handmatig toevoegen..."
                className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 uppercase placeholder:normal-case" />
              <button type="button" onClick={voegVoertuigToe} className="px-3 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors">
                <Plus className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Notitie */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Notitie</label>
            <textarea value={notitie} onChange={(e) => setNotitie(e.target.value)} rows={2}
              placeholder="Extra informatie voor de monteur..."
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none" />
          </div>

          {fout && <FoutBanner tekst={fout} />}
        </div>

        {/* Footer */}
        <div className="px-5 pb-5 pt-3 border-t border-gray-100 space-y-2 flex-shrink-0">
          <div className="flex gap-2">
            <button onClick={opslaan_fn} disabled={opslaan}
              className="flex-1 py-2.5 bg-[#F3A713] text-[#1A1A1A] text-sm font-bold rounded-xl hover:bg-[#D4900E] transition-colors disabled:opacity-60">
              {opslaan ? 'Opslaan...' : '✓ Wijzigingen opslaan'}
            </button>
            <button onClick={onClose} className="px-4 py-2.5 border border-gray-200 text-gray-600 text-sm font-medium rounded-xl hover:bg-gray-50 transition-colors">
              Annuleer
            </button>
          </div>
          {!bevestigVerwijder ? (
            <button onClick={() => setBevestigVerwijder(true)}
              className="w-full py-2 text-sm text-red-500 hover:text-red-700 hover:bg-red-50 rounded-xl transition-colors flex items-center justify-center gap-2">
              <Trash2 className="w-4 h-4" /> Opdracht verwijderen
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

/* ─── Concept Planning Modal ─────────────────────────────── */

type ConceptAssignment = {
  opdracht_id: string;
  monteur_id: string;
  datum: string;
  route_volgorde: number;
  km_dag: number;
  locatie?: string;
  type?: string;
};

function werkdagenInBereik(van: string, tot: string): string[] {
  if (!van || !tot || tot < van) return [];
  const dagen: string[] = [];
  const d = new Date(van + 'T12:00:00');
  const eind = new Date(tot + 'T12:00:00');
  while (d <= eind) {
    const dow = d.getDay();
    if (dow !== 0 && dow !== 6) dagen.push(d.toISOString().split('T')[0]);
    d.setDate(d.getDate() + 1);
  }
  return dagen;
}

function ConceptPlanningModal({
  monteurs,
  datumVanInit,
  datumTotInit,
  onClose,
  onToegepast,
}: {
  monteurs: DbMonteur[];
  datumVanInit?: string;
  datumTotInit?: string;
  onClose: () => void;
  onToegepast: (aantal: number) => void;
}) {
  const vandaag = new Date().toISOString().split('T')[0];
  const overWeek = new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0];
  const [datumVan, setDatumVan] = useState(datumVanInit ?? vandaag);
  const [datumTot, setDatumTot] = useState(datumTotInit ?? overWeek);
  const [vanuitHuisPerDag, setVanuitHuisPerDag] = useState<Record<string, boolean>>({});
  const [geenPlanningDagen, setGeenPlanningDagen] = useState<Set<string>>(new Set());
  const [laden, setLaden] = useState(false);
  const [fout, setFout] = useState('');
  const [concept, setConcept] = useState<ConceptAssignment[] | null>(null);
  const [bakwagenToewijzingen, setBakwagenToewijzingen] = useState<{ monteur_id: string; datum: string }[]>([]);
  const [opslaan, setOpslaan] = useState(false);

  // Initialiseer vertrekpunt-toggles op monteur-standaard wanneer datumbereik verandert
  useEffect(() => {
    const dagen = werkdagenInBereik(datumVan, datumTot);
    setVanuitHuisPerDag((prev) => {
      const init: Record<string, boolean> = {};
      for (const m of monteurs) {
        for (const d of dagen) {
          const key = `${m.id}_${d}`;
          init[key] = key in prev ? prev[key] : m.van_huis;
        }
      }
      return init;
    });
    // Verwijder geen-planning-markeringen voor datums buiten het nieuwe bereik
    setGeenPlanningDagen((prev) => {
      const geldigeKeys = new Set(monteurs.flatMap((m) => dagen.map((d) => `${m.id}_${d}`)));
      return new Set([...prev].filter((k) => geldigeKeys.has(k)));
    });
  }, [datumVan, datumTot]);

  const werkdagen = werkdagenInBereik(datumVan, datumTot);

  async function genereer() {
    if (!datumVan || !datumTot || datumTot < datumVan) {
      setFout('Kies een geldig datumbereik.'); return;
    }
    setFout(''); setLaden(true); setConcept(null);
    try {
      const res = await fetch('/api/auto-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ datumVan, datumTot, vanuitHuisPerDag, geenPlanningDagen: [...geenPlanningDagen] }),
      });
      const data = await res.json();
      if (data.error) { setFout(data.error); setLaden(false); return; }
      setBakwagenToewijzingen(data.bakwagenToewijzingen ?? []);
      const assignments: ConceptAssignment[] = data.assignments ?? [];
      if (assignments.length === 0) {
        setFout('Geen ongeplande opdrachten gevonden (of geen coördinaten beschikbaar).'); setLaden(false); return;
      }
      const ids = [...new Set(assignments.map((a) => a.opdracht_id))];
      const { data: opData } = await supabase.from('opdrachten').select('id, locatie, type').in('id', ids);
      const locMap: Record<string, { locatie: string; type: string }> = {};
      (opData ?? []).forEach((o: any) => { locMap[o.id] = { locatie: o.locatie, type: o.type }; });
      setConcept(assignments.map((a) => ({ ...a, locatie: locMap[a.opdracht_id]?.locatie, type: locMap[a.opdracht_id]?.type })));
    } catch {
      setFout('Er is een fout opgetreden. Probeer opnieuw.');
    }
    setLaden(false);
  }

  async function overnemen() {
    if (!concept) return;
    setOpslaan(true);
    setFout('');
    try {
      for (const a of concept) {
        const { error } = await supabase.from('opdrachten').update({
          monteur_id: a.monteur_id,
          datum: a.datum,
          route_volgorde: a.route_volgorde,
          km_gereden: a.km_dag,
          updated_at: new Date().toISOString(),
        }).eq('id', a.opdracht_id);
        if (error) { setFout(`Fout bij opslaan: ${error.message}`); setOpslaan(false); return; }
      }
      onToegepast(concept.length);
    } catch (e: any) {
      setFout(`Onverwachte fout: ${e?.message ?? 'Probeer opnieuw'}`);
    }
    setOpslaan(false);
  }

  const monteurNaam = (id: string) => {
    const m = monteurs.find((m) => m.id === id);
    return m ? `${m.voornaam} ${m.naam}` : id;
  };

  const groepen: Record<string, { datum: string; monteur_id: string; items: ConceptAssignment[] }> = {};
  (concept ?? []).forEach((a) => {
    const key = `${a.datum}_${a.monteur_id}`;
    if (!groepen[key]) groepen[key] = { datum: a.datum, monteur_id: a.monteur_id, items: [] };
    groepen[key].items.push(a);
  });
  const groepenLijst = Object.values(groepen).sort((a, b) => a.datum.localeCompare(b.datum) || a.monteur_id.localeCompare(b.monteur_id));

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-100 flex-shrink-0">
          <div className="p-2 rounded-lg bg-purple-100">
            <Sparkles className="w-4 h-4 text-purple-600" />
          </div>
          <div className="flex-1">
            <h2 className="text-base font-bold text-gray-900">Concept planning genereren</h2>
            <p className="text-xs text-gray-400">Verdeelt ongeplande opdrachten op basis van locatie, prioriteit en buscapaciteit</p>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg">
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {/* Datumbereik */}
          <div className="flex items-end gap-3">
            <div className="flex-1">
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Van</label>
              <input type="date" value={datumVan} onChange={(e) => { setDatumVan(e.target.value); setConcept(null); }}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-200" />
            </div>
            <div className="flex-1">
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Tot en met</label>
              <input type="date" value={datumTot} onChange={(e) => { setDatumTot(e.target.value); setConcept(null); }}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-200" />
            </div>
          </div>

          {/* Vertrekpunt per dag per monteur */}
          {werkdagen.length > 0 && monteurs.length > 0 && (
            <div className="rounded-xl border border-gray-200 overflow-hidden">
              <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 border-b border-gray-100">
                <Home className="w-3.5 h-3.5 text-gray-400" />
                <span className="text-xs font-semibold text-gray-600">Vertrekpunt per dag</span>
                <span className="ml-auto text-[10px] text-gray-400 flex items-center gap-2">
                  <span className="inline-flex items-center gap-1"><Home className="w-3 h-3 text-blue-500" /> huis</span>
                  <span className="inline-flex items-center gap-1"><Building2 className="w-3 h-3 text-gray-400" /> loods</span>
                  <span className="inline-flex items-center gap-1"><X className="w-3 h-3 text-red-400" /> geen planning</span>
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-gray-100">
                      <th className="text-left px-3 py-2 text-gray-400 font-medium whitespace-nowrap w-28">Monteur</th>
                      {werkdagen.map((d) => {
                        const dt = new Date(d + 'T12:00:00');
                        return (
                          <th key={d} className="px-1 py-2 text-center text-gray-400 font-medium whitespace-nowrap min-w-[52px]">
                            <div className="text-[10px] uppercase">{dt.toLocaleDateString('nl-NL', { weekday: 'short' })}</div>
                            <div className="font-bold text-gray-600">{dt.getDate()}</div>
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {monteurs.map((m) => (
                      <tr key={m.id}>
                        <td className="px-3 py-2 text-gray-700 font-semibold whitespace-nowrap">{m.voornaam}</td>
                        {werkdagen.map((d) => {
                          const key = `${m.id}_${d}`;
                          const geenPlanning = geenPlanningDagen.has(key);
                          const vanHuis = !geenPlanning && (key in vanuitHuisPerDag ? vanuitHuisPerDag[key] : m.van_huis);
                          // 3-state cycle: huis → loods → geen planning → huis
                          function cycleState() {
                            setConcept(null);
                            if (geenPlanning) {
                              // geen → huis (reset)
                              setGeenPlanningDagen((p) => { const n = new Set(p); n.delete(key); return n; });
                              setVanuitHuisPerDag((p) => ({ ...p, [key]: true }));
                            } else if (vanHuis) {
                              // huis → loods
                              setVanuitHuisPerDag((p) => ({ ...p, [key]: false }));
                            } else {
                              // loods → geen planning
                              setGeenPlanningDagen((p) => new Set([...p, key]));
                            }
                          }
                          return (
                            <td key={d} className="px-1 py-1.5 text-center">
                              <button
                                onClick={cycleState}
                                title={geenPlanning ? 'Geen planning — klik voor huis' : vanHuis ? 'Vanuit huis — klik voor loods' : 'Vanuit loods — klik voor geen planning'}
                                className={`w-9 h-9 rounded-lg flex items-center justify-center mx-auto transition-all border ${
                                  geenPlanning
                                    ? 'bg-red-50 text-red-400 border-red-200 hover:bg-red-100'
                                    : vanHuis
                                    ? 'bg-blue-50 text-blue-600 border-blue-200 hover:bg-blue-100'
                                    : 'bg-gray-50 text-gray-400 border-gray-200 hover:bg-gray-100'
                                }`}
                              >
                                {geenPlanning ? <X className="w-4 h-4" /> : vanHuis ? <Home className="w-4 h-4" /> : <Building2 className="w-4 h-4" />}
                              </button>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Genereer knop */}
          <button onClick={genereer} disabled={laden || werkdagen.length === 0}
            className="w-full px-4 py-2.5 bg-purple-600 text-white rounded-xl text-sm font-semibold hover:bg-purple-700 disabled:opacity-60 flex items-center justify-center gap-2">
            {laden ? (
              <><div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />Bezig...</>
            ) : (
              <><Sparkles className="w-4 h-4" />Planning genereren</>
            )}
          </button>

          {laden && (
            <div className="bg-purple-50 border border-purple-200 rounded-xl p-4 text-sm text-purple-700">
              <p className="font-semibold mb-1">Planning wordt berekend...</p>
              <p className="text-xs text-purple-500">Adressen worden gegeocodeerd en routes berekend. Dit kan even duren bij veel opdrachten.</p>
            </div>
          )}

          {fout && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />{fout}
            </div>
          )}

          {concept && concept.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-gray-700">{concept.length} opdrachten ingepland</p>
                <span className="text-xs text-gray-400">{groepenLijst.length} dag{groepenLijst.length !== 1 ? 'en' : ''}</span>
              </div>
              {groepenLijst.map((groep) => {
                const dagKey = `${monteurs.find((m) => m.id === groep.monteur_id)?.id}_${groep.datum}`;
                const vanHuis = dagKey in vanuitHuisPerDag
                  ? vanuitHuisPerDag[dagKey]
                  : monteurs.find((m) => m.id === groep.monteur_id)?.van_huis ?? false;
                return (
                  <div key={`${groep.datum}_${groep.monteur_id}`} className="border border-gray-200 rounded-xl overflow-hidden">
                    <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 border-b border-gray-100">
                      <Calendar className="w-3.5 h-3.5 text-gray-400" />
                      <span className="text-xs font-semibold text-gray-700">
                        {new Date(groep.datum + 'T12:00:00').toLocaleDateString('nl-NL', { weekday: 'long', day: 'numeric', month: 'long' })}
                      </span>
                      <span className="text-xs text-gray-400">·</span>
                      <span className="text-xs font-semibold text-primary">{monteurNaam(groep.monteur_id)}</span>
                      <span className={`ml-1 inline-flex items-center gap-0.5 text-[10px] font-semibold px-1.5 py-0.5 rounded ${vanHuis ? 'bg-blue-50 text-blue-600' : 'bg-gray-100 text-gray-500'}`}>
                        {vanHuis ? <Home className="w-2.5 h-2.5" /> : <Building2 className="w-2.5 h-2.5" />}
                        {vanHuis ? 'Huis' : 'Loods'}
                      </span>
                      {bakwagenToewijzingen.some(b => b.monteur_id === groep.monteur_id && b.datum === groep.datum) && (
                        <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200">
                          <Truck className="w-2.5 h-2.5" />
                          Bakwagen
                        </span>
                      )}
                      <span className="ml-auto text-xs text-gray-400">{groep.items[groep.items.length - 1].km_dag} km</span>
                    </div>
                    <div className="divide-y divide-gray-50">
                      {groep.items.sort((a, b) => a.route_volgorde - b.route_volgorde).map((item) => {
                        const ti = OPDRACHTTYPEN.find((t) => t.id === item.type);
                        return (
                          <div key={item.opdracht_id} className="flex items-center gap-3 px-3 py-2">
                            <span className="w-5 h-5 rounded-full bg-primary/10 text-primary text-[10px] font-bold flex items-center justify-center flex-shrink-0">
                              {item.route_volgorde}
                            </span>
                            {ti && <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${ti.kleur} flex-shrink-0`}>{ti.label}</span>}
                            <span className="text-sm text-gray-700 font-medium flex-1 truncate">{item.locatie ?? item.opdracht_id}</span>
                            <span className="font-mono text-[10px] text-gray-400 flex-shrink-0">{item.opdracht_id}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="px-6 pb-4 flex flex-col gap-2 flex-shrink-0 border-t border-gray-100 pt-4">
          {fout && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />{fout}
            </div>
          )}
          <div className="flex gap-3">
            <button onClick={onClose} className="px-4 py-2.5 border border-gray-200 text-gray-600 text-sm font-medium rounded-xl hover:bg-gray-50 transition-colors">
              Annuleren
            </button>
            <button onClick={overnemen} disabled={!concept || opslaan}
              className="flex-1 py-2.5 bg-purple-600 text-white text-sm font-bold rounded-xl hover:bg-purple-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2">
              {opslaan ? (
                <><div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />Opslaan...</>
              ) : (
                <><CheckCircle className="w-4 h-4" />Plan overnemen ({concept?.length ?? 0} opdrachten)</>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
