'use client';

import { useState, useMemo } from 'react';
import Papa from 'papaparse';
import { X, Upload, Check, AlertCircle, Loader2, FileText, Link2, RefreshCw } from 'lucide-react';
import { supabase } from '@/lib/supabase';

interface Props { onClose: () => void; onSuccess: () => void; }

function get(r: Record<string, string>, ...keys: string[]): string {
  for (const key of keys) {
    const kLow = key.trim().toLowerCase();
    const found = Object.entries(r).find(([k]) => {
      const cLow = k.trim().toLowerCase().replace(/\.+$/, '');
      return cLow === kLow || cLow.startsWith(kLow) || kLow.startsWith(cLow);
    });
    if (found?.[1]?.trim()) return found[1].trim();
  }
  return '';
}

// Normalize for matching: trim, lowercase, collapse whitespace, strip leading zeros
function norm(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, '');
}

type Status = 'koppelen' | 'al_gekoppeld' | 'geen_relatie' | 'geen_voertuig';

type HerlinkRij = {
  kenteken: string;
  crediteurnummer_csv: string;
  relatienaam_csv: string;
  voertuig_id?: string;
  relatie_id?: string;
  relatie_naam?: string;
  relatie_id_huidig?: string | null;
  status: Status;
};

const STATUS_LABEL_BASIS: Record<Status, string> = {
  koppelen: 'Wordt gekoppeld',
  al_gekoppeld: 'Overgeslagen',
  geen_relatie: 'Crediteur niet gevonden',
  geen_voertuig: 'Kenteken niet in systeem',
};

const STATUS_KLEUR: Record<Status, string> = {
  koppelen: 'bg-green-50 text-green-700',
  al_gekoppeld: 'bg-gray-100 text-gray-500',
  geen_relatie: 'bg-amber-50 text-amber-700',
  geen_voertuig: 'bg-red-50 text-red-600',
};

export default function HerlinkVlootModal({ onClose, onSuccess }: Props) {
  const [rijen, setRijen] = useState<HerlinkRij[]>([]);
  const [bezig, setBezig] = useState(false);
  const [fout, setFout] = useState<string | null>(null);
  const [voortgang, setVoortgang] = useState({ huidig: 0, totaal: 0, fase: '' });
  const [toonFilter, setToonFilter] = useState<Status | ''>('');
  const [alleenZonder, setAlleenZonder] = useState(true);

  // Re-compute effective status based on alleenZonder toggle (no re-parse needed)
  const rijenEffectief = useMemo(() => {
    if (!alleenZonder) return rijen;
    return rijen.map((r) => {
      // Vehicle already linked to something → skip it, don't overwrite
      if (r.status === 'koppelen' && r.relatie_id_huidig != null) {
        return { ...r, status: 'al_gekoppeld' as Status };
      }
      return r;
    });
  }, [rijen, alleenZonder]);

  async function parseCSV(file: File) {
    setFout(null);
    setBezig(true);
    setVoortgang({ huidig: 0, totaal: 0, fase: 'Voertuigen ophalen...' });

    // Fetch all voertuigen
    const PAGE = 1000;
    const alleVoertuigen: { id: string; kenteken: string; relatie_id: string | null }[] = [];
    let from = 0;
    while (true) {
      const { data } = await supabase.from('voertuigen').select('id, kenteken, relatie_id').range(from, from + PAGE - 1);
      if (!data || data.length === 0) break;
      alleVoertuigen.push(...data);
      if (data.length < PAGE) break;
      from += PAGE;
    }

    setVoortgang({ huidig: 0, totaal: 0, fase: 'Relaties ophalen...' });

    // Fetch all relaties
    const alleRelaties: { id: string; crediteurnummer: string | null; naam: string }[] = [];
    from = 0;
    while (true) {
      const { data } = await supabase.from('relaties').select('id, crediteurnummer, naam').range(from, from + PAGE - 1);
      if (!data || data.length === 0) break;
      alleRelaties.push(...data);
      if (data.length < PAGE) break;
      from += PAGE;
    }

    setBezig(false);

    // Build lookup maps
    const voertuigMap = new Map<string, { id: string; relatie_id: string | null }>();
    alleVoertuigen.forEach((v) => voertuigMap.set(norm(v.kenteken), { id: v.id, relatie_id: v.relatie_id }));

    const relatieMap = new Map<string, { id: string; naam: string }>();
    alleRelaties.forEach((r) => {
      if (r.crediteurnummer) relatieMap.set(norm(r.crediteurnummer), { id: r.id, naam: r.naam });
    });

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      delimiter: '',
      complete: (results) => {
        if (results.errors.length > 0) { setFout('CSV-fout: ' + results.errors[0].message); return; }

        const uniek = new Set<string>();
        const gemapped: HerlinkRij[] = (results.data as Record<string, string>[])
          .map((r) => {
            const kenteken = get(r, 'Kenteken').toUpperCase();
            if (!kenteken || uniek.has(kenteken)) return null;
            uniek.add(kenteken);

            const crediteur = get(r, 'Crediteur nr.', 'Crediteursnummer', 'Crediteur', 'Crediteurnr', 'Crediteur nr');
            const relatienaam = get(r, 'Relatienaam', 'Relatie', 'Naam');
            const voertuig = voertuigMap.get(norm(kenteken));

            if (!voertuig) {
              return { kenteken, crediteurnummer_csv: crediteur, relatienaam_csv: relatienaam, status: 'geen_voertuig' as Status };
            }

            if (!crediteur) {
              return { kenteken, crediteurnummer_csv: '', relatienaam_csv: relatienaam, voertuig_id: voertuig.id, relatie_id_huidig: voertuig.relatie_id, status: 'geen_relatie' as Status };
            }

            const relatie = relatieMap.get(norm(crediteur));
            if (!relatie) {
              return { kenteken, crediteurnummer_csv: crediteur, relatienaam_csv: relatienaam, voertuig_id: voertuig.id, relatie_id_huidig: voertuig.relatie_id, status: 'geen_relatie' as Status };
            }

            if (voertuig.relatie_id === relatie.id) {
              return { kenteken, crediteurnummer_csv: crediteur, relatienaam_csv: relatienaam, voertuig_id: voertuig.id, relatie_id: relatie.id, relatie_naam: relatie.naam, relatie_id_huidig: voertuig.relatie_id, status: 'al_gekoppeld' as Status };
            }

            return { kenteken, crediteurnummer_csv: crediteur, relatienaam_csv: relatienaam, voertuig_id: voertuig.id, relatie_id: relatie.id, relatie_naam: relatie.naam, relatie_id_huidig: voertuig.relatie_id, status: 'koppelen' as Status };
          })
          .filter(Boolean) as HerlinkRij[];

        if (gemapped.length === 0) { setFout('Geen kentekens gevonden in CSV. Controleer of de kolom "Kenteken" aanwezig is.'); return; }
        setRijen(gemapped);
      },
    });
  }

  async function herlink() {
    const teKoppelen = rijenEffectief.filter((r) => r.status === 'koppelen');
    if (teKoppelen.length === 0) return;

    setBezig(true);
    setFout(null);

    // Group by relatie_id → one UPDATE per relatie (much more efficient)
    const byRelatie = new Map<string, string[]>();
    teKoppelen.forEach((r) => {
      if (!byRelatie.has(r.relatie_id!)) byRelatie.set(r.relatie_id!, []);
      byRelatie.get(r.relatie_id!)!.push(r.voertuig_id!);
    });

    const groepen = [...byRelatie.entries()];
    let gedaan = 0;
    setVoortgang({ huidig: 0, totaal: teKoppelen.length, fase: 'Koppelen...' });

    for (const [relatie_id, ids] of groepen) {
      // Supabase .in() max ~500 IDs — split if needed
      const BATCH = 500;
      for (let i = 0; i < ids.length; i += BATCH) {
        const batch = ids.slice(i, i + BATCH);
        const { error } = await supabase.from('voertuigen').update({ relatie_id }).in('id', batch);
        if (error) { setFout('Koppelfout: ' + error.message); setBezig(false); return; }
        gedaan += batch.length;
        setVoortgang({ huidig: gedaan, totaal: teKoppelen.length, fase: 'Koppelen...' });
      }
    }

    onSuccess();
  }

  const counts = {
    koppelen: rijenEffectief.filter((r) => r.status === 'koppelen').length,
    al_gekoppeld: rijenEffectief.filter((r) => r.status === 'al_gekoppeld').length,
    geen_relatie: rijenEffectief.filter((r) => r.status === 'geen_relatie').length,
    geen_voertuig: rijenEffectief.filter((r) => r.status === 'geen_voertuig').length,
  };

  const zichtbaar = toonFilter ? rijenEffectief.filter((r) => r.status === toonFilter) : rijenEffectief;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[90vh]">

        {/* Header */}
        <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
          <div>
            <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <RefreshCw className="w-5 h-5 text-primary" />
              Vloot herlinken
            </h2>
            <p className="text-sm text-gray-500">Koppelt bestaande voertuigen opnieuw aan locaties op basis van Crediteur nr.</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white rounded-full transition-colors shadow-sm">
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-4">
          {fout && (
            <div className="p-4 bg-red-50 border border-red-100 rounded-xl flex items-center gap-3 text-red-600 text-sm">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />{fout}
            </div>
          )}

          {bezig && rijen.length === 0 ? (
            <div className="py-16 text-center">
              <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto mb-3" />
              <p className="text-sm text-gray-500">{voortgang.fase}</p>
            </div>
          ) : rijen.length === 0 ? (
            <>
              <div className="border-2 border-dashed border-gray-200 rounded-2xl p-12 text-center hover:border-primary/50 transition-colors group">
                <label className="cursor-pointer">
                  <input type="file" accept=".csv" className="hidden"
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) parseCSV(f); }} />
                  <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:bg-primary/10 transition-colors">
                    <Upload className="w-8 h-8 text-gray-400 group-hover:text-primary transition-colors" />
                  </div>
                  <p className="text-sm font-semibold text-gray-700">Klik om het vloot CSV-bestand te uploaden</p>
                  <p className="text-xs text-gray-400 mt-1">Dezelfde CSV als bij de originele import</p>
                </label>
              </div>

              <div className="bg-blue-50 rounded-xl p-4 flex items-start gap-3">
                <FileText className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-blue-700 mb-1">Hoe werkt het?</p>
                  <ul className="text-xs text-blue-600 space-y-0.5">
                    <li>• Elk kenteken in de CSV wordt opgezocht in het systeem</li>
                    <li>• Via <strong>Crediteur nr.</strong> wordt de bijbehorende locatie gevonden</li>
                    <li>• De koppeling wordt bijgewerkt — bestaande voertuigdata blijft intact</li>
                    <li>• Voertuigen die al correct gekoppeld zijn worden overgeslagen</li>
                  </ul>
                </div>
              </div>
            </>
          ) : (
            <>
              {/* Toggle: alleen zonder locatie */}
              <label className="flex items-center gap-3 p-3 bg-amber-50 border border-amber-100 rounded-xl cursor-pointer hover:bg-amber-100/60 transition-colors">
                <input
                  type="checkbox"
                  checked={alleenZonder}
                  onChange={(e) => setAlleenZonder(e.target.checked)}
                  className="w-4 h-4 accent-primary"
                />
                <div>
                  <p className="text-sm font-semibold text-amber-800">Alleen voertuigen zonder locatie</p>
                  <p className="text-xs text-amber-600">Voertuigen die al een locatie hebben worden overgeslagen</p>
                </div>
                <span className="ml-auto text-xs font-bold text-amber-700 bg-amber-200 px-2 py-0.5 rounded-full">
                  {rijenEffectief.filter((r) => r.status === 'koppelen').length} te koppelen
                </span>
              </label>

              {/* Statistieken */}
              <div className="grid grid-cols-4 gap-3">
                {([
                  ['koppelen', 'Wordt gekoppeld', 'bg-green-50 border-green-100 text-green-700'],
                  ['al_gekoppeld', alleenZonder ? 'Overgeslagen' : 'Al correct', 'bg-gray-50 border-gray-100 text-gray-600'],
                  ['geen_relatie', 'Crediteur onbekend', 'bg-amber-50 border-amber-100 text-amber-700'],
                  ['geen_voertuig', 'Kenteken onbekend', 'bg-red-50 border-red-100 text-red-600'],
                ] as [Status, string, string][]).map(([key, label, kleur]) => (
                  <button
                    key={key}
                    onClick={() => setToonFilter(toonFilter === key ? '' : key)}
                    className={`border rounded-xl p-3 text-left transition-all ${kleur} ${toonFilter === key ? 'ring-2 ring-offset-1 ring-current' : 'hover:opacity-80'}`}
                  >
                    <p className="text-lg font-bold">{counts[key]}</p>
                    <p className="text-xs">{label}</p>
                  </button>
                ))}
              </div>

              <div className="flex items-center justify-between text-sm">
                <span className="font-semibold text-gray-700">
                  {rijen.length} regels geladen
                  {toonFilter && <span className="ml-2 text-xs text-gray-400">— gefilterd op: {STATUS_LABEL_BASIS[toonFilter]}</span>}
                </span>
                <button onClick={() => { setRijen([]); setToonFilter(''); }} className="text-primary hover:underline text-xs">
                  Ander bestand kiezen
                </button>
              </div>

              {counts.geen_relatie > 0 && (
                <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 text-xs text-amber-700 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <span>
                    <strong>{counts.geen_relatie} voertuigen</strong> hebben een crediteurennummer dat niet in het systeem staat.
                    Controleer de spelling of voeg de relatie eerst toe in het relaties-overzicht.
                  </span>
                </div>
              )}

              {/* Preview tabel */}
              <div className="border border-gray-200 rounded-xl overflow-hidden">
                <table className="w-full text-xs text-left">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-3 py-2 font-semibold text-gray-500">Kenteken</th>
                      <th className="px-3 py-2 font-semibold text-gray-500">Crediteur nr. (CSV)</th>
                      <th className="px-3 py-2 font-semibold text-gray-500">Gekoppelde locatie</th>
                      <th className="px-3 py-2 font-semibold text-gray-500">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {zichtbaar.slice(0, 100).map((r, i) => (
                      <tr key={i} className="hover:bg-gray-50/60">
                        <td className="px-3 py-2 font-mono font-semibold text-gray-800">{r.kenteken}</td>
                        <td className="px-3 py-2 font-mono text-gray-500">{r.crediteurnummer_csv || <span className="text-gray-300 italic">—</span>}</td>
                        <td className="px-3 py-2 text-gray-700">
                          {r.relatie_naam
                            ? <span className="flex items-center gap-1"><Link2 className="w-3 h-3 text-green-500" />{r.relatie_naam}</span>
                            : r.relatienaam_csv
                              ? <span className="text-gray-400 italic">{r.relatienaam_csv}</span>
                              : <span className="text-gray-300 italic">—</span>
                          }
                        </td>
                        <td className="px-3 py-2">
                          <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold ${STATUS_KLEUR[r.status]}`}>
                            {STATUS_LABEL_BASIS[r.status]}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {zichtbaar.length > 100 && (
                  <div className="px-3 py-2 bg-gray-50 text-[10px] text-gray-400 text-center border-t border-gray-100">
                    Eerste 100 van {zichtbaar.length} getoond
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 bg-gray-50 border-t border-gray-100 flex items-center justify-between">
          <button onClick={onClose} className="px-4 py-2 text-sm font-semibold text-gray-600 hover:text-gray-800 transition-colors">
            Annuleren
          </button>
          {bezig && rijen.length > 0 ? (
            <div className="flex flex-col items-end gap-2">
              <div className="flex items-center gap-2 text-primary font-bold text-sm">
                <Loader2 className="w-4 h-4 animate-spin" />
                {voortgang.fase} {voortgang.huidig}/{voortgang.totaal}
              </div>
              <div className="w-48 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                <div className="h-full bg-primary transition-all duration-300"
                  style={{ width: `${voortgang.totaal > 0 ? (voortgang.huidig / voortgang.totaal) * 100 : 0}%` }} />
              </div>
            </div>
          ) : (
            <button
              onClick={herlink}
              disabled={counts.koppelen === 0 || bezig}
              className="flex items-center gap-2 px-6 py-2 bg-primary text-white rounded-lg text-sm font-bold shadow-lg shadow-primary/20 hover:bg-primary/90 disabled:opacity-50 disabled:shadow-none transition-all"
            >
              <Check className="w-4 h-4" />
              {counts.koppelen > 0
                ? `Koppel ${counts.koppelen} voertuigen`
                : rijen.length > 0 ? 'Niets te koppelen' : 'Selecteer een bestand'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
