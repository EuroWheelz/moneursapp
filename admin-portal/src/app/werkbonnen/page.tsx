'use client';

import { useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { Search, ChevronDown, ArrowUpDown, Download, Eye } from 'lucide-react';

const werkbonnen = [
  { id: 'WB-2025-0042', datum: '2025-03-12', locatie: 'Strandhotel Scheveningen', crediteurnummer: 'EW-0001', monteur: 'Jan Bakker', type: 'Onderhoud', status: 'Afgerond', relatietype: 'consignatie', land: 'NL' },
  { id: 'WB-2025-0041', datum: '2025-03-10', locatie: 'Vakantiepark De Koog', crediteurnummer: 'EW-0002', monteur: 'Kevin Smit', type: 'Reparatie', status: 'Akkoord', relatietype: 'consignatie', land: 'NL' },
  { id: 'WB-2025-0040', datum: '2025-03-08', locatie: 'Camping Les Dunes', crediteurnummer: 'EW-0003', monteur: 'Jan Bakker', type: 'Accu', status: 'Afgerond', relatietype: 'consignatie', land: 'BE' },
  { id: 'WB-2025-0039', datum: '2025-03-05', locatie: 'Familie Janssen', crediteurnummer: 'EW-0004', monteur: 'Sophie van Dam', type: 'Reparatie', status: 'Afgerond', relatietype: 'klant', land: 'NL' },
  { id: 'WB-2025-0038', datum: '2025-03-01', locatie: 'Hotelpark Julianadorp', crediteurnummer: 'EW-0006', monteur: 'Kevin Smit', type: 'Onderhoud', status: 'Afgerond', relatietype: 'consignatie', land: 'NL' },
  { id: 'WB-2025-0037', datum: '2025-02-26', locatie: 'Resort Borkum', crediteurnummer: 'EW-0005', monteur: 'Jan Bakker', type: 'Plaatsen', status: 'Afgerond', relatietype: 'consignatie', land: 'DE' },
  { id: 'WB-2025-0036', datum: '2025-02-20', locatie: 'Strandhotel Scheveningen', crediteurnummer: 'EW-0001', monteur: 'Sophie van Dam', type: 'Evaluatie', status: 'Afgerond', relatietype: 'consignatie', land: 'NL' },
  { id: 'WB-2025-0035', datum: '2025-02-15', locatie: 'Camping Le Nord', crediteurnummer: 'EW-0007', monteur: 'Kevin Smit', type: 'Terughalen', status: 'Afgerond', relatietype: 'consignatie', land: 'FR' },
];

const statusKleur: Record<string, string> = {
  Nieuw: 'bg-yellow-50 text-yellow-700',
  Ingepland: 'bg-blue-50 text-blue-700',
  Onderweg: 'bg-indigo-50 text-indigo-700',
  Uitgevoerd: 'bg-orange-50 text-orange-700',
  Akkoord: 'bg-teal-50 text-teal-700',
  Afgerond: 'bg-green-50 text-green-700',
};

const monteurs = ['Jan Bakker', 'Kevin Smit', 'Sophie van Dam'];
const opdrachtTypes = ['Onderhoud', 'Reparatie', 'Accu', 'Plaatsen', 'Terughalen', 'Evaluatie', 'Voertuigruil', 'Pechhulp'];
const statussen = ['Nieuw', 'Ingepland', 'Onderweg', 'Uitgevoerd', 'Akkoord', 'Afgerond'];

export default function WerkbonnenPage() {
  const [zoek, setZoek] = useState('');
  const [monteurFilter, setMonteurFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [relatietypeFilter, setRelatietypeFilter] = useState('');
  const [landFilter, setLandFilter] = useState('');
  const [datumVan, setDatumVan] = useState('');
  const [datumTot, setDatumTot] = useState('');

  const gefilterd = werkbonnen.filter((w) => {
    const zoekMatch = !zoek || w.locatie.toLowerCase().includes(zoek.toLowerCase()) || w.crediteurnummer.toLowerCase().includes(zoek.toLowerCase()) || w.id.toLowerCase().includes(zoek.toLowerCase());
    const monteurMatch = !monteurFilter || w.monteur === monteurFilter;
    const typeMatch = !typeFilter || w.type === typeFilter;
    const statusMatch = !statusFilter || w.status === statusFilter;
    const relatietypeMatch = !relatietypeFilter || w.relatietype === relatietypeFilter;
    const landMatch = !landFilter || w.land === landFilter;
    const vanMatch = !datumVan || w.datum >= datumVan;
    const totMatch = !datumTot || w.datum <= datumTot;
    return zoekMatch && monteurMatch && typeMatch && statusMatch && relatietypeMatch && landMatch && vanMatch && totMatch;
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
          <FilterSelect value={monteurFilter} onChange={setMonteurFilter} options={[{ value: '', label: 'Alle monteurs' }, ...monteurs.map((m) => ({ value: m, label: m }))]} />
          <FilterSelect value={typeFilter} onChange={setTypeFilter} options={[{ value: '', label: 'Alle types' }, ...opdrachtTypes.map((t) => ({ value: t, label: t }))]} />
          <FilterSelect value={statusFilter} onChange={setStatusFilter} options={[{ value: '', label: 'Alle statussen' }, ...statussen.map((s) => ({ value: s, label: s }))]} />
        </div>
        <div className="flex flex-wrap gap-3">
          <FilterSelect value={relatietypeFilter} onChange={setRelatietypeFilter} options={[{ value: '', label: 'Alle relatietypes' }, { value: 'consignatie', label: 'Consignatie' }, { value: 'klant', label: 'Klant' }]} />
          <FilterSelect value={landFilter} onChange={setLandFilter} options={[{ value: '', label: 'Alle landen' }, { value: 'NL', label: 'Nederland' }, { value: 'BE', label: 'België' }, { value: 'DE', label: 'Duitsland' }, { value: 'FR', label: 'Frankrijk' }]} />
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <span>Datum:</span>
            <input type="date" value={datumVan} onChange={(e) => setDatumVan(e.target.value)} className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" />
            <span>–</span>
            <input type="date" value={datumTot} onChange={(e) => setDatumTot(e.target.value)} className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" />
          </div>
        </div>
      </div>

      {/* Tabel */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50/60">
              {['Bon-nummer', 'Datum', 'Locatie', 'Monteur', 'Type', 'Status', ''].map((h, i) => (
                <th key={i} className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">
                  {h && <span className="flex items-center gap-1">{h}{i < 6 && <ArrowUpDown className="w-3 h-3 opacity-40" />}</span>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {gefilterd.length === 0 && (
              <tr><td colSpan={7} className="py-12 text-center text-gray-400 text-sm">Geen werkbonnen gevonden</td></tr>
            )}
            {gefilterd.map((w) => (
              <tr key={w.id} className="hover:bg-gray-50/60 cursor-pointer transition-colors">
                <td className="px-4 py-3 font-mono text-xs text-gray-600 font-semibold">{w.id}</td>
                <td className="px-4 py-3 text-gray-500 text-xs">{w.datum}</td>
                <td className="px-4 py-3">
                  <p className="font-medium text-gray-800">{w.locatie}</p>
                  <p className="text-xs text-gray-400">{w.crediteurnummer}</p>
                </td>
                <td className="px-4 py-3 text-gray-600">{w.monteur}</td>
                <td className="px-4 py-3 text-gray-600">{w.type}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusKleur[w.status] ?? 'bg-gray-100 text-gray-600'}`}>
                    {w.status}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1">
                    <button className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors" title="Bekijken">
                      <Eye className="w-3.5 h-3.5" />
                    </button>
                    <button className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors" title="Downloaden">
                      <Download className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="px-4 py-2.5 border-t border-gray-100 bg-gray-50/40 text-xs text-gray-400">
          {gefilterd.length} van {werkbonnen.length} werkbonnen
        </div>
      </div>
    </DashboardLayout>
  );
}

function FilterSelect({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: { value: string; label: string }[] }) {
  return (
    <div className="relative">
      <select value={value} onChange={(e) => onChange(e.target.value)} className="appearance-none pl-3 pr-8 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-gray-700">
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
    </div>
  );
}
