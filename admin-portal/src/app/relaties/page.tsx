'use client';

import { useState } from 'react';
import Link from 'next/link';
import DashboardLayout from '@/components/DashboardLayout';
import { Plus, Search, ChevronDown, ArrowUpDown } from 'lucide-react';

const relaties = [
  { id: '1', crediteurnummer: 'EW-0001', naam: 'Strandhotel Scheveningen', type: 'consignatie', status: 'actief', land: 'NL', adres: 'Gevers Deynootplein 30, Scheveningen', echopers: 8, accus: 4 },
  { id: '2', crediteurnummer: 'EW-0002', naam: 'Vakantiepark De Koog', type: 'consignatie', status: 'actief', land: 'NL', adres: 'Rommelpot 8, De Koog', echopers: 12, accus: 6 },
  { id: '3', crediteurnummer: 'EW-0003', naam: 'Camping Les Dunes', type: 'consignatie', status: 'actief', land: 'BE', adres: 'Duinweg 4, Koksijde', echopers: 5, accus: 3 },
  { id: '4', crediteurnummer: 'EW-0004', naam: 'Familie Janssen', type: 'klant', status: 'actief', land: 'NL', adres: 'Kerkstraat 12, Amsterdam', echopers: 1, accus: 0 },
  { id: '5', crediteurnummer: 'EW-0005', naam: 'Resort Borkum', type: 'consignatie', status: 'inactief', land: 'DE', adres: 'Strandpromenade 1, Borkum', echopers: 6, accus: 3 },
  { id: '6', crediteurnummer: 'EW-0006', naam: 'Hotelpark Julianadorp', type: 'consignatie', status: 'actief', land: 'NL', adres: 'Zandweg 22, Julianadorp', echopers: 10, accus: 5 },
  { id: '7', crediteurnummer: 'EW-0007', naam: 'Camping Le Nord', type: 'consignatie', status: 'actief', land: 'FR', adres: 'Rue du Littoral 7, Dunkerque', echopers: 4, accus: 2 },
];

const landLabels: Record<string, string> = { NL: 'Nederland', BE: 'België', DE: 'Duitsland', FR: 'Frankrijk' };

export default function RelatiePage() {
  const [zoek, setZoek] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [landFilter, setLandFilter] = useState('');

  const gefilterd = relaties.filter((r) => {
    const zoekMatch =
      !zoek ||
      r.naam.toLowerCase().includes(zoek.toLowerCase()) ||
      r.crediteurnummer.toLowerCase().includes(zoek.toLowerCase());
    const typeMatch = !typeFilter || r.type === typeFilter;
    const statusMatch = !statusFilter || r.status === statusFilter;
    const landMatch = !landFilter || r.land === landFilter;
    return zoekMatch && typeMatch && statusMatch && landMatch;
  });

  return (
    <DashboardLayout
      title="Relaties"
      actions={
        <button className="flex items-center gap-2 px-4 py-2 bg-[#F3A713] text-[#1A1A1A] rounded-lg text-sm font-semibold shadow-sm hover:bg-[#D4900E] active:scale-95 transition-all">
          <Plus className="w-4 h-4" />
          Nieuwe relatie
        </button>
      }
    >
      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-4">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Zoek op naam of crediteurnummer..."
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            value={zoek}
            onChange={(e) => setZoek(e.target.value)}
          />
        </div>
        <FilterSelect value={typeFilter} onChange={setTypeFilter} options={[{ value: '', label: 'Alle types' }, { value: 'consignatie', label: 'Consignatie' }, { value: 'klant', label: 'Klant' }]} />
        <FilterSelect value={statusFilter} onChange={setStatusFilter} options={[{ value: '', label: 'Alle statussen' }, { value: 'actief', label: 'Actief' }, { value: 'inactief', label: 'Inactief' }]} />
        <FilterSelect value={landFilter} onChange={setLandFilter} options={[{ value: '', label: 'Alle landen' }, { value: 'NL', label: 'Nederland' }, { value: 'BE', label: 'België' }, { value: 'DE', label: 'Duitsland' }, { value: 'FR', label: 'Frankrijk' }]} />
      </div>

      {/* Tabel */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50/60">
              <Th>Crediteurnummer</Th>
              <Th>Naam</Th>
              <Th className="text-center">E-choppers</Th>
              <Th className="text-center">Accu&apos;s</Th>
              <Th>Land</Th>
              <Th>Status</Th>
              <Th>Adres</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {gefilterd.length === 0 && (
              <tr>
                <td colSpan={7} className="py-12 text-center text-gray-400 text-sm">
                  Geen relaties gevonden
                </td>
              </tr>
            )}
            {gefilterd.map((r) => (
              <tr key={r.id} className="hover:bg-gray-50/60 cursor-pointer transition-colors group">
                <td className="px-4 py-3 font-mono text-xs text-gray-500">{r.crediteurnummer}</td>
                <td className="px-4 py-3">
                  <Link href={`/relaties/${r.id}`} className="font-medium text-gray-900 group-hover:text-primary transition-colors">
                    {r.naam}
                  </Link>
                  <span className={`ml-2 inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide
                    ${r.type === 'consignatie' ? 'bg-blue-50 text-blue-600' : 'bg-gray-100 text-gray-500'}`}>
                    {r.type}
                  </span>
                </td>
                <td className="px-4 py-3 text-center text-gray-700">{r.echopers}</td>
                <td className="px-4 py-3 text-center text-gray-700">{r.accus}</td>
                <td className="px-4 py-3 text-gray-600">{r.land}</td>
                <td className="px-4 py-3">
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium
                    ${r.status === 'actief' ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${r.status === 'actief' ? 'bg-green-500' : 'bg-gray-400'}`} />
                    {r.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-500 text-xs">{r.adres}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="px-4 py-2.5 border-t border-gray-100 bg-gray-50/40 text-xs text-gray-400">
          {gefilterd.length} van {relaties.length} relaties
        </div>
      </div>
    </DashboardLayout>
  );
}

function Th({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <th className={`px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap ${className}`}>
      <span className="flex items-center gap-1">
        {children}
        <ArrowUpDown className="w-3 h-3 opacity-40" />
      </span>
    </th>
  );
}

function FilterSelect({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: { value: string; label: string }[] }) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="appearance-none pl-3 pr-8 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-gray-700"
      >
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
    </div>
  );
}
