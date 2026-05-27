'use client';

import { useState, useEffect } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { supabase } from '@/lib/supabase';
import { Search, ChevronDown, ArrowUpDown, Download, Eye, X, Bike } from 'lucide-react';

type WerkbonOnderdeel = {
  naam: string;
  prijs: number | null;
  aantal: number;
};

type WerkbonVoertuig = {
  kenteken: string;
  kleur: string | null;
  gedaan: string | null;
  onderdelen: WerkbonOnderdeel[];
};

type Werkbon = {
  id: string;
  datum: string | null;
  locatie: string;
  crediteurnummer: string | null;
  relatietype: string | null;
  land: string | null;
  monteur_naam: string;
  type: string;
  status: string;
  notitie: string;
  voertuigen: WerkbonVoertuig[];
  totaalKosten: number | null;
};

const typeLabels: Record<string, string> = {
  onderhoud: 'Onderhoud', reparatie: 'Reparatie', accu: 'Accu',
  plaatsen: 'Plaatsen', terughalen: 'Terughalen', evaluatie: 'Evaluatie',
  voertuigruil: 'Voertuigruil', pechhulp: 'Pechhulp',
};

const statusKleur: Record<string, string> = {
  uitgevoerd: 'bg-orange-50 text-orange-700',
  afgerond: 'bg-green-50 text-green-700',
};

const statusLabel: Record<string, string> = {
  uitgevoerd: 'Wacht op akkoord',
  afgerond: 'Afgerond',
};

const opdrachtTypes = ['onderhoud', 'reparatie', 'accu', 'plaatsen', 'terughalen', 'evaluatie', 'voertuigruil', 'pechhulp'];

export default function WerkbonnenPage() {
  const [werkbonnen, setWerkbonnen] = useState<Werkbon[]>([]);
  const [monteurNamen, setMonteurNamen] = useState<string[]>([]);
  const [laden, setLaden] = useState(true);
  const [detailBon, setDetailBon] = useState<Werkbon | null>(null);

  const [zoek, setZoek] = useState('');
  const [monteurFilter, setMonteurFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [datumVan, setDatumVan] = useState('');
  const [datumTot, setDatumTot] = useState('');

  useEffect(() => { laadAlles(); }, []);

  async function laadAlles() {
    setLaden(true);

    const [{ data: opData }, { data: mData }] = await Promise.all([
      supabase
        .from('opdrachten')
        .select('id, type, status, locatie, datum, monteur_id, notitie')
        .in('status', ['uitgevoerd', 'afgerond'])
        .is('deleted_at', null)
        .order('datum', { ascending: false }),
      supabase.from('monteurs').select('id, naam, voornaam'),
    ]);

    const ops = opData ?? [];
    const monteurs = mData ?? [];

    const monteurMap: Record<string, string> = {};
    monteurs.forEach((m: any) => { monteurMap[m.id] = `${m.voornaam} ${m.naam}`; });
    setMonteurNamen([...new Set(monteurs.map((m: any) => `${m.voornaam} ${m.naam}`))]);

    if (ops.length === 0) { setWerkbonnen([]); setLaden(false); return; }

    const opIds = ops.map((o: any) => o.id);
    const monteurIds = [...new Set(ops.map((o: any) => o.monteur_id).filter(Boolean))];

    const [{ data: vData }, { data: relData }, { data: ooData }] = await Promise.all([
      supabase.from('voertuigen').select('opdracht_id, kenteken, kleur, gedaan').in('opdracht_id', opIds),
      monteurIds.length > 0
        ? supabase.from('relaties').select('naam, crediteurnummer, type, land')
        : Promise.resolve({ data: [] }),
      supabase.from('opdracht_onderdelen').select('opdracht_id, kenteken, aantal, onderdelen(naam, prijs)').in('opdracht_id', opIds),
    ]);

    const relatieMap: Record<string, { crediteurnummer: string | null; type: string; land: string }> = {};
    (relData ?? []).forEach((r: any) => {
      relatieMap[r.naam] = { crediteurnummer: r.crediteurnummer, type: r.type, land: r.land };
    });

    const onderdelenMap: Record<string, Record<string, WerkbonOnderdeel[]>> = {};
    (ooData ?? []).forEach((oo: any) => {
      if (!oo.opdracht_id || !oo.kenteken) return;
      if (!onderdelenMap[oo.opdracht_id]) onderdelenMap[oo.opdracht_id] = {};
      if (!onderdelenMap[oo.opdracht_id][oo.kenteken]) onderdelenMap[oo.opdracht_id][oo.kenteken] = [];
      const naam = (oo.onderdelen as any)?.naam;
      const prijs = (oo.onderdelen as any)?.prijs ?? null;
      const aantal = oo.aantal ?? 1;
      if (naam) onderdelenMap[oo.opdracht_id][oo.kenteken].push({ naam, prijs, aantal });
    });

    const mapped: Werkbon[] = ops.map((op: any) => {
      const rel = relatieMap[op.locatie];
      const opVoertuigen: WerkbonVoertuig[] = (vData ?? [])
        .filter((v: any) => v.opdracht_id === op.id)
        .map((v: any) => ({
          kenteken: v.kenteken,
          kleur: v.kleur ?? null,
          gedaan: v.gedaan ?? null,
          onderdelen: onderdelenMap[op.id]?.[v.kenteken] ?? [],
        }));
      let totaalKosten: number | null = null;
      for (const v of opVoertuigen) {
        for (const o of v.onderdelen) {
          if (o.prijs != null) {
            totaalKosten = (totaalKosten ?? 0) + o.prijs * o.aantal;
          }
        }
      }

      return {
        id: op.id,
        datum: op.datum,
        locatie: op.locatie,
        crediteurnummer: rel?.crediteurnummer ?? null,
        relatietype: rel?.type ?? null,
        land: rel?.land ?? null,
        monteur_naam: monteurMap[op.monteur_id] ?? '—',
        type: op.type,
        status: op.status,
        notitie: op.notitie ?? '',
        voertuigen: opVoertuigen,
        totaalKosten,
      };
    });

    setWerkbonnen(mapped);
    setLaden(false);
  }

  const gefilterd = werkbonnen.filter((w) => {
    const zoekMatch = !zoek ||
      w.locatie.toLowerCase().includes(zoek.toLowerCase()) ||
      (w.crediteurnummer ?? '').toLowerCase().includes(zoek.toLowerCase()) ||
      w.id.toLowerCase().includes(zoek.toLowerCase());
    const monteurMatch = !monteurFilter || w.monteur_naam === monteurFilter;
    const typeMatch = !typeFilter || w.type === typeFilter;
    const statusMatch = !statusFilter || w.status === statusFilter;
    const vanMatch = !datumVan || (w.datum ?? '') >= datumVan;
    const totMatch = !datumTot || (w.datum ?? '') <= datumTot;
    return zoekMatch && monteurMatch && typeMatch && statusMatch && vanMatch && totMatch;
  });

  return (
    <DashboardLayout title="Werkbonnen">
      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4 space-y-3">
        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-48">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Zoek locatie, crediteurnummer of bon-nummer..."
              className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              value={zoek}
              onChange={(e) => setZoek(e.target.value)}
            />
          </div>
          <FilterSelect value={monteurFilter} onChange={setMonteurFilter}
            options={[{ value: '', label: 'Alle monteurs' }, ...monteurNamen.map((m) => ({ value: m, label: m }))]} />
          <FilterSelect value={typeFilter} onChange={setTypeFilter}
            options={[{ value: '', label: 'Alle types' }, ...opdrachtTypes.map((t) => ({ value: t, label: typeLabels[t] ?? t }))]} />
          <FilterSelect value={statusFilter} onChange={setStatusFilter}
            options={[{ value: '', label: 'Alle statussen' }, { value: 'uitgevoerd', label: 'Wacht op akkoord' }, { value: 'afgerond', label: 'Afgerond' }]} />
        </div>
        <div className="flex flex-wrap gap-3">
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <span>Datum:</span>
            <input type="date" value={datumVan} onChange={(e) => setDatumVan(e.target.value)}
              className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" />
            <span>–</span>
            <input type="date" value={datumTot} onChange={(e) => setDatumTot(e.target.value)}
              className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" />
          </div>
        </div>
      </div>

      {/* Tabel */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {laden ? (
          <div className="py-16 text-center text-sm text-gray-400">Laden...</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/60">
                {['Bon-nummer', 'Datum', 'Locatie', 'Monteur', 'Type', 'Status', 'Kosten', ''].map((h, i) => (
                  <th key={i} className={`px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap ${i === 6 ? 'text-right' : 'text-left'}`}>
                    {h && <span className="flex items-center gap-1">{h}{i < 6 && <ArrowUpDown className="w-3 h-3 opacity-40" />}</span>}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {gefilterd.length === 0 && (
                <tr><td colSpan={8} className="py-12 text-center text-gray-400 text-sm">Geen werkbonnen gevonden</td></tr>
              )}
              {gefilterd.map((w) => (
                <tr key={w.id} className="hover:bg-gray-50/60 cursor-pointer transition-colors" onClick={() => setDetailBon(w)}>
                  <td className="px-4 py-3 font-mono text-xs text-gray-600 font-semibold">{w.id}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">
                    {w.datum ? new Date(w.datum + 'T12:00:00').toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-800">{w.locatie}</p>
                    {w.crediteurnummer && <p className="text-xs text-gray-400">{w.crediteurnummer}</p>}
                  </td>
                  <td className="px-4 py-3 text-gray-600 text-sm">{w.monteur_naam}</td>
                  <td className="px-4 py-3 text-gray-600 text-sm">{typeLabels[w.type] ?? w.type}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusKleur[w.status] ?? 'bg-gray-100 text-gray-600'}`}>
                      {statusLabel[w.status] ?? w.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    {w.totaalKosten != null
                      ? <span className="text-sm font-bold text-gray-800">€ {w.totaalKosten.toFixed(2)}</span>
                      : <span className="text-xs text-gray-300">—</span>}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => setDetailBon(w)}
                        className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors" title="Bekijken">
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => afdrukken(w)}
                        className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors" title="Afdrukken / downloaden">
                        <Download className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {!laden && (
          <div className="px-4 py-2.5 border-t border-gray-100 bg-gray-50/40 text-xs text-gray-400">
            {gefilterd.length} van {werkbonnen.length} werkbonnen
          </div>
        )}
      </div>

      {detailBon && <WerkbonDetailModal bon={detailBon} onClose={() => setDetailBon(null)} />}
    </DashboardLayout>
  );
}

function afdrukken(bon: Werkbon) {
  const w = window.open('', '_blank', 'width=700,height=800');
  if (!w) return;
  const regels = bon.voertuigen.map((v) => {
    const onderdelenHtml = v.onderdelen.length > 0
      ? v.onderdelen.map((o) =>
          `<tr style="background:#fafafa">
            <td style="padding:4px 8px 4px 24px;color:#555;font-size:12px" colspan="2">↳ ${o.naam} (${o.aantal}×)</td>
            <td style="padding:4px 8px;text-align:right;font-size:12px;color:#333">
              ${o.prijs != null ? `€ ${(o.prijs * o.aantal).toFixed(2)}` : ''}
            </td>
          </tr>`).join('')
      : '';
    return `
    <tr>
      <td style="padding:6px 8px;font-family:monospace;font-weight:600">${v.kenteken}</td>
      <td style="padding:6px 8px;color:#555">${v.gedaan ?? '—'}</td>
      <td style="padding:6px 8px;text-align:right"></td>
    </tr>${onderdelenHtml}`;
  }).join('');

  const totaalRegel = bon.totaalKosten != null
    ? `<tr style="border-top:2px solid #333">
        <td colspan="2" style="padding:8px;font-weight:700;font-size:13px">Totaal materiaalkosten</td>
        <td style="padding:8px;text-align:right;font-weight:700;font-size:14px">€ ${bon.totaalKosten.toFixed(2)}</td>
       </tr>`
    : '';

  w.document.write(`<!DOCTYPE html><html><head><title>Werkbon ${bon.id}</title>
    <style>body{font-family:sans-serif;padding:24px;color:#222}h1{font-size:18px;margin-bottom:4px}
    table{border-collapse:collapse;width:100%;margin-top:12px}
    th{text-align:left;background:#f5f5f5;padding:6px 8px;font-size:11px;text-transform:uppercase;letter-spacing:.05em;color:#666}
    td{border-top:1px solid #eee;font-size:13px}
    .meta{font-size:13px;color:#555;margin-top:4px}
    @media print{button{display:none}}</style></head><body>
    <h1>Werkbon ${bon.id}</h1>
    <p class="meta">${bon.locatie}${bon.crediteurnummer ? ` · ${bon.crediteurnummer}` : ''}</p>
    <p class="meta">Monteur: ${bon.monteur_naam} · ${bon.datum ?? '—'} · ${typeLabels[bon.type] ?? bon.type}</p>
    ${bon.notitie ? `<p class="meta" style="margin-top:8px;font-style:italic">${bon.notitie}</p>` : ''}
    <table><thead><tr><th>Kenteken</th><th>Gedaan / onderdelen</th><th style="text-align:right">Kosten</th></tr></thead>
    <tbody>${regels}${totaalRegel}</tbody></table>
    <br><button onclick="window.print()">Afdrukken</button>
  </body></html>`);
  w.document.close();
}

function WerkbonDetailModal({ bon, onClose }: { bon: Werkbon; onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl flex flex-col max-h-[92vh]">
        <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-100 flex-shrink-0">
          <div className="flex-1 min-w-0">
            <p className="font-mono text-sm font-bold text-gray-800">{bon.id}</p>
            <p className="text-xs text-gray-400 mt-0.5">
              {bon.locatie}{bon.crediteurnummer ? ` · ${bon.crediteurnummer}` : ''}
            </p>
          </div>
          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusKleur[bon.status] ?? 'bg-gray-100 text-gray-600'}`}>
            {statusLabel[bon.status] ?? bon.status}
          </span>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors">
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          <div className="grid grid-cols-3 gap-3 text-sm">
            <div>
              <p className="text-xs text-gray-400 uppercase font-semibold tracking-wide mb-0.5">Type</p>
              <p className="text-gray-800 font-medium">{typeLabels[bon.type] ?? bon.type}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400 uppercase font-semibold tracking-wide mb-0.5">Datum</p>
              <p className="text-gray-800">
                {bon.datum ? new Date(bon.datum + 'T12:00:00').toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' }) : '—'}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-400 uppercase font-semibold tracking-wide mb-0.5">Monteur</p>
              <p className="text-gray-800">{bon.monteur_naam}</p>
            </div>
          </div>

          {bon.notitie && (
            <div className="text-sm text-gray-500 italic border-l-2 border-gray-200 pl-3">
              {bon.notitie}
            </div>
          )}

          <div>
            <p className="text-xs text-gray-400 uppercase font-semibold tracking-wide mb-2">
              Voertuigen ({bon.voertuigen.length})
            </p>
            {bon.voertuigen.length === 0 ? (
              <p className="text-sm text-gray-400 italic">Geen voertuigen geregistreerd</p>
            ) : (
              <div className="space-y-2">
                {bon.voertuigen.map((v) => (
                  <div key={v.kenteken} className="bg-gray-50 rounded-lg px-4 py-3">
                    <div className="flex items-center gap-2 mb-1">
                      <div className="w-3 h-3 rounded-sm flex-shrink-0" style={{ backgroundColor: v.kleur ?? '#345022' }} />
                      <p className="font-mono text-sm font-semibold text-gray-700">{v.kenteken}</p>
                    </div>
                    {v.gedaan && <p className="text-sm text-gray-600 ml-5">{v.gedaan}</p>}
                    {v.onderdelen.length > 0 && (
                      <div className="mt-2 ml-5 space-y-1">
                        {v.onderdelen.map((o, i) => (
                          <div key={i} className="flex items-center justify-between text-xs bg-white border border-gray-100 rounded px-2.5 py-1.5">
                            <span className="text-gray-700 font-medium">{o.naam}</span>
                            <div className="flex items-center gap-3 text-gray-500 flex-shrink-0">
                              <span>{o.aantal}×</span>
                              {o.prijs != null ? (
                                <>
                                  <span>€ {o.prijs.toFixed(2)}</span>
                                  <span className="font-bold text-gray-800 w-16 text-right">€ {(o.prijs * o.aantal).toFixed(2)}</span>
                                </>
                              ) : (
                                <span className="text-gray-300 w-16 text-right">geen prijs</span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    {!v.gedaan && v.onderdelen.length === 0 && (
                      <p className="text-xs text-gray-400 italic ml-5">Geen details</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {bon.totaalKosten != null && (
          <div className="px-5 py-3 border-t border-gray-100 flex items-center justify-between bg-gray-50/60">
            <span className="text-sm font-semibold text-gray-600">Totaal materiaalkosten</span>
            <span className="text-lg font-black text-gray-900">€ {bon.totaalKosten.toFixed(2)}</span>
          </div>
        )}

        <div className="px-5 pb-5 pt-3 border-t border-gray-100 flex gap-2 flex-shrink-0">
          <button
            onClick={() => afdrukken(bon)}
            className="flex items-center gap-2 px-4 py-2.5 bg-gray-100 text-gray-700 text-sm font-semibold rounded-xl hover:bg-gray-200 transition-colors"
          >
            <Download className="w-4 h-4" />
            Afdrukken / downloaden
          </button>
          <button onClick={onClose} className="px-4 py-2.5 border border-gray-200 text-gray-600 text-sm font-medium rounded-xl hover:bg-gray-50 transition-colors ml-auto">
            Sluiten
          </button>
        </div>
      </div>
    </div>
  );
}

function FilterSelect({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: { value: string; label: string }[] }) {
  return (
    <div className="relative">
      <select value={value} onChange={(e) => onChange(e.target.value)}
        className="appearance-none pl-3 pr-8 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-gray-700">
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
    </div>
  );
}
