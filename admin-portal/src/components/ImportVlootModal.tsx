'use client';

import { useState } from 'react';
import Papa from 'papaparse';
import { X, Upload, Check, AlertCircle, Loader2, FileText, Download, Link2, Plus, MapPin } from 'lucide-react';
import { supabase } from '@/lib/supabase';

interface Props { onClose: () => void; onSuccess: () => void; }

// ── Helpers ─────────────────────────────────────────────────────

const KLEUR_MAP: Record<string, string> = {
  rood: '#E63946', red: '#E63946',
  blauw: '#457B9D', blue: '#457B9D',
  groen: '#345022', green: '#345022', donkergroen: '#345022',
  lichtgroen: '#4ade80',
  geel: '#E9C46A', yellow: '#E9C46A',
  oranje: '#F4A261', orange: '#F4A261',
  zwart: '#1A1A1A', black: '#1A1A1A',
  wit: '#F9FAFB', white: '#F9FAFB',
  grijs: '#9CA3AF', gray: '#9CA3AF', grey: '#9CA3AF',
  paars: '#7C3AED', purple: '#7C3AED',
  roze: '#EC4899', pink: '#EC4899',
  bruin: '#92400E', brown: '#92400E',
  zilver: '#D1D5DB', silver: '#D1D5DB',
  goud: '#F59E0B', gold: '#F59E0B',
};

function kleurNaarHex(s: string): string | null {
  if (!s?.trim()) return null;
  const l = s.toLowerCase().trim();
  if (KLEUR_MAP[l]) return KLEUR_MAP[l];
  if (/^#[0-9a-f]{3,6}$/i.test(s.trim())) return s.trim();
  return null;
}

function parseDatum(s: string): string | null {
  if (!s?.trim()) return null;
  const ddmmyyyy = s.trim().match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
  if (ddmmyyyy) return `${ddmmyyyy[3]}-${ddmmyyyy[2].padStart(2, '0')}-${ddmmyyyy[1].padStart(2, '0')}`;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s.trim())) return s.trim();
  return null;
}

// Case-insensitive match; also handles truncated column names ("Object stat..." starts with "Object stat")
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

function parseActief(s: string): boolean {
  const l = s.toLowerCase().trim();
  return l === 'ja' || l === 'yes' || l === 'true' || l === '1' || l === 'actief';
}

function mapObjectStatus(s: string): string {
  const l = s.toLowerCase().trim();
  if (!l) return 'Operationeel';
  if (l.includes('reparatie') && l.includes('loods')) return 'Reparatie in loods';
  if (l.includes('reparatie')) return 'Reparatie op locatie';
  if (l.includes('loods')) return 'In loods';
  if (l.includes('operationeel') || l.includes('operational')) return 'Operationeel';
  return 'Operationeel';
}

// ── Relaties ophalen (alle pagina's) ────────────────────────────

async function fetchAlleRelaties(): Promise<{ id: string; crediteurnummer: string | null; naam: string }[]> {
  const PAGE = 1000;
  const all: { id: string; crediteurnummer: string | null; naam: string }[] = [];
  let from = 0;
  while (true) {
    const { data } = await supabase
      .from('relaties')
      .select('id, crediteurnummer, naam')
      .range(from, from + PAGE - 1);
    if (!data || data.length === 0) break;
    all.push(...data);
    if (data.length < PAGE) break;
    from += PAGE;
  }
  return all;
}

// ── Types ────────────────────────────────────────────────────────

type VlootRij = {
  kenteken: string;
  model: string;
  uitvoering: string;
  tenaamstelling: string;
  barcode: string;
  meldcode: string;
  kleur_raw: string;
  kleur_hex: string | null;
  object_status: string;
  crediteurnummer: string;
  relatienaam: string;
  adres: string;
  postcode: string;
  plaats: string;
  land: string;
  laatste_onderhoud: string | null;
  volgend_onderhoud: string | null;
  opmerking: string;
  actief: boolean;
  contract_type: string;
  begindatum: string | null;
  einddatum: string | null;
  match: 'gevonden' | 'nieuw' | 'geen';
  relatie_id?: string;
  relatie_naam?: string;
};

const OBJECT_STATUS_STIJL: Record<string, string> = {
  Operationeel: 'bg-green-50 text-green-700',
  'Reparatie op locatie': 'bg-orange-50 text-orange-700',
  'Reparatie in loods': 'bg-red-50 text-red-700',
  'In loods': 'bg-gray-100 text-gray-600',
};

// ── Component ────────────────────────────────────────────────────

export default function ImportVlootModal({ onClose, onSuccess }: Props) {
  const [rijen, setRijen] = useState<VlootRij[]>([]);
  const [bezig, setBezig] = useState(false);
  const [fout, setFout] = useState<string | null>(null);
  const [voortgang, setVoortgang] = useState({ huidig: 0, totaal: 0, fase: '' });

  async function parseCSV(file: File) {
    setFout(null);
    setBezig(true);
    setVoortgang({ huidig: 0, totaal: 0, fase: 'Relaties ophalen...' });

    const bestaandeRelaties = await fetchAlleRelaties();
    const relatieMap = new Map<string, { id: string; naam: string }>();
    bestaandeRelaties.forEach((r) => {
      if (r.crediteurnummer) relatieMap.set(r.crediteurnummer.trim().toLowerCase(), { id: r.id, naam: r.naam });
    });

    setBezig(false);

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      delimiter: '',
      complete: (results) => {
        if (results.errors.length > 0) {
          setFout('CSV-fout: ' + results.errors[0].message);
          return;
        }

        const gemapped: VlootRij[] = (results.data as Record<string, string>[])
          .map((r) => {
            const kenteken = get(r, 'Kenteken');
            if (!kenteken) return null;

            const barcode = get(r, 'Barcode');
            const meldcode = barcode ? barcode.slice(-4) : '';
            const crediteur = get(r, 'Crediteur nr.', 'Crediteursnummer', 'Crediteur', 'Crediteurnr', 'Crediteur nr');
            const bestaand = crediteur ? relatieMap.get(crediteur.toLowerCase()) : undefined;
            const kleurRaw = get(r, 'Kleur');

            return {
              kenteken,
              model: get(r, 'Model'),
              uitvoering: get(r, 'Uitvoering'),
              tenaamstelling: get(r, 'Tenaamstelling'),
              barcode,
              meldcode,
              kleur_raw: kleurRaw,
              kleur_hex: kleurNaarHex(kleurRaw),
              object_status: mapObjectStatus(get(r, 'Object status', 'Objectstatus', 'Object stat', 'Object_status')),
              crediteurnummer: crediteur,
              relatienaam: get(r, 'Relatienaam', 'Relatie', 'Naam'),
              adres: get(r, 'Adres'),
              postcode: get(r, 'Postcode', 'Postco'),
              plaats: get(r, 'Plaats'),
              land: (get(r, 'Land') || 'NL').toUpperCase(),
              laatste_onderhoud: parseDatum(get(r, 'Laatste onderhoud', 'Laatste_onderhoud')),
              volgend_onderhoud: parseDatum(get(r, 'Volgend onderhoud', 'Volgend_onderhoud')),
              opmerking: get(r, 'Opmerking'),
              actief: parseActief(get(r, 'Actief', 'Actie')),
              contract_type: get(r, 'Contract Type', 'Contract Ty', 'ContractType', 'Contract_type'),
              begindatum: parseDatum(get(r, 'Begindatum', 'Begindatu')),
              einddatum: parseDatum(get(r, 'Einddatum', 'Einddatu')),
              match: bestaand ? 'gevonden' : crediteur ? 'nieuw' : 'geen',
              relatie_id: bestaand?.id,
              relatie_naam: bestaand?.naam,
            } as VlootRij;
          })
          .filter(Boolean) as VlootRij[];

        if (gemapped.length === 0) {
          setFout('Geen voertuigen gevonden. Controleer of de kolom "Kenteken" aanwezig is.');
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

    // 1. Maak unieke nieuwe relaties aan
    const nieuweCrediteuren = new Map<string, { crediteurnummer: string; naam: string; adres: string; postcode: string; plaats: string; land: string }>();
    rijen.filter((r) => r.match === 'nieuw' && r.crediteurnummer).forEach((r) => {
      if (!nieuweCrediteuren.has(r.crediteurnummer)) {
        nieuweCrediteuren.set(r.crediteurnummer, {
          crediteurnummer: r.crediteurnummer,
          naam: r.relatienaam || `Locatie ${r.crediteurnummer}`,
          adres: r.adres,
          postcode: r.postcode,
          plaats: r.plaats,
          land: r.land || 'NL',
        });
      }
    });

    const nieuwIds = new Map<string, string>();
    if (nieuweCrediteuren.size > 0) {
      setVoortgang({ huidig: 0, totaal: nieuweCrediteuren.size, fase: 'Nieuwe locaties aanmaken...' });
      const inserts = [...nieuweCrediteuren.values()].map((c) => ({
        ...c,
        type: 'consignatie',
        status: 'actief',
        onvolledig: true,
        telefoon: '',
        email: '',
        openingstijden: '',
        winterstalling_van: '',
        winterstalling_tot: '',
        mail_werkbon: true,
        mail_afspraakbevestiging: true,
        mail_nieuwsbrief: false,
        echopers: 0,
        accus: 0,
      }));

      const { data, error } = await supabase.from('relaties').insert(inserts).select('id, crediteurnummer');
      if (error) { setFout('Relaties aanmaken mislukt: ' + error.message); setBezig(false); return; }
      (data ?? []).forEach((r: any) => nieuwIds.set(r.crediteurnummer, r.id));
    }

    // 2. Voertuigen in batches van 500
    const BATCH = 500;
    const voertuigInserts = rijen.map((r) => {
      let relatie_id: string | null = null;
      if (r.match === 'gevonden') relatie_id = r.relatie_id ?? null;
      else if (r.match === 'nieuw') relatie_id = nieuwIds.get(r.crediteurnummer) ?? null;

      return {
        kenteken: r.kenteken,
        model: r.model,
        uitvoering: r.uitvoering,
        tenaamstelling: r.tenaamstelling,
        barcode: r.barcode,
        meldcode: r.meldcode,
        kleur: r.kleur_hex,
        object_status: r.object_status,
        relatie_id,
        laatste_onderhoud: r.laatste_onderhoud,
        volgend_onderhoud: r.volgend_onderhoud,
        opmerking: r.opmerking,
        actief: r.actief,
        contract_type: r.contract_type,
        begindatum: r.begindatum,
        einddatum: r.einddatum,
      };
    });

    for (let i = 0; i < voertuigInserts.length; i += BATCH) {
      const batch = voertuigInserts.slice(i, i + BATCH);
      setVoortgang({ huidig: Math.min(i + BATCH, voertuigInserts.length), totaal: voertuigInserts.length, fase: 'Voertuigen importeren...' });
      const { error } = await supabase.from('voertuigen').insert(batch);
      if (error) { setFout(`Importfout (batch ${i / BATCH + 1}): ${error.message}`); setBezig(false); return; }
    }

    onSuccess();
  }

  function downloadTemplate() {
    const csv = [
      'Barcode,Kenteken,Model,Tenaamstelling,Uitvoering,Kleur,Crediteur nr.,Relatienaam,Adres,Postcode,Plaats,Land,Laatste onderhoud,Volgend onderhoud,Opmerking,Actief,Contract Type,Begindatum,Einddatum,Object status',
      'BC-001,EW-0001-A,e-Chopper Pro,Jan Jansen,Standaard,Rood,EW-0001,Strandhotel Scheveningen,Strandweg 1,2586 AA,Scheveningen,NL,01-01-2025,01-07-2025,Kleine kras links,Ja,Consignatie,01-04-2024,31-03-2026,Operationeel',
      'BC-002,EW-0001-B,e-Chopper Pro,Jan Jansen,Sport,Blauw,EW-0001,Strandhotel Scheveningen,Strandweg 1,2586 AA,Scheveningen,NL,15-02-2025,15-08-2025,,Ja,Consignatie,01-04-2024,31-03-2026,In loods',
    ].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'vloot-template.csv';
    link.click();
  }

  const aantalGevonden = rijen.filter((r) => r.match === 'gevonden').length;
  const aantalNieuw = rijen.filter((r) => r.match === 'nieuw').length;
  const aantalZonder = rijen.filter((r) => r.match === 'geen').length;
  const nieuweRelaties = new Set(rijen.filter((r) => r.match === 'nieuw').map((r) => r.crediteurnummer)).size;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl overflow-hidden flex flex-col max-h-[90vh]">

        {/* Header */}
        <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Vloot importeren</h2>
            <p className="text-sm text-gray-500">Voertuigen koppelen aan bestaande locaties of nieuwe aanmaken</p>
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
                  <p className="text-sm font-semibold text-gray-700">Klik om een CSV-bestand te uploaden</p>
                  <p className="text-xs text-gray-400 mt-1">Verplicht: Kenteken · Aanbevolen: Crediteur nr., Model, Kleur, Object status</p>
                </label>
              </div>

              <div className="bg-blue-50 rounded-xl p-4 flex items-start gap-3">
                <FileText className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-blue-700 mb-1">Herkende kolomnamen</p>
                  <p className="font-mono text-xs text-blue-600 break-all">
                    Barcode · Kenteken · Model · Tenaamstelling · Uitvoering · Kleur · Crediteur nr. · Relatienaam · Adres · Postcode · Plaats · Land · Laatste onderhoud · Volgend onderhoud · Opmerking · Actief · Contract Type · Begindatum · Einddatum · Object status
                  </p>
                  <p className="text-xs text-blue-500 mt-1.5">
                    <strong>Crediteur nr.</strong> bepaalt de koppeling. Meldcode wordt automatisch afgeleid (laatste 4 cijfers barcode). Kleur leeg = geen kleur.
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
                <div className="bg-green-50 border border-green-100 rounded-xl p-3 flex items-center gap-3">
                  <Link2 className="w-5 h-5 text-green-600 flex-shrink-0" />
                  <div>
                    <p className="text-lg font-bold text-green-700">{aantalGevonden}</p>
                    <p className="text-xs text-green-600">Gekoppeld aan bestaande locatie</p>
                  </div>
                </div>
                <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 flex items-center gap-3">
                  <Plus className="w-5 h-5 text-amber-600 flex-shrink-0" />
                  <div>
                    <p className="text-lg font-bold text-amber-700">{aantalNieuw}</p>
                    <p className="text-xs text-amber-600">{nieuweRelaties} nieuwe locatie{nieuweRelaties !== 1 ? 's' : ''} aanmaken</p>
                  </div>
                </div>
                <div className="bg-gray-50 border border-gray-100 rounded-xl p-3 flex items-center gap-3">
                  <MapPin className="w-5 h-5 text-gray-400 flex-shrink-0" />
                  <div>
                    <p className="text-lg font-bold text-gray-600">{aantalZonder}</p>
                    <p className="text-xs text-gray-500">Zonder locatiekoppeling</p>
                  </div>
                </div>
              </div>

              {/* Preview tabel */}
              <div className="flex items-center justify-between text-sm">
                <span className="font-semibold text-gray-700">{rijen.length} voertuigen geladen</span>
                <button onClick={() => setRijen([])} className="text-primary hover:underline text-xs">Ander bestand kiezen</button>
              </div>

              <div className="border border-gray-200 rounded-xl overflow-hidden">
                <table className="w-full text-xs text-left">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-3 py-2 font-semibold text-gray-500">Kenteken</th>
                      <th className="px-3 py-2 font-semibold text-gray-500">Model</th>
                      <th className="px-3 py-2 font-semibold text-gray-500">Kleur</th>
                      <th className="px-3 py-2 font-semibold text-gray-500">Barcode / Meldcode</th>
                      <th className="px-3 py-2 font-semibold text-gray-500">Crediteur nr.</th>
                      <th className="px-3 py-2 font-semibold text-gray-500">Status</th>
                      <th className="px-3 py-2 font-semibold text-gray-500">Koppeling</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {rijen.slice(0, 50).map((r, i) => (
                      <tr key={i} className="hover:bg-gray-50/60">
                        <td className="px-3 py-2 font-mono font-semibold text-gray-800">{r.kenteken}</td>
                        <td className="px-3 py-2 text-gray-600">
                          {r.model || <span className="text-gray-300 italic">—</span>}
                          {r.uitvoering && <p className="text-gray-400">{r.uitvoering}</p>}
                        </td>
                        <td className="px-3 py-2">
                          {r.kleur_hex ? (
                            <div className="flex items-center gap-1.5">
                              <span className="w-4 h-4 rounded-full border border-black/10 flex-shrink-0" style={{ background: r.kleur_hex }} />
                              <span className="text-gray-500">{r.kleur_raw}</span>
                            </div>
                          ) : (
                            <span className="text-gray-300 italic">—</span>
                          )}
                        </td>
                        <td className="px-3 py-2 font-mono">
                          <span className="text-gray-600">{r.barcode || <span className="text-gray-300">—</span>}</span>
                          {r.meldcode && <p className="text-primary font-bold">{r.meldcode}</p>}
                        </td>
                        <td className="px-3 py-2 font-mono text-gray-500">{r.crediteurnummer || <span className="text-gray-300 italic">—</span>}</td>
                        <td className="px-3 py-2">
                          <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold ${OBJECT_STATUS_STIJL[r.object_status] ?? 'bg-gray-100 text-gray-600'}`}>
                            {r.object_status}
                          </span>
                        </td>
                        <td className="px-3 py-2">
                          {r.match === 'gevonden' && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-50 text-green-700 rounded-full text-[10px] font-semibold">
                              <Link2 className="w-3 h-3" />{r.relatie_naam}
                            </span>
                          )}
                          {r.match === 'nieuw' && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-50 text-amber-700 rounded-full text-[10px] font-semibold">
                              <Plus className="w-3 h-3" />{r.relatienaam || r.crediteurnummer}
                            </span>
                          )}
                          {r.match === 'geen' && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-gray-100 text-gray-500 rounded-full text-[10px]">
                              Geen locatie
                            </span>
                          )}
                        </td>
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

              {nieuweRelaties > 0 && (
                <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 text-xs text-amber-700 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <span>
                    <strong>{nieuweRelaties} nieuwe locatie{nieuweRelaties !== 1 ? 's' : ''}</strong> worden aangemaakt met de beschikbare informatie.
                    Deze verschijnen in het relaties-overzicht met het label <strong>"Aanvullen vereist"</strong>.
                  </span>
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
            <button onClick={importeer} disabled={rijen.length === 0 || bezig}
              className="flex items-center gap-2 px-6 py-2 bg-primary text-white rounded-lg text-sm font-bold shadow-lg shadow-primary/20 hover:bg-primary/90 disabled:opacity-50 disabled:shadow-none transition-all">
              <Check className="w-4 h-4" />
              {rijen.length > 0 ? `Importeer alle ${rijen.length} voertuigen` : 'Selecteer een bestand'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
