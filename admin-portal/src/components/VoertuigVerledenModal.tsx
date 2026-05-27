'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { X, Wrench, AlertTriangle, Calendar, MapPin, CheckCircle2, Clock } from 'lucide-react';

type VerledenEntry = {
  id: string;
  opdracht_id: string | null;
  probleem: string | null;
  gedaan: string | null;
  created_at: string;
  opdrachten: {
    id: string;
    type: string;
    type_detail: string | null;
    status: string;
    locatie: string;
    datum: string | null;
    notitie: string | null;
    created_at: string;
  } | null;
};

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

export default function VoertuigVerledenModal({
  kenteken,
  onClose,
}: {
  kenteken: string;
  onClose: () => void;
}) {
  const [entries, setEntries] = useState<VerledenEntry[]>([]);
  const [laden, setLaden] = useState(true);

  useEffect(() => {
    async function laad() {
      setLaden(true);
      const { data } = await supabase
        .from('voertuigen')
        .select('id, opdracht_id, probleem, gedaan, created_at, opdrachten(id, type, type_detail, status, locatie, datum, notitie, created_at)')
        .eq('kenteken', kenteken)
        .not('opdracht_id', 'is', null)
        .order('created_at', { ascending: false });
      setEntries((data ?? []) as unknown as VerledenEntry[]);
      setLaden(false);
    }
    laad();
  }, [kenteken]);

  const fmtD = (d: string | null) => d
    ? new Date(d + (d.length === 10 ? 'T12:00:00' : '')).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', year: 'numeric' })
    : null;

  // Statistieken
  const typenCount: Record<string, number> = {};
  const problemen: string[] = [];
  for (const e of entries) {
    const type = e.opdrachten?.type ?? 'onbekend';
    typenCount[type] = (typenCount[type] ?? 0) + 1;
    if (e.probleem?.trim()) problemen.push(e.probleem.trim());
  }
  const reparaties = entries.filter((e) => e.opdrachten?.type === 'reparatie' || e.opdrachten?.type === 'pechhulp').length;

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-100">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
            <span className="font-mono font-black text-sm text-primary">{kenteken.slice(0, 2)}</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-gray-900 font-mono text-base">{kenteken}</p>
            <p className="text-xs text-gray-400">Voertuigverleden · {laden ? '...' : `${entries.length} opdrachten`}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* KPI balk */}
        {!laden && entries.length > 0 && (
          <div className="grid grid-cols-3 border-b border-gray-100">
            <div className="px-5 py-3 border-r border-gray-100">
              <p className="text-2xl font-black text-gray-900">{entries.length}</p>
              <p className="text-xs text-gray-400">Opdrachten totaal</p>
            </div>
            <div className="px-5 py-3 border-r border-gray-100">
              <p className={`text-2xl font-black ${reparaties > 3 ? 'text-red-500' : reparaties > 0 ? 'text-orange-500' : 'text-gray-900'}`}>
                {reparaties}
              </p>
              <p className="text-xs text-gray-400">Reparaties / pechhulp</p>
            </div>
            <div className="px-5 py-3">
              <p className="text-2xl font-black text-gray-900">{Object.keys(typenCount).length}</p>
              <p className="text-xs text-gray-400">Soorten opdrachten</p>
            </div>
          </div>
        )}

        {/* Per type samenvatting */}
        {!laden && Object.keys(typenCount).length > 0 && (
          <div className="px-6 py-3 border-b border-gray-100 flex flex-wrap gap-2">
            {Object.entries(typenCount).sort((a, b) => b[1] - a[1]).map(([type, count]) => (
              <span key={type} className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold ${typeKleur[type] ?? 'bg-gray-100 text-gray-600'}`}>
                <Wrench className="w-3 h-3" />
                {typeLabels[type] ?? type}
                <span className="bg-black/10 rounded px-1">{count}×</span>
              </span>
            ))}
          </div>
        )}

        {/* Tijdlijn */}
        <div className="overflow-y-auto flex-1 px-6 py-5">
          {laden ? (
            <p className="text-sm text-gray-400 text-center py-10">Laden...</p>
          ) : entries.length === 0 ? (
            <div className="text-center py-12">
              <CheckCircle2 className="w-10 h-10 text-gray-200 mx-auto mb-3" />
              <p className="text-sm font-semibold text-gray-400">Geen opdrachtengeschiedenis</p>
              <p className="text-xs text-gray-300 mt-1">Dit voertuig is nog niet in een opdracht gebruikt.</p>
            </div>
          ) : (
            <div className="relative">
              <div className="absolute left-[18px] top-0 bottom-0 w-0.5 bg-gray-100" />
              <div className="space-y-3">
                {entries.map((e, idx) => {
                  const op = e.opdrachten;
                  const type = op?.type ?? 'onbekend';
                  const typeDetail = op?.type_detail;
                  return (
                    <div key={e.id} className="relative pl-10">
                      <div className={`absolute left-[11px] top-3.5 w-4 h-4 rounded-full border-2 border-white z-10 ${
                        op?.status === 'afgerond' ? 'bg-green-400' :
                        op?.status === 'uitgevoerd' ? 'bg-orange-400' :
                        op?.status === 'ingepland' ? 'bg-blue-400' : 'bg-gray-300'
                      }`} />
                      <div className="bg-white border border-gray-200 rounded-xl px-4 py-3 space-y-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`px-2 py-0.5 rounded text-xs font-semibold ${typeKleur[type] ?? 'bg-gray-100 text-gray-600'}`}>
                            {typeLabels[type] ?? type}
                            {typeDetail && ` · ${typeDetail}`}
                          </span>
                          {op && (
                            <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${statusKleur[op.status] ?? 'bg-gray-100 text-gray-600'}`}>
                              {op.status}
                            </span>
                          )}
                          {op?.id && <span className="font-mono text-[10px] text-gray-400 ml-auto">{op.id}</span>}
                        </div>

                        <div className="flex flex-wrap gap-3 text-xs text-gray-500">
                          {op?.locatie && (
                            <span className="flex items-center gap-1">
                              <MapPin className="w-3 h-3 text-gray-400" />{op.locatie}
                            </span>
                          )}
                          {op?.datum && (
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3 h-3 text-gray-400" />{fmtD(op.datum)}
                            </span>
                          )}
                        </div>

                        {/* Probleem / gedaan */}
                        {(e.probleem || e.gedaan) && (
                          <div className="space-y-1">
                            {e.probleem && (
                              <div className="flex items-start gap-2 text-xs">
                                <AlertTriangle className="w-3.5 h-3.5 text-orange-400 flex-shrink-0 mt-0.5" />
                                <span className="text-gray-700"><span className="font-semibold text-orange-600">Probleem:</span> {e.probleem}</span>
                              </div>
                            )}
                            {e.gedaan && (
                              <div className="flex items-start gap-2 text-xs">
                                <CheckCircle2 className="w-3.5 h-3.5 text-green-500 flex-shrink-0 mt-0.5" />
                                <span className="text-gray-700"><span className="font-semibold text-green-600">Gedaan:</span> {e.gedaan}</span>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Notitie van opdracht */}
                        {op?.notitie && op.notitie.trim() && (
                          <p className="text-xs text-gray-500 bg-gray-50 rounded-lg px-2.5 py-1.5 italic">{op.notitie}</p>
                        )}
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
