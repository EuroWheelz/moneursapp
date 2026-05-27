'use client';

import { useState } from 'react';
import Papa from 'papaparse';
import { X, Upload, Check, AlertCircle, Loader2, FileText, Download } from 'lucide-react';
import { supabase } from '@/lib/supabase';

interface ImportLocatiesModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

type PreviewRij = {
  naam: string;
  crediteurnummer: string;
  type: string;
  adres: string;
  postcode: string;
  plaats: string;
  land: string;
  telefoon: string;
  email: string;
  contactpersoon: string;
  echopers: number;
  accus: number;
  openingstijden: string;
};

function get(r: Record<string, string>, ...keys: string[]): string {
  for (const key of keys) {
    const val = r[key] ?? r[key.toLowerCase()] ?? r[key.toUpperCase()];
    if (val?.trim()) return val.trim();
    // ook zoeken zonder accenten / speciale tekens
    const found = Object.entries(r).find(([k]) =>
      k.trim().toLowerCase() === key.trim().toLowerCase()
    );
    if (found?.[1]?.trim()) return found[1].trim();
  }
  return '';
}

export default function ImportLocatiesModal({ onClose, onSuccess }: ImportLocatiesModalProps) {
  const [rijen, setRijen] = useState<PreviewRij[]>([]);
  const [bezig, setBezig] = useState(false);
  const [fout, setFout] = useState<string | null>(null);
  const [voortgang, setVoortgang] = useState({ huidig: 0, totaal: 0 });

  function parseCSV(file: File) {
    setFout(null);
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      delimiter: '',       // auto-detect , of ;
      complete: (results) => {
        if (results.errors.length > 0) {
          setFout('CSV-fout: ' + results.errors[0].message);
          return;
        }
        const gemapped = (results.data as Record<string, string>[]).map((r) => {
          const label = get(r, 'Label');
          const parkHotel = get(r, 'Park/Hotel', 'Park', 'Hotel', 'naam', 'name');
          const naam = label ? `${label} ${parkHotel}`.trim() : parkHotel;

          return {
            naam,
            crediteurnummer: get(r, 'Crediteur nr.', 'Crediteur nr', 'crediteurnummer', 'Crediteur'),
            type: (get(r, 'type', 'Type') || 'consignatie').toLowerCase(),
            adres: get(r, 'Adres', 'adres', 'address'),
            postcode: get(r, 'Postcode', 'postcode', 'postal_code'),
            plaats: get(r, 'Plaats', 'plaats', 'stad', 'city'),
            land: (get(r, 'Land', 'land', 'country') || 'NL').toUpperCase(),
            telefoon: get(r, 'Algemeen telefoonnummer', 'telefoon', 'Telefoonnummer', 'phone'),
            email: get(r, 'Algemeen e-mailadres', 'email', 'e-mailadres', 'E-mailadres'),
            contactpersoon: get(r, 'contactpersoon', 'contact'),
            echopers: parseInt(get(r, 'echopers') || '0') || 0,
            accus: parseInt(get(r, 'accus') || '0') || 0,
            openingstijden: get(r, 'openingstijden'),
          };
        }).filter((r) => r.naam.trim() !== '');

        if (gemapped.length === 0) {
          setFout('Geen geldige rijen gevonden. Controleer of de kolommen "Label" en/of "Park/Hotel" aanwezig zijn.');
          return;
        }
        setRijen(gemapped);
      },
    });
  }

  async function geocodeer(rij: PreviewRij): Promise<{ lat: number | null; lng: number | null }> {
    const query = [rij.adres, rij.postcode, rij.plaats, rij.land].filter(Boolean).join(', ');
    try {
      const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1&addressdetails=0`;
      const res = await fetch(url, {
        headers: { 'User-Agent': 'EuroWheelz-Plansysteem/1.0 (contact@eurowheelz.nl)' },
      });
      const json = await res.json();
      if (json[0]) {
        return { lat: parseFloat(json[0].lat), lng: parseFloat(json[0].lon) };
      }
    } catch {}
    return { lat: null, lng: null };
  }

  async function importeer() {
    if (rijen.length === 0) return;
    setBezig(true);
    setFout(null);
    setVoortgang({ huidig: 0, totaal: rijen.length });

    // Fallback auto-nummering voor rijen zonder crediteursnummer
    const { data: bestaand } = await supabase
      .from('relaties')
      .select('crediteurnummer')
      .not('crediteurnummer', 'is', null)
      .order('crediteurnummer', { ascending: false })
      .limit(1);

    const lastNum = bestaand?.[0]?.crediteurnummer
      ? parseInt((bestaand[0].crediteurnummer as string).replace(/\D/g, '')) || 0
      : 0;
    let autoIndex = 0;

    const inserts = [];

    for (let i = 0; i < rijen.length; i++) {
      const rij = rijen[i];
      const coords = await geocodeer(rij);

      // Gebruik meegeleverd crediteursnummer, anders auto-genereren
      const crediteursnummer = rij.crediteurnummer || `EW-${String(lastNum + ++autoIndex).padStart(4, '0')}`;

      inserts.push({
        crediteurnummer: crediteursnummer,
        naam: rij.naam.trim(),
        type: rij.type || 'consignatie',
        status: 'actief',
        land: rij.land,
        adres: rij.adres.trim(),
        postcode: rij.postcode.trim(),
        plaats: rij.plaats.trim(),
        lat: coords.lat,
        lng: coords.lng,
        telefoon: rij.telefoon.trim(),
        email: rij.email.trim(),
        contactpersoon: rij.contactpersoon.trim(),
        echopers: rij.echopers,
        accus: rij.accus,
        openingstijden: rij.openingstijden.trim(),
        mail_werkbon: true,
        mail_afspraakbevestiging: true,
        mail_nieuwsbrief: false,
      });

      setVoortgang({ huidig: i + 1, totaal: rijen.length });

      // Nominatim rate limit: max 1 request/seconde
      if (i < rijen.length - 1) {
        await new Promise((r) => setTimeout(r, 1100));
      }
    }

    const { error } = await supabase.from('relaties').insert(inserts);
    if (error) {
      setFout('Importfout: ' + error.message);
      setBezig(false);
      return;
    }

    onSuccess();
  }

  function downloadTemplate() {
    const csv = [
      'Label,Park/Hotel,Crediteur nr.,Algemeen telefoonnummer,Algemeen e-mailadres,Adres,Postcode,Plaats,Land',
      'Strandhotel,Scheveningen,EW-0001,+31 70 123 4567,info@strandhotel.nl,Strandweg 1,2586 AA,Scheveningen,NL',
      'Vakantiepark,De Koog,,+31 222 123 456,info@vakantiepark.nl,Duinweg 3,1796 AB,De Koog,NL',
      ',Individuele verhuurlocatie,EW-0003,+31 6 1234 5678,info@klant.nl,Dorpsstraat 5,1234 AB,Amsterdam,NL',
    ].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'locaties-template.csv';
    link.click();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl overflow-hidden flex flex-col max-h-[90vh]">

        {/* Header */}
        <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Locaties importeren</h2>
            <p className="text-sm text-gray-500">Upload een CSV-bestand — coördinaten worden automatisch opgezocht via OpenStreetMap</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white rounded-full transition-colors shadow-sm">
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-4">
          {fout && (
            <div className="p-4 bg-red-50 border border-red-100 rounded-xl flex items-center gap-3 text-red-600 text-sm">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              {fout}
            </div>
          )}

          {rijen.length === 0 ? (
            <>
              <div className="border-2 border-dashed border-gray-200 rounded-2xl p-12 text-center hover:border-primary/50 transition-colors group">
                <label className="cursor-pointer">
                  <input
                    type="file"
                    accept=".csv"
                    className="hidden"
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) parseCSV(f); }}
                  />
                  <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:bg-primary/10 transition-colors">
                    <Upload className="w-8 h-8 text-gray-400 group-hover:text-primary transition-colors" />
                  </div>
                  <p className="text-sm font-semibold text-gray-700">Klik om een CSV-bestand te uploaden</p>
                  <p className="text-xs text-gray-400 mt-1">Verplicht: Label en/of Park/Hotel, Adres, Postcode, Plaats</p>
                </label>
              </div>

              <div className="bg-blue-50 rounded-xl p-4 flex items-start gap-3">
                <FileText className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-blue-700 mb-1">Herkende kolomnamen (jouw formaat)</p>
                  <p className="font-mono text-xs text-blue-600 break-all">
                    Label · Park/Hotel · Crediteur nr. · Algemeen telefoonnummer · Algemeen e-mailadres · Adres · Postcode · Plaats · Land
                  </p>
                  <p className="text-xs text-blue-500 mt-1.5">
                    <strong>Label + Park/Hotel</strong> wordt samengevoegd tot de locatienaam. Bij individuele verhuurlocaties alleen Park/Hotel invullen.
                    Komma- én puntkomma-gescheiden bestanden worden herkend.
                  </p>
                </div>
                <button
                  onClick={downloadTemplate}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-xs font-semibold rounded-lg hover:bg-blue-700 transition-colors flex-shrink-0"
                >
                  <Download className="w-3.5 h-3.5" />
                  Template
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="flex items-center justify-between text-sm">
                <span className="font-semibold text-gray-700">{rijen.length} locaties geladen</span>
                <button onClick={() => setRijen([])} className="text-primary hover:underline text-xs">
                  Ander bestand kiezen
                </button>
              </div>

              <div className="border border-gray-200 rounded-xl overflow-hidden">
                <table className="w-full text-xs text-left">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-3 py-2 font-semibold text-gray-500">Naam (samengevoegd)</th>
                      <th className="px-3 py-2 font-semibold text-gray-500">Crediteur nr.</th>
                      <th className="px-3 py-2 font-semibold text-gray-500">Adres</th>
                      <th className="px-3 py-2 font-semibold text-gray-500">Postcode</th>
                      <th className="px-3 py-2 font-semibold text-gray-500">Plaats</th>
                      <th className="px-3 py-2 font-semibold text-gray-500">Land</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {rijen.slice(0, 20).map((r, i) => (
                      <tr key={i} className="hover:bg-gray-50/60">
                        <td className="px-3 py-2 font-medium text-gray-800">{r.naam}</td>
                        <td className="px-3 py-2 text-gray-400 font-mono">{r.crediteurnummer || <span className="italic">auto</span>}</td>
                        <td className="px-3 py-2 text-gray-500">{r.adres}</td>
                        <td className="px-3 py-2 text-gray-500">{r.postcode}</td>
                        <td className="px-3 py-2 text-gray-500">{r.plaats}</td>
                        <td className="px-3 py-2 text-gray-500">{r.land}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {rijen.length > 20 && (
                  <div className="px-3 py-2 bg-gray-50 text-[10px] text-gray-400 text-center border-t border-gray-100">
                    En {rijen.length - 20} meer rijen...
                  </div>
                )}
              </div>

              <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 text-xs text-amber-700 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                Coördinaten worden opgezocht via OpenStreetMap (max 1/sec). Geschatte duur: ~{rijen.length} seconden.
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 bg-gray-50 border-t border-gray-100 flex items-center justify-between">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-semibold text-gray-600 hover:text-gray-800 transition-colors"
          >
            Annuleren
          </button>

          {bezig ? (
            <div className="flex flex-col items-end gap-2">
              <div className="flex items-center gap-2 text-primary font-bold text-sm">
                <Loader2 className="w-4 h-4 animate-spin" />
                Geocoderen {voortgang.huidig} / {voortgang.totaal}...
              </div>
              <div className="w-48 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary transition-all duration-300"
                  style={{ width: `${(voortgang.huidig / voortgang.totaal) * 100}%` }}
                />
              </div>
            </div>
          ) : (
            <button
              onClick={importeer}
              disabled={rijen.length === 0}
              className="flex items-center gap-2 px-6 py-2 bg-primary text-white rounded-lg text-sm font-bold shadow-lg shadow-primary/20 hover:bg-primary/90 disabled:opacity-50 disabled:shadow-none transition-all"
            >
              <Check className="w-4 h-4" />
              {rijen.length > 0 ? `Importeer ${rijen.length} locaties` : 'Selecteer een bestand'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
