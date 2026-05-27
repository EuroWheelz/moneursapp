'use client';

import { useState, useEffect } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { supabase } from '@/lib/supabase';
import {
  CheckCircle2, X, ChevronRight, Camera, Clock, AlertTriangle, Package, CalendarPlus,
  Wrench, Battery, Bike, ArrowLeftRight, Zap, Calendar,
} from 'lucide-react';

type Voertuig = {
  id: string;
  kenteken: string;
  kleur: string;
  gedaan: string | null;
  onderdelen: string[];
};

type UitgevoerdOpdracht = {
  id: string;
  type: string;
  locatie: string;
  adres: string;
  postcode: string;
  stad: string;
  contactpersoon: string | null;
  telefoon: string | null;
  datum: string | null;
  notitie: string;
  monteur_naam: string;
  crediteurnummer: string;
  voertuigen: Voertuig[];
  heeft_afwijking: boolean;
  vervolg_verzoek: boolean;
  vervolg_beschrijving: string;
};

type FotoMelding = {
  id: string;
  locatie: string;
  afwijkingen: string[];
  gedetecteerde_kentekens: string[];
  bekende_kentekens: string[];
  foto_url: string | null;
  monteur_id: string | null;
  opdracht_id: string | null;
  created_at: string;
};

const TYPENAAM: Record<string, string> = {
  onderhoud: 'Onderhoud', reparatie: 'Reparatie', accu: 'Accu',
  plaatsen: 'Plaatsen', terughalen: 'Terughalen', pechhulp: 'Pechhulp',
  evaluatie: 'Evaluatie', voertuigruil: 'Voertuigruil',
};

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


export default function ServiceCenterPage() {
  const [activeBak, setActiveBak] = useState<'ingediend' | 'meldingen'>('ingediend');
  const [opdrachten, setOpdrachten] = useState<UitgevoerdOpdracht[]>([]);
  const [meldingen, setMeldingen] = useState<FotoMelding[]>([]);
  const [monteurs, setMonteurs] = useState<{ id: string; voornaam: string; naam: string }[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [bezig, setBezig] = useState<string | null>(null);
  const [laden, setLaden] = useState(true);
  const [vervolgPrioriteiten, setVervolgPrioriteiten] = useState<Record<string, number>>({});
  const [vervolgModalOp, setVervolgModalOp] = useState<UitgevoerdOpdracht | null>(null);
  const [operationeelToggle, setOperationeelToggle] = useState<Record<string, boolean>>({});
  const [locatieVoertuigen, setLocatieVoertuigen] = useState<Record<string, { id: string; kenteken: string; kleur: string | null; object_status: string }[]>>({});

  useEffect(() => {
    laadAlles();

    const channel = supabase
      .channel(`service-center-${Date.now()}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'opdrachten' }, laadAlles)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'foto_meldingen' }, laadAlles)
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  useEffect(() => {
    if (!openId) return;
    const op = opdrachten.find((o) => o.id === openId);
    if (!op || op.voertuigen.length > 0) return;
    if (locatieVoertuigen[openId] !== undefined) return;

    (async () => {
      let relatieId: string | null = null;
      if (op.crediteurnummer) {
        const { data } = await supabase.from('relaties').select('id').eq('crediteurnummer', op.crediteurnummer).maybeSingle();
        relatieId = data?.id ?? null;
      }
      if (!relatieId) {
        const { data } = await supabase.from('relaties').select('id').ilike('naam', op.locatie.trim()).maybeSingle();
        relatieId = data?.id ?? null;
      }
      if (!relatieId) { setLocatieVoertuigen((p) => ({ ...p, [openId]: [] })); return; }

      const { data } = await supabase
        .from('voertuigen')
        .select('id, kenteken, kleur, object_status')
        .eq('relatie_id', relatieId)
        .neq('object_status', 'Operationeel');
      setLocatieVoertuigen((p) => ({ ...p, [openId]: data ?? [] }));
    })();
  }, [openId, opdrachten]); // eslint-disable-line react-hooks/exhaustive-deps

  async function laadAlles() {
    // Stap 1: laad uitgevoerde opdrachten
    const { data: opData, error: opError } = await supabase
      .from('opdrachten')
      .select('id, type, locatie, adres, postcode, stad, contactpersoon, telefoon, datum, notitie, monteur_id, updated_at, vervolg_verzoek, vervolg_beschrijving, crediteurnummer')
      .eq('status', 'uitgevoerd')
      .is('deleted_at', null)
      .order('updated_at', { ascending: false });

    if (opError) {
      console.error('[service-center] opdrachten fout:', opError);
      setLaden(false);
      return;
    }

    const ops = opData ?? [];
    if (ops.length === 0) {
      setOpdrachten([]);
      setLaden(false);
    } else {
      const opIds = ops.map((o: any) => o.id);

      // Stap 2: voertuigen
      const { data: vData } = await supabase
        .from('voertuigen')
        .select('id, opdracht_id, kenteken, kleur, gedaan')
        .in('opdracht_id', opIds);

      // Stap 3: gebruikte onderdelen
      const { data: ooData } = await supabase
        .from('opdracht_onderdelen')
        .select('opdracht_id, kenteken, onderdelen(naam)')
        .in('opdracht_id', opIds);

      // Stap 4: monteurs
      const monteurIds = [...new Set(ops.map((o: any) => o.monteur_id).filter(Boolean))];
      const { data: mData } = monteurIds.length > 0
        ? await supabase.from('monteurs').select('id, naam, voornaam').in('id', monteurIds)
        : { data: [] };

      // Stap 5: foto-meldingen afwijkingen per opdracht
      const { data: fmOpData } = await supabase
        .from('foto_meldingen')
        .select('opdracht_id, status')
        .in('opdracht_id', opIds);

      // Bouw map-structuren
      const monteurMap: Record<string, string> = {};
      (mData ?? []).forEach((m: any) => {
        monteurMap[m.id] = `${m.voornaam} ${m.naam}`;
      });
      setMonteurs(mData ?? []);

      const onderdelenMap: Record<string, Record<string, string[]>> = {};
      (ooData ?? []).forEach((oo: any) => {
        if (!oo.opdracht_id || !oo.kenteken) return;
        if (!onderdelenMap[oo.opdracht_id]) onderdelenMap[oo.opdracht_id] = {};
        if (!onderdelenMap[oo.opdracht_id][oo.kenteken]) onderdelenMap[oo.opdracht_id][oo.kenteken] = [];
        const naam = (oo.onderdelen as any)?.naam;
        if (naam) onderdelenMap[oo.opdracht_id][oo.kenteken].push(naam);
      });

      const afwijkingSet = new Set(
        (fmOpData ?? []).filter((f: any) => f.status === 'afwijking').map((f: any) => f.opdracht_id)
      );

      const mapped: UitgevoerdOpdracht[] = ops.map((op: any) => {
        const opVoertuigen: Voertuig[] = (vData ?? [])
          .filter((v: any) => v.opdracht_id === op.id)
          .map((v: any) => ({
            id: v.id,
            kenteken: v.kenteken,
            kleur: v.kleur,
            gedaan: v.gedaan ?? null,
            onderdelen: onderdelenMap[op.id]?.[v.kenteken] ?? [],
          }));

        return {
          id: op.id,
          type: op.type,
          locatie: op.locatie,
          adres: op.adres,
          postcode: op.postcode,
          stad: op.stad,
          contactpersoon: op.contactpersoon ?? null,
          telefoon: op.telefoon ?? null,
          datum: op.datum,
          notitie: op.notitie ?? '',
          monteur_naam: monteurMap[op.monteur_id] ?? op.monteur_id ?? '—',
          crediteurnummer: op.crediteurnummer ?? '',
          voertuigen: opVoertuigen,
          heeft_afwijking: afwijkingSet.has(op.id),
          vervolg_verzoek: op.vervolg_verzoek ?? false,
          vervolg_beschrijving: op.vervolg_beschrijving ?? '',
        };
      });

      setOpdrachten(mapped);
      setLaden(false);
    }

    // Foto-meldingen met afwijkingen
    const { data: fmData } = await supabase
      .from('foto_meldingen')
      .select('*')
      .eq('status', 'afwijking')
      .order('created_at', { ascending: false });

    setMeldingen((fmData ?? []) as FotoMelding[]);
    setLaden(false);
  }

  async function keurGoed(id: string) {
    setBezig(id);
    const op = opdrachten.find((o) => o.id === id);
    await supabase.from('opdrachten').update({ status: 'afgerond', updated_at: new Date().toISOString() }).eq('id', id);

    if (op) {
      if (op.voertuigen.length > 0) {
        const operatIds = op.voertuigen.filter((v) => operationeelToggle[`${id}-${v.kenteken}`] ?? true).map((v) => v.id);
        const overigIds = op.voertuigen.filter((v) => !(operationeelToggle[`${id}-${v.kenteken}`] ?? true)).map((v) => v.id);
        if (operatIds.length > 0) {
          await supabase.from('voertuigen').update({ object_status: 'Operationeel', opdracht_id: null }).in('id', operatIds);
        }
        if (overigIds.length > 0) {
          await supabase.from('voertuigen').update({ opdracht_id: null }).in('id', overigIds);
        }
      } else {
        const lvs = locatieVoertuigen[id] ?? [];
        const operatIds = lvs.filter((v) => operationeelToggle[`${id}-${v.kenteken}`] ?? true).map((v) => v.id);
        if (operatIds.length > 0) {
          await supabase.from('voertuigen').update({ object_status: 'Operationeel' }).in('id', operatIds);
        }
      }
    }

    setOpdrachten((p) => p.filter((o) => o.id !== id));
    if (openId === id) setOpenId(null);
    setBezig(null);

    if (op?.vervolg_verzoek) {
      setVervolgModalOp(op);
    }
  }

  async function meldingAfhandelen(id: string) {
    await supabase.from('foto_meldingen').update({ status: 'afgehandeld' }).eq('id', id);
    setMeldingen((p) => p.filter((m) => m.id !== id));
  }

  const aantalMeldingen = meldingen.length;

  return (
    <DashboardLayout title="Service Center">
      {/* Tabs */}
      <div className="flex gap-3 mb-5">
        <BakTab
          actief={activeBak === 'ingediend'}
          count={opdrachten.length}
          label="Ingediende opdrachten"
          sublabel="Wachten op akkoord"
          onClick={() => setActiveBak('ingediend')}
        />
        <BakTab
          actief={activeBak === 'meldingen'}
          count={aantalMeldingen}
          label="Foto-meldingen"
          sublabel="Onbekende kentekens"
          onClick={() => setActiveBak('meldingen')}
          alert={aantalMeldingen > 0}
        />
      </div>

      {/* Ingediende opdrachten */}
      {activeBak === 'ingediend' && (
        <div className="space-y-3">
          {laden ? (
            <div className="py-16 text-center text-sm text-gray-400">Laden...</div>
          ) : opdrachten.length === 0 ? (
            <EmptyState tekst="Geen opdrachten wachten op akkoord" />
          ) : (
            opdrachten.map((op) => (
              <div key={op.id} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                {/* Header */}
                <div
                  className="flex items-center gap-4 px-5 py-4 cursor-pointer hover:bg-gray-50/60 transition-colors"
                  onClick={() => setOpenId(openId === op.id ? null : op.id)}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="font-mono text-xs text-gray-400">{op.id}</span>
                      <span className="px-2 py-0.5 bg-orange-50 text-orange-700 text-[11px] font-semibold rounded">
                        {TYPENAAM[op.type] ?? op.type}
                      </span>
                      {op.heeft_afwijking && (
                        <span className="flex items-center gap-1 px-2 py-0.5 bg-red-50 text-red-600 text-[11px] font-semibold rounded">
                          <Camera className="w-3 h-3" />
                          Foto-afwijking
                        </span>
                      )}
                      {op.vervolg_verzoek && (
                        <span className="flex items-center gap-1 px-2 py-0.5 bg-blue-50 text-blue-700 text-[11px] font-semibold rounded">
                          <CalendarPlus className="w-3 h-3" />
                          Vervolgafspraak gevraagd
                        </span>
                      )}
                    </div>
                    <p className="font-semibold text-gray-900">{op.locatie}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {op.monteur_naam}
                      {op.datum ? ` · ${new Date(op.datum).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })}` : ''}
                      {` · ${op.voertuigen.length} voertuig${op.voertuigen.length !== 1 ? 'en' : ''}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {op.voertuigen.length > 0 && openId !== op.id ? (
                      <button
                        onClick={(e) => { e.stopPropagation(); setOpenId(op.id); }}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-50 text-orange-700 border border-orange-200 text-xs font-semibold rounded-lg hover:bg-orange-100 transition-colors"
                      >
                        <ChevronRight className="w-3.5 h-3.5" />
                        Bekijken
                      </button>
                    ) : (
                      <button
                        onClick={(e) => { e.stopPropagation(); keurGoed(op.id); }}
                        disabled={bezig === op.id}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 text-white text-xs font-semibold rounded-lg hover:bg-green-700 disabled:opacity-60 transition-colors"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        {bezig === op.id ? '...' : 'Akkoord'}
                      </button>
                    )}
                    <ChevronRight className={`w-4 h-4 text-gray-400 transition-transform ${openId === op.id ? 'rotate-90' : ''}`} />
                  </div>
                </div>

                {/* Detail */}
                {openId === op.id && (
                  <div className="border-t border-gray-100 p-5">
                    {op.voertuigen.length === 0 && (
                      <div className="mb-3">
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Voertuigen op locatie met reparatiestatus</p>
                        {locatieVoertuigen[op.id] === undefined ? (
                          <p className="text-xs text-gray-400 italic">Voertuigen laden...</p>
                        ) : locatieVoertuigen[op.id].length === 0 ? (
                          <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2.5 text-xs text-amber-800">
                            <AlertTriangle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                            <span>Geen voertuigen met reparatiestatus gevonden op deze locatie.</span>
                          </div>
                        ) : (
                          <div className="space-y-2">
                            {locatieVoertuigen[op.id].map((v) => {
                              const togKey = `${op.id}-${v.kenteken}`;
                              const togVal = operationeelToggle[togKey] ?? true;
                              return (
                                <div key={v.id} className="bg-gray-50 rounded-lg p-3">
                                  <div className="flex items-center gap-2 mb-2">
                                    {v.kleur && <div className="w-3 h-3 rounded-sm flex-shrink-0" style={{ backgroundColor: v.kleur }} />}
                                    <p className="font-mono text-sm font-semibold text-gray-700">{v.kenteken}</p>
                                    <span className="text-[10px] px-1.5 py-0.5 bg-orange-100 text-orange-700 rounded font-medium">{v.object_status}</span>
                                  </div>
                                  <label className="flex items-center gap-2 pt-2 border-t border-gray-200 cursor-pointer">
                                    <input
                                      type="checkbox"
                                      checked={togVal}
                                      onChange={(e) => setOperationeelToggle((prev) => ({ ...prev, [togKey]: e.target.checked }))}
                                      className="w-4 h-4 accent-green-600"
                                    />
                                    <span className="text-xs font-medium text-gray-700">
                                      Zet <span className="font-mono">{v.kenteken}</span> terug op Operationeel
                                    </span>
                                  </label>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}
                    <div className="space-y-3">
                      {op.voertuigen.map((v) => {
                        const togKey = `${op.id}-${v.kenteken}`;
                        const togVal = operationeelToggle[togKey] ?? true;
                        return (
                          <div key={v.id} className="bg-gray-50 rounded-lg p-4">
                            <div className="flex items-center gap-2 mb-2">
                              <div className="w-3 h-3 rounded-sm flex-shrink-0" style={{ backgroundColor: v.kleur ?? '#345022' }} />
                              <p className="font-mono text-sm font-semibold text-gray-700">{v.kenteken}</p>
                            </div>
                            {v.gedaan && (
                              <p className="text-sm text-gray-600 mb-2">{v.gedaan}</p>
                            )}
                            {v.onderdelen.length > 0 && (
                              <div className="flex flex-wrap items-center gap-1.5 mt-1">
                                <Package className="w-3.5 h-3.5 text-gray-400" />
                                {v.onderdelen.map((o) => (
                                  <span key={o} className="px-2 py-0.5 bg-white border border-gray-200 text-xs text-gray-600 rounded font-medium">
                                    {o}
                                  </span>
                                ))}
                              </div>
                            )}
                            {!v.gedaan && v.onderdelen.length === 0 && (
                              <p className="text-xs text-gray-400 italic">Geen details ingevuld</p>
                            )}
                            <label className="flex items-center gap-2 mt-3 pt-3 border-t border-gray-200 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={togVal}
                                onChange={(e) => setOperationeelToggle((prev) => ({ ...prev, [togKey]: e.target.checked }))}
                                className="w-4 h-4 accent-green-600"
                              />
                              <span className="text-xs font-medium text-gray-700">
                                Zet <span className="font-mono">{v.kenteken}</span> terug op Operationeel
                              </span>
                            </label>
                          </div>
                        );
                      })}
                      {op.notitie && (
                        <div className="text-sm text-gray-500 italic border-l-2 border-gray-200 pl-3">
                          {op.notitie}
                        </div>
                      )}
                    </div>

                    {op.vervolg_verzoek && (
                      <div className="mt-4 bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-3">
                        <div className="flex items-center gap-2">
                          <CalendarPlus className="w-4 h-4 text-blue-600 flex-shrink-0" />
                          <span className="text-sm font-semibold text-blue-800">Vervolgafspraak aangevraagd</span>
                        </div>
                        {op.vervolg_beschrijving && (
                          <p className="text-sm text-blue-700 italic border-l-2 border-blue-300 pl-3">
                            {op.vervolg_beschrijving}
                          </p>
                        )}
                        <div>
                          <p className="text-xs font-semibold text-blue-700 uppercase tracking-wide mb-1.5">Prioriteit voor vervolgopdracht</p>
                          <div className="flex gap-2">
                            {[
                              { val: 1, label: 'P1 — Hoog', kleur: 'bg-red-500' },
                              { val: 2, label: 'P2 — Middel', kleur: 'bg-orange-400' },
                              { val: 3, label: 'P3 — Laag', kleur: 'bg-blue-400' },
                            ].map((p) => {
                              const gekozen = (vervolgPrioriteiten[op.id] ?? 3) === p.val;
                              return (
                                <button
                                  key={p.val}
                                  onClick={() => setVervolgPrioriteiten((prev) => ({ ...prev, [op.id]: p.val }))}
                                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border-2 text-xs font-semibold transition-all ${gekozen ? 'border-blue-600 bg-white text-blue-800' : 'border-blue-200 bg-blue-50/50 text-blue-600 hover:border-blue-400'}`}
                                >
                                  <span className={`w-2 h-2 rounded-full ${p.kleur}`} />
                                  {p.label}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                        <p className="text-xs text-blue-600">
                          Na akkoord opent het aanmaaкscherm direct voor {op.locatie}.
                        </p>
                      </div>
                    )}

                    <div className="flex gap-3 mt-5">
                      <button
                        onClick={() => keurGoed(op.id)}
                        disabled={bezig === op.id}
                        className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 disabled:opacity-60 transition-colors"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        {bezig === op.id ? '...' : op.vervolg_verzoek ? 'Akkoord → vervolgafspraak aanmaken' : 'Akkoord & afgerond markeren'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* Foto-meldingen */}
      {activeBak === 'meldingen' && (
        <div className="space-y-3">
          {laden ? (
            <div className="py-16 text-center text-sm text-gray-400">Laden...</div>
          ) : meldingen.length === 0 ? (
            <EmptyState tekst="Geen foto-meldingen met afwijkingen" />
          ) : (
            meldingen.map((m) => (
              <div key={m.id} className="bg-white border border-red-100 rounded-xl overflow-hidden">
                <div className="flex items-start gap-4 px-5 py-4">
                  <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center flex-shrink-0">
                    <AlertTriangle className="w-5 h-5 text-red-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900 mb-1">{m.locatie}</p>
                    <p className="text-xs text-gray-400 mb-3">
                      {m.opdracht_id ? <span className="font-mono mr-2">{m.opdracht_id}</span> : null}
                      <Clock className="w-3 h-3 inline mr-1" />
                      {new Date(m.created_at).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </p>

                    <div className="flex flex-wrap gap-2 mb-3">
                      <span className="text-xs font-semibold text-gray-500">Onbekend op foto:</span>
                      {m.afwijkingen.map((k) => (
                        <span key={k} className="px-2 py-0.5 bg-red-50 border border-red-200 text-red-700 text-xs font-mono font-semibold rounded">
                          {k}
                        </span>
                      ))}
                    </div>

                    {m.foto_url && (
                      <a href={m.foto_url} target="_blank" rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-xs text-blue-600 hover:underline mb-3">
                        <Camera className="w-3.5 h-3.5" />
                        Foto bekijken
                      </a>
                    )}

                    <button
                      onClick={() => meldingAfhandelen(m.id)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 text-gray-600 text-xs font-semibold rounded-lg hover:bg-gray-200 transition-colors"
                    >
                      <X className="w-3.5 h-3.5" />
                      Afhandelen
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}
      {vervolgModalOp && (
        <VervolgOpdrachtModal
          op={vervolgModalOp}
          prioriteit={vervolgPrioriteiten[vervolgModalOp.id] ?? 3}
          monteurs={monteurs}
          onClose={() => setVervolgModalOp(null)}
          onAangemaakt={() => { setVervolgModalOp(null); }}
        />
      )}
    </DashboardLayout>
  );
}

function BakTab({ actief, count, label, sublabel, onClick, alert = false }: {
  actief: boolean; count: number; label: string; sublabel: string; onClick: () => void; alert?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-3 px-5 py-3.5 rounded-xl border-2 text-left transition-all
        ${actief ? 'border-primary bg-primary/5' : 'border-gray-200 bg-white hover:border-gray-300'}`}
    >
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center font-bold text-lg relative
        ${actief ? 'bg-primary text-white' : 'bg-gray-100 text-gray-600'}`}>
        {count}
        {alert && !actief && (
          <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full border-2 border-white" />
        )}
      </div>
      <div>
        <p className={`text-sm font-semibold ${actief ? 'text-primary' : 'text-gray-700'}`}>{label}</p>
        <p className="text-xs text-gray-400">{sublabel}</p>
      </div>
    </button>
  );
}

function EmptyState({ tekst }: { tekst: string }) {
  return (
    <div className="bg-gray-50 border border-dashed border-gray-200 rounded-xl p-12 text-center">
      <CheckCircle2 className="w-10 h-10 text-gray-200 mx-auto mb-3" />
      <p className="text-sm text-gray-400">{tekst}</p>
    </div>
  );
}

/* ─── Vervolgopdracht aanmaken modal ──────────────────────── */

function VervolgOpdrachtModal({ op, prioriteit: initPrioriteit, monteurs, onClose, onAangemaakt }: {
  op: UitgevoerdOpdracht;
  prioriteit: number;
  monteurs: { id: string; voornaam: string; naam: string }[];
  onClose: () => void;
  onAangemaakt: () => void;
}) {
  const [type, setType] = useState(op.type);
  const [locatie, setLocatie] = useState(op.locatie);
  const [adres, setAdres] = useState(op.adres);
  const [postcode, setPostcode] = useState(op.postcode);
  const [stad, setStad] = useState(op.stad);
  const [datum, setDatum] = useState('');
  const [monteurId, setMonteurId] = useState('');
  const [prioriteit, setPrioriteit] = useState(initPrioriteit);
  const [urgent, setUrgent] = useState(false);
  const [notitie, setNotitie] = useState(op.vervolg_beschrijving);
  const [contactpersoon, setContactpersoon] = useState(op.contactpersoon ?? '');
  const [telefoon, setTelefoon] = useState(op.telefoon ?? '');
  const [bezig, setBezig] = useState(false);
  const [fout, setFout] = useState('');

  const typeInfo = OPDRACHTTYPEN.find((t) => t.id === type);

  async function aanmaken() {
    if (!locatie.trim() || !adres.trim() || !postcode.trim() || !stad.trim()) {
      setFout('Locatie, adres, postcode en stad zijn verplicht.'); return;
    }
    setFout(''); setBezig(true);
    const id = `OP-${Math.floor(1000 + Math.random() * 9000)}`;
    const { error } = await supabase.from('opdrachten').insert({
      id,
      type,
      status: 'ingepland',
      locatie: locatie.trim(),
      adres: adres.trim(),
      postcode: postcode.trim(),
      stad: stad.trim(),
      datum: datum || null,
      monteur_id: monteurId || null,
      prioriteit,
      urgent,
      notitie: notitie.trim(),
      contactpersoon: contactpersoon.trim() || null,
      telefoon: telefoon.trim() || null,
      route_volgorde: 1,
    });
    setBezig(false);
    if (error) { setFout(error.message); return; }
    onAangemaakt();
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl flex flex-col max-h-[92vh]">

        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-100 flex-shrink-0">
          <div className={`p-2 rounded-lg ${typeInfo?.kleur ?? 'bg-gray-100'}`}>
            {typeInfo && <typeInfo.icon className="w-4 h-4" />}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-gray-900">Vervolgopdracht aanmaken</p>
            <p className="text-xs text-gray-400">Vervolgafspraak vanuit {op.id}</p>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors">
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">

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
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Locatienaam *</label>
              <input value={locatie} onChange={(e) => setLocatie(e.target.value)} placeholder="Naam locatie"
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Adres *</label>
              <input value={adres} onChange={(e) => setAdres(e.target.value)} placeholder="Straat 1"
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Postcode *</label>
              <input value={postcode} onChange={(e) => setPostcode(e.target.value)} placeholder="1234 AB"
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Stad *</label>
              <input value={stad} onChange={(e) => setStad(e.target.value)} placeholder="Amsterdam"
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20" />
            </div>
          </div>

          {/* Planning */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                Datum <span className="normal-case font-normal text-gray-400">(optioneel)</span>
              </label>
              <input type="date" value={datum} onChange={(e) => setDatum(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Monteur</label>
              <select value={monteurId} onChange={(e) => setMonteurId(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none appearance-none">
                <option value="">— Nog in te plannen —</option>
                {monteurs.map((m) => <option key={m.id} value={m.id}>{m.voornaam} {m.naam}</option>)}
              </select>
            </div>
          </div>

          {/* Prioriteit + urgent */}
          <div className="flex gap-3 items-end">
            <div className="flex-1">
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Prioriteit</label>
              <select value={prioriteit} onChange={(e) => setPrioriteit(Number(e.target.value))}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none appearance-none">
                <option value={1}>P1 — Hoog</option>
                <option value={2}>P2 — Middel</option>
                <option value={3}>P3 — Laag</option>
              </select>
            </div>
            <div className="pb-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={urgent} onChange={(e) => setUrgent(e.target.checked)} className="w-4 h-4 accent-red-500" />
                <span className="text-sm text-gray-700 font-medium">Urgent</span>
              </label>
            </div>
          </div>

          {/* Contact */}
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

          {/* Notitie */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Notitie monteur</label>
            <textarea value={notitie} onChange={(e) => setNotitie(e.target.value)} rows={3}
              placeholder="Beschrijving vervolgopdracht..."
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none" />
          </div>

          {fout && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm text-red-700">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" /> {fout}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 pb-5 pt-3 border-t border-gray-100 flex gap-2 flex-shrink-0">
          <button onClick={aanmaken} disabled={bezig}
            className="flex-1 py-2.5 bg-[#F3A713] text-[#1A1A1A] text-sm font-bold rounded-xl hover:bg-[#D4900E] transition-colors disabled:opacity-60 flex items-center justify-center gap-2">
            <CalendarPlus className="w-4 h-4" />
            {bezig ? 'Aanmaken...' : 'Vervolgopdracht aanmaken'}
          </button>
          <button onClick={onClose} className="px-4 py-2.5 border border-gray-200 text-gray-600 text-sm font-medium rounded-xl hover:bg-gray-50 transition-colors">
            Annuleer
          </button>
        </div>
      </div>
    </div>
  );
}
