'use client';

import { useState, useEffect } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { supabase } from '@/lib/supabase';
import {
  CheckCircle2, X, ChevronRight, Camera, Clock, AlertTriangle, Package,
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
  datum: string | null;
  notitie: string;
  monteur_naam: string;
  voertuigen: Voertuig[];
  heeft_afwijking: boolean;
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
};

export default function ServiceCenterPage() {
  const [activeBak, setActiveBak] = useState<'ingediend' | 'meldingen'>('ingediend');
  const [opdrachten, setOpdrachten] = useState<UitgevoerdOpdracht[]>([]);
  const [meldingen, setMeldingen] = useState<FotoMelding[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [bezig, setBezig] = useState<string | null>(null);
  const [laden, setLaden] = useState(true);

  useEffect(() => {
    laadAlles();

    const channel = supabase
      .channel(`service-center-${Date.now()}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'opdrachten' }, laadAlles)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'foto_meldingen' }, laadAlles)
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  async function laadAlles() {
    // Stap 1: laad uitgevoerde opdrachten
    const { data: opData, error: opError } = await supabase
      .from('opdrachten')
      .select('id, type, locatie, datum, notitie, monteur_id, updated_at')
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
          datum: op.datum,
          notitie: op.notitie ?? '',
          monteur_naam: monteurMap[op.monteur_id] ?? op.monteur_id ?? '—',
          voertuigen: opVoertuigen,
          heeft_afwijking: afwijkingSet.has(op.id),
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
    await supabase.from('opdrachten').update({ status: 'afgerond', updated_at: new Date().toISOString() }).eq('id', id);
    setOpdrachten((p) => p.filter((o) => o.id !== id));
    if (openId === id) setOpenId(null);
    setBezig(null);
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
                    </div>
                    <p className="font-semibold text-gray-900">{op.locatie}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {op.monteur_naam}
                      {op.datum ? ` · ${new Date(op.datum).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })}` : ''}
                      {` · ${op.voertuigen.length} voertuig${op.voertuigen.length !== 1 ? 'en' : ''}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      onClick={(e) => { e.stopPropagation(); keurGoed(op.id); }}
                      disabled={bezig === op.id}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 text-white text-xs font-semibold rounded-lg hover:bg-green-700 disabled:opacity-60 transition-colors"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      {bezig === op.id ? '...' : 'Akkoord'}
                    </button>
                    <ChevronRight className={`w-4 h-4 text-gray-400 transition-transform ${openId === op.id ? 'rotate-90' : ''}`} />
                  </div>
                </div>

                {/* Detail */}
                {openId === op.id && (
                  <div className="border-t border-gray-100 p-5">
                    <div className="space-y-3">
                      {op.voertuigen.map((v) => (
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
                        </div>
                      ))}
                      {op.notitie && (
                        <div className="text-sm text-gray-500 italic border-l-2 border-gray-200 pl-3">
                          {op.notitie}
                        </div>
                      )}
                    </div>

                    <div className="flex gap-3 mt-5">
                      <button
                        onClick={() => keurGoed(op.id)}
                        disabled={bezig === op.id}
                        className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 disabled:opacity-60 transition-colors"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        Akkoord & afgerond markeren
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
