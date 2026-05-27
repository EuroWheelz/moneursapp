'use client';

import { useState, useRef } from 'react';
import { X, Upload, Check, AlertCircle, Loader2, FileText, ClipboardPaste, Battery, Download } from 'lucide-react';
import { supabase } from '@/lib/supabase';

interface Props { onClose: () => void; onSuccess: () => void; }

type AccuRij = {
  crediteurnummer: string;
  nieuw_30ah: number;
  nieuw_20ah: number;
  oud_20ah: number;
  totaal: number;
  relatieId?: string;
  relatieNaam?: string;
  gevonden: boolean;
};

function parseerAantal(s: string): number {
  if (!s?.trim()) return 0;
  const n = parseInt(s.trim().replace(/[^0-9]/g, ''), 10);
  return isNaN(n) ? 0 : n;
}

function parseerTekst(tekst: string): AccuRij[] {
  const regels = tekst.split('\n').map((r) => r.trim()).filter(Boolean);
  if (regels.length === 0) return [];

  // Detecteer scheidingsteken
  const scheiding = regels[0].includes('\t') ? '\t' : regels[0].includes(';') ? ';' : ',';

  // Eerste rij is header — zoek kolomindices
  const headers = regels[0].split(scheiding).map((h) => h.trim().toLowerCase());

  function vindKolom(...zoekTermen: string[]): number {
    for (const term of zoekTermen) {
      const idx = headers.findIndex((h) => h.includes(term.toLowerCase()));
      if (idx >= 0) return idx;
    }
    return -1;
  }

  const colCredit   = vindKolom('crediteur', 'credit');
  // Gebruik specifieke termen zodat "Nieuw 20Ah" en "Oud 20Ah" niet door elkaar worden gehaald
  const col30ah     = vindKolom('30ah', '30 ah', 'nieuw 30', 'new 30');
  const col20ah     = vindKolom('nieuw 20', 'new 20', 'nieuw20');
  const colOud20ah  = vindKolom('oud 20', 'old 20', 'oud20');

  if (colCredit < 0) return [];

  const rijen: AccuRij[] = [];
  for (let i = 1; i < regels.length; i++) {
    const cellen = regels[i].split(scheiding).map((c) => c.trim());
    const crediteur = cellen[colCredit]?.trim().replace(/[^0-9a-zA-Z\-]/g, '');
    if (!crediteur) continue;
    const n30  = col30ah    >= 0 ? parseerAantal(cellen[col30ah])    : 0;
    const n20  = col20ah    >= 0 ? parseerAantal(cellen[col20ah])    : 0;
    const nOud = colOud20ah >= 0 ? parseerAantal(cellen[colOud20ah]) : 0;
    if (n30 + n20 + nOud === 0) continue;
    rijen.push({ crediteurnummer: crediteur, nieuw_30ah: n30, nieuw_20ah: n20, oud_20ah: nOud, totaal: n30 + n20 + nOud, gevonden: false });
  }
  return rijen;
}

export default function ImportAccusModal({ onClose, onSuccess }: Props) {
  const [rijen, setRijen]           = useState<AccuRij[]>([]);
  const [plakTekst, setPlakTekst]   = useState('');
  const [bezig, setBezigState]      = useState(false);
  const [fout, setFout]             = useState<string | null>(null);
  const [voortgang, setVoortgang]   = useState({ huidig: 0, totaal: 0 });
  const [invoerMethode, setInvoer]  = useState<'upload' | 'plak'>('upload');
  const fileRef = useRef<HTMLInputElement>(null);

  async function valideerEnLaad(tekst: string) {
    setFout(null);
    const parsed = parseerTekst(tekst);
    if (parsed.length === 0) {
      setFout('Geen rijen gevonden. Zorg dat de eerste rij kolomkoppen bevat, waaronder "Crediteur nr." en ten minste één van: Nieuw 36Ah, Nieuw 20Ah, Oud 35Ah.');
      return;
    }

    // Zoek relaties op via crediteurnummer
    const nummers = [...new Set(parsed.map((r) => r.crediteurnummer))];
    const { data: gevonden } = await supabase
      .from('relaties')
      .select('id, naam, crediteurnummer')
      .in('crediteurnummer', nummers);

    const kaart = new Map<string, { id: string; naam: string }>();
    (gevonden ?? []).forEach((r: any) => kaart.set(r.crediteurnummer, { id: r.id, naam: r.naam }));

    const bijgewerkt = parsed.map((r) => {
      const rel = kaart.get(r.crediteurnummer);
      return { ...r, relatieId: rel?.id, relatieNaam: rel?.naam, gevonden: !!rel };
    });

    setRijen(bijgewerkt);
  }

  function parseBestand(file: File) {
    const reader = new FileReader();
    reader.onload = (e) => {
      const tekst = e.target?.result as string;
      valideerEnLaad(tekst);
    };
    reader.readAsText(file, 'utf-8');
  }

  async function importeer() {
    const teImporteren = rijen.filter((r) => r.gevonden && r.relatieId);
    if (teImporteren.length === 0) return;
    setBezigState(true);
    setFout(null);
    setVoortgang({ huidig: 0, totaal: teImporteren.length });

    for (let i = 0; i < teImporteren.length; i++) {
      const r = teImporteren[i];
      const relatieId = r.relatieId!;

      // Upsert per type
      const invoer = [
        { relatie_id: relatieId, type: 'Nieuw 30Ah', aantal: r.nieuw_30ah, updated_at: new Date().toISOString() },
        { relatie_id: relatieId, type: 'Nieuw 20Ah', aantal: r.nieuw_20ah, updated_at: new Date().toISOString() },
        { relatie_id: relatieId, type: 'Oud 20Ah',   aantal: r.oud_20ah,   updated_at: new Date().toISOString() },
      ].filter((x) => x.aantal > 0);

      if (invoer.length > 0) {
        const { error } = await supabase
          .from('accu_inventaris')
          .upsert(invoer, { onConflict: 'relatie_id,type' });
        if (error) {
          setFout(`Fout bij ${r.relatieNaam ?? r.crediteurnummer}: ${error.message}`);
          setBezigState(false);
          return;
        }
      }

      // Update relaties.accus met totaal
      await supabase.from('relaties').update({ accus: r.totaal }).eq('id', relatieId);

      setVoortgang({ huidig: i + 1, totaal: teImporteren.length });
    }

    onSuccess();
  }

  function downloadTemplate() {
    const csv = ['Crediteur nr.\tNieuw 30Ah\tNieuw 20Ah\tOud 20Ah', '4437\t5\t\t', '3308\t\t3\t2'].join('\n');
    const blob = new Blob([csv], { type: 'text/tab-separated-values;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'accu-template.tsv';
    a.click();
  }

  const gevonden  = rijen.filter((r) => r.gevonden).length;
  const onbekend  = rijen.filter((r) => !r.gevonden).length;
  const totaalAcc = rijen.filter((r) => r.gevonden).reduce((s, r) => s + r.totaal, 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl overflow-hidden flex flex-col max-h-[90vh]">

        {/* Header */}
        <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Accu&apos;s importeren</h2>
            <p className="text-sm text-gray-500">Koppel accu-aantallen per type aan locaties via crediteur&shy;nummer</p>
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

          {rijen.length === 0 ? (
            <>
              {/* Methode tabs */}
              <div className="flex rounded-lg border border-gray-200 overflow-hidden text-sm font-semibold">
                <button
                  onClick={() => setInvoer('upload')}
                  className={`flex-1 py-2 flex items-center justify-center gap-2 transition-colors ${invoerMethode === 'upload' ? 'bg-primary text-white' : 'text-gray-500 hover:bg-gray-50'}`}
                >
                  <Upload className="w-4 h-4" /> Bestand uploaden
                </button>
                <button
                  onClick={() => setInvoer('plak')}
                  className={`flex-1 py-2 flex items-center justify-center gap-2 transition-colors ${invoerMethode === 'plak' ? 'bg-primary text-white' : 'text-gray-500 hover:bg-gray-50'}`}
                >
                  <ClipboardPaste className="w-4 h-4" /> Plakken uit Excel
                </button>
              </div>

              {invoerMethode === 'upload' ? (
                <div className="border-2 border-dashed border-gray-200 rounded-2xl p-10 text-center hover:border-primary/50 transition-colors group">
                  <label className="cursor-pointer">
                    <input ref={fileRef} type="file" accept=".csv,.tsv,.txt,.xls,.xlsx" className="hidden"
                      onChange={(e) => { const f = e.target.files?.[0]; if (f) parseBestand(f); }} />
                    <div className="w-14 h-14 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-3 group-hover:bg-primary/10 transition-colors">
                      <Battery className="w-7 h-7 text-gray-400 group-hover:text-primary transition-colors" />
                    </div>
                    <p className="text-sm font-semibold text-gray-700">Klik om een bestand te uploaden</p>
                    <p className="text-xs text-gray-400 mt-1">CSV, TSV of tekstbestand — komma, puntkomma of tab als scheidingsteken</p>
                  </label>
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-xs text-gray-500">Kopieer de tabel uit Excel (Ctrl+C) en plak hem hieronder:</p>
                  <textarea
                    rows={8}
                    className="w-full px-3 py-2 text-xs font-mono border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 bg-gray-50"
                    placeholder={"Crediteur nr.\tNieuw 30Ah\tNieuw 20Ah\tOud 20Ah\n4437\t5\t\t\n3308\t\t3\t2"}
                    value={plakTekst}
                    onChange={(e) => setPlakTekst(e.target.value)}
                  />
                  <button
                    onClick={() => valideerEnLaad(plakTekst)}
                    disabled={!plakTekst.trim()}
                    className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg text-sm font-semibold disabled:opacity-50 hover:bg-primary/90 transition-colors"
                  >
                    <Check className="w-4 h-4" /> Verwerken
                  </button>
                </div>
              )}

              <div className="bg-blue-50 rounded-xl p-4 flex items-start gap-3">
                <FileText className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-blue-700 mb-1">Verwachte kolommen</p>
                  <p className="font-mono text-xs text-blue-600">Crediteur nr. · Nieuw 30Ah · Nieuw 20Ah · Oud 20Ah</p>
                  <p className="text-xs text-blue-500 mt-1">
                    Kolomnamen worden flexibel herkend (ook deels). Lege cellen = 0. Rijen zonder accu&apos;s worden overgeslagen.
                    Locaties worden gekoppeld via het crediteurnummer.
                  </p>
                </div>
                <button onClick={downloadTemplate}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-xs font-semibold rounded-lg hover:bg-blue-700 transition-colors flex-shrink-0">
                  <Download className="w-3.5 h-3.5" />
                  Template
                </button>
              </div>
            </>
          ) : (
            <>
              {/* Statistieken */}
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-green-50 border border-green-100 rounded-xl p-3">
                  <p className="text-lg font-bold text-green-700">{gevonden}</p>
                  <p className="text-xs text-green-600">Locaties gevonden</p>
                </div>
                <div className={`border rounded-xl p-3 ${onbekend > 0 ? 'bg-amber-50 border-amber-100' : 'bg-gray-50 border-gray-100'}`}>
                  <p className={`text-lg font-bold ${onbekend > 0 ? 'text-amber-600' : 'text-gray-400'}`}>{onbekend}</p>
                  <p className={`text-xs ${onbekend > 0 ? 'text-amber-500' : 'text-gray-400'}`}>Niet gevonden</p>
                </div>
                <div className="bg-yellow-50 border border-yellow-100 rounded-xl p-3">
                  <p className="text-lg font-bold text-yellow-700">{totaalAcc}</p>
                  <p className="text-xs text-yellow-600">Accu&apos;s totaal</p>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-gray-700">{rijen.length} rijen geladen</span>
                <button onClick={() => setRijen([])} className="text-primary hover:underline text-xs">Ander bestand / andere tekst</button>
              </div>

              {/* Tabel */}
              <div className="border border-gray-200 rounded-xl overflow-hidden">
                <table className="w-full text-xs text-left">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-3 py-2 font-semibold text-gray-500">Crediteur nr.</th>
                      <th className="px-3 py-2 font-semibold text-gray-500">Locatie</th>
                      <th className="px-3 py-2 font-semibold text-gray-500 text-right">Nieuw 30Ah</th>
                      <th className="px-3 py-2 font-semibold text-gray-500 text-right">Nieuw 20Ah</th>
                      <th className="px-3 py-2 font-semibold text-gray-500 text-right">Oud 20Ah</th>
                      <th className="px-3 py-2 font-semibold text-gray-500 text-right">Totaal</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {rijen.slice(0, 100).map((r, i) => (
                      <tr key={i} className={r.gevonden ? 'hover:bg-gray-50/60' : 'bg-amber-50/40'}>
                        <td className="px-3 py-2 font-mono text-gray-600">{r.crediteurnummer}</td>
                        <td className="px-3 py-2 text-gray-800">
                          {r.gevonden
                            ? <span className="font-medium">{r.relatieNaam}</span>
                            : <span className="text-amber-600 italic">Niet gevonden</span>}
                        </td>
                        <td className="px-3 py-2 text-right text-gray-600">{r.nieuw_30ah || <span className="text-gray-300">—</span>}</td>
                        <td className="px-3 py-2 text-right text-gray-600">{r.nieuw_20ah || <span className="text-gray-300">—</span>}</td>
                        <td className="px-3 py-2 text-right text-gray-600">{r.oud_20ah   || <span className="text-gray-300">—</span>}</td>
                        <td className="px-3 py-2 text-right font-semibold text-gray-800">{r.totaal}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {rijen.length > 100 && (
                  <div className="px-3 py-2 bg-gray-50 text-[10px] text-gray-400 text-center border-t border-gray-100">
                    Eerste 100 van {rijen.length} — alle {rijen.length} worden geïmporteerd
                  </div>
                )}
              </div>

              {onbekend > 0 && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-700">
                  <strong>{onbekend} rijen</strong> konden niet worden gekoppeld aan een locatie (crediteurnummer onbekend). Deze worden overgeslagen.
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 bg-gray-50 border-t border-gray-100 flex items-center justify-between">
          <button onClick={onClose} className="px-4 py-2 text-sm font-semibold text-gray-600 hover:text-gray-800 transition-colors">
            Annuleren
          </button>
          {bezig ? (
            <div className="flex flex-col items-end gap-2">
              <div className="flex items-center gap-2 text-primary font-bold text-sm">
                <Loader2 className="w-4 h-4 animate-spin" />
                Importeren {voortgang.huidig}/{voortgang.totaal}...
              </div>
              <div className="w-48 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                <div className="h-full bg-primary transition-all duration-300"
                  style={{ width: `${(voortgang.huidig / voortgang.totaal) * 100}%` }} />
              </div>
            </div>
          ) : (
            <button
              onClick={importeer}
              disabled={gevonden === 0}
              className="flex items-center gap-2 px-6 py-2 bg-primary text-white rounded-lg text-sm font-bold shadow-lg shadow-primary/20 hover:bg-primary/90 disabled:opacity-50 disabled:shadow-none transition-all"
            >
              <Check className="w-4 h-4" />
              {gevonden > 0 ? `Importeer ${gevonden} locaties (${totaalAcc} accu's)` : 'Selecteer een bestand'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
