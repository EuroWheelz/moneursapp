'use client';

import { useState } from 'react';
import Papa from 'papaparse';
import { X, Upload, Check, AlertCircle, Loader2, FileText, Download } from 'lucide-react';
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

function parsePrijs(s: string): number | null {
  if (!s?.trim()) return null;
  const cleaned = s.trim().replace(/[€$£\s]/g, '').replace(',', '.');
  const n = parseFloat(cleaned);
  return isNaN(n) ? null : n;
}

type OnderdeelRij = {
  naam: string;
  artikelcode: string;
  prijs: number | null;
  vestiging: string;
};

export default function ImportOnderdelenModal({ onClose, onSuccess }: Props) {
  const [rijen, setRijen] = useState<OnderdeelRij[]>([]);
  const [bezig, setBezig] = useState(false);
  const [fout, setFout] = useState<string | null>(null);
  const [voortgang, setVoortgang] = useState({ huidig: 0, totaal: 0 });

  function parseCSV(file: File) {
    setFout(null);
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      delimiter: '',
      complete: (results) => {
        if (results.errors.length > 0) {
          setFout('CSV-fout: ' + results.errors[0].message);
          return;
        }

        const gemapped = (results.data as Record<string, string>[])
          .map((r) => {
            const naam = get(r, 'Omschrijving', 'Naam', 'naam', 'Description');
            if (!naam) return null;
            return {
              naam,
              artikelcode: get(r, 'Artikelcode', 'Artikel', 'Code', 'artikelcode'),
              prijs: parsePrijs(get(r, 'Prijs', 'Verkoopprijs', 'Price', 'prijs')),
              vestiging: get(r, 'Vestiging', 'Locatie', 'Branch', 'vestiging'),
            };
          })
          .filter(Boolean) as OnderdeelRij[];

        if (gemapped.length === 0) {
          setFout('Geen onderdelen gevonden. Controleer of de kolom "Omschrijving" aanwezig is.');
          return;
        }
        setRijen(gemapped);
      },
    });
  }

  async function importeer() {
    if (rijen.length === 0) return;
    setBezig(true);
    setFout(null);

    const BATCH = 500;
    let totaal = 0;
    for (let i = 0; i < rijen.length; i += BATCH) {
      const batch = rijen.slice(i, i + BATCH).map((r) => ({
        naam: r.naam,
        artikelcode: r.artikelcode,
        prijs: r.prijs,
        vestiging: r.vestiging,
        categorie: 'Algemeen',
        actief: true,
      }));

      setVoortgang({ huidig: Math.min(i + BATCH, rijen.length), totaal: rijen.length });
      const { error } = await supabase.from('onderdelen').insert(batch);
      if (error) {
        setFout(`Importfout (batch ${Math.floor(i / BATCH) + 1}): ${error.message}`);
        setBezig(false);
        return;
      }
      totaal += batch.length;
    }

    onSuccess();
  }

  function downloadTemplate() {
    const csv = [
      'Omschrijving,Artikelcode,Prijs,Vestiging',
      'Remblok voor,REM-001,12.50,Houten',
      'Accu 30Ah,ACC-030,189.00,Houten',
      'Binnenband 20 inch,BAND-20,8.95,Amsterdam',
    ].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'onderdelen-template.csv';
    link.click();
  }

  const vestinigen = [...new Set(rijen.map((r) => r.vestiging).filter(Boolean))];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl overflow-hidden flex flex-col max-h-[90vh]">

        {/* Header */}
        <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Onderdelen importeren</h2>
            <p className="text-sm text-gray-500">Upload een CSV met Omschrijving, Artikelcode, Prijs en Vestiging</p>
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
              <div className="border-2 border-dashed border-gray-200 rounded-2xl p-12 text-center hover:border-primary/50 transition-colors group">
                <label className="cursor-pointer">
                  <input type="file" accept=".csv" className="hidden"
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) parseCSV(f); }} />
                  <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:bg-primary/10 transition-colors">
                    <Upload className="w-8 h-8 text-gray-400 group-hover:text-primary transition-colors" />
                  </div>
                  <p className="text-sm font-semibold text-gray-700">Klik om een CSV-bestand te uploaden</p>
                  <p className="text-xs text-gray-400 mt-1">Komma- én puntkomma-gescheiden bestanden worden herkend</p>
                </label>
              </div>

              <div className="bg-blue-50 rounded-xl p-4 flex items-start gap-3">
                <FileText className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-blue-700 mb-1">Herkende kolomnamen</p>
                  <p className="font-mono text-xs text-blue-600">
                    Omschrijving · Artikelcode · Prijs · Vestiging
                  </p>
                  <p className="text-xs text-blue-500 mt-1.5">
                    Prijs mag €-teken bevatten en komma als decimaalteken.
                    Alle onderdelen worden op categorie "Algemeen" gezet — daarna handmatig aan te passen.
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
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-gray-50 border border-gray-100 rounded-xl p-3">
                  <p className="text-lg font-bold text-gray-800">{rijen.length}</p>
                  <p className="text-xs text-gray-500">Onderdelen</p>
                </div>
                <div className="bg-blue-50 border border-blue-100 rounded-xl p-3">
                  <p className="text-lg font-bold text-blue-700">{rijen.filter((r) => r.artikelcode).length}</p>
                  <p className="text-xs text-blue-600">Met artikelcode</p>
                </div>
                <div className="bg-green-50 border border-green-100 rounded-xl p-3">
                  <p className="text-lg font-bold text-green-700">{vestinigen.length}</p>
                  <p className="text-xs text-green-600">
                    {vestinigen.length > 0 ? vestinigen.slice(0, 2).join(', ') + (vestinigen.length > 2 ? '...' : '') : 'Vestigingen'}
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-between text-sm">
                <span className="font-semibold text-gray-700">{rijen.length} onderdelen geladen</span>
                <button onClick={() => setRijen([])} className="text-primary hover:underline text-xs">Ander bestand kiezen</button>
              </div>

              <div className="border border-gray-200 rounded-xl overflow-hidden">
                <table className="w-full text-xs text-left">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-3 py-2 font-semibold text-gray-500">Omschrijving</th>
                      <th className="px-3 py-2 font-semibold text-gray-500">Artikelcode</th>
                      <th className="px-3 py-2 font-semibold text-gray-500">Prijs</th>
                      <th className="px-3 py-2 font-semibold text-gray-500">Vestiging</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {rijen.slice(0, 50).map((r, i) => (
                      <tr key={i} className="hover:bg-gray-50/60">
                        <td className="px-3 py-2 font-medium text-gray-800">{r.naam}</td>
                        <td className="px-3 py-2 font-mono text-gray-500">{r.artikelcode || <span className="text-gray-300 italic">—</span>}</td>
                        <td className="px-3 py-2 text-gray-600">
                          {r.prijs != null
                            ? `€ ${r.prijs.toFixed(2)}`
                            : <span className="text-gray-300 italic">—</span>}
                        </td>
                        <td className="px-3 py-2 text-gray-500">{r.vestiging || <span className="text-gray-300 italic">—</span>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {rijen.length > 50 && (
                  <div className="px-3 py-2 bg-gray-50 text-[10px] text-gray-400 text-center border-t border-gray-100">
                    Voorvertoning: eerste 50 van {rijen.length} — alle {rijen.length} worden geïmporteerd
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
            <button onClick={importeer} disabled={rijen.length === 0}
              className="flex items-center gap-2 px-6 py-2 bg-primary text-white rounded-lg text-sm font-bold shadow-lg shadow-primary/20 hover:bg-primary/90 disabled:opacity-50 disabled:shadow-none transition-all">
              <Check className="w-4 h-4" />
              {rijen.length > 0 ? `Importeer ${rijen.length} onderdelen` : 'Selecteer een bestand'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
