'use client';

import { useState } from 'react';
import Link from 'next/link';
import DashboardLayout from '@/components/DashboardLayout';
import { Plus, Search, ChevronDown, ArrowUpDown, Bike } from 'lucide-react';

const voertuigen = [
  { kenteken: 'EW-0001-A', locatie: 'Strandhotel Scheveningen', crediteurnummer: 'EW-0001', land: 'NL', status: 'Operationeel', kleur: '#E63946', verzekerd: true },
  { kenteken: 'EW-0001-B', locatie: 'Strandhotel Scheveningen', crediteurnummer: 'EW-0001', land: 'NL', status: 'Reparatie', kleur: '#2A9D8F', verzekerd: true },
  { kenteken: 'EW-0001-C', locatie: 'Strandhotel Scheveningen', crediteurnummer: 'EW-0001', land: 'NL', status: 'Operationeel', kleur: '#264653', verzekerd: true },
  { kenteken: 'EW-0002-A', locatie: 'Vakantiepark De Koog', crediteurnummer: 'EW-0002', land: 'NL', status: 'Operationeel', kleur: '#E9C46A', verzekerd: true },
  { kenteken: 'EW-0002-B', locatie: 'Vakantiepark De Koog', crediteurnummer: 'EW-0002', land: 'NL', status: 'Operationeel', kleur: '#F4A261', verzekerd: true },
  { kenteken: 'EW-0002-C', locatie: 'Vakantiepark De Koog', crediteurnummer: 'EW-0002', land: 'NL', status: 'Reparatie in loods', kleur: '#E63946', verzekerd: false },
  { kenteken: 'EW-0003-A', locatie: 'Camping Les Dunes', crediteurnummer: 'EW-0003', land: 'BE', status: 'Operationeel', kleur: '#2A9D8F', verzekerd: true },
  { kenteken: 'EW-0003-B', locatie: 'Camping Les Dunes', crediteurnummer: 'EW-0003', land: 'BE', status: 'Opslag', kleur: '#264653', verzekerd: true },
  { kenteken: 'EW-LOODS-01', locatie: 'EuroWheelz Loods', crediteurnummer: '—', land: 'NL', status: 'Reparatie in loods', kleur: '#E63946', verzekerd: false },
  { kenteken: 'EW-LOODS-02', locatie: 'EuroWheelz Loods', crediteurnummer: '—', land: 'NL', status: 'Opslag', kleur: '#E9C46A', verzekerd: false },
];

const statusKleur: Record<string, string> = {
  Operationeel: 'bg-green-50 text-green-700',
  Reparatie: 'bg-orange-50 text-orange-700',
  'Reparatie in loods': 'bg-red-50 text-red-700',
  Opslag: 'bg-gray-100 text-gray-600',
};

export default function VoertuigenPage() {
  const [zoek, setZoek] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [landFilter, setLandFilter] = useState('');
  const [verzekerdFilter, setVerzekerdFilter] = useState('');

  const gefilterd = voertuigen.filter((v) => {
    const zoekMatch = !zoek || v.kenteken.toLowerCase().includes(zoek.toLowerCase()) || v.locatie.toLowerCase().includes(zoek.toLowerCase()) || v.crediteurnummer.toLowerCase().includes(zoek.toLowerCase());
    const statusMatch = !statusFilter || v.status === statusFilter;
    const landMatch = !landFilter || v.land === landFilter;
    const verzekerdMatch = !verzekerdFilter || (verzekerdFilter === 'ja' ? v.verzekerd : !v.verzekerd);
    return zoekMatch && statusMatch && landMatch && verzekerdMatch;
  });

  return (
    <DashboardLayout
      title="Voertuigen"
      actions={
        <button className="flex items-center gap-2 px-4 py-2 bg-[#F3A713] text-[#1A1A1A] rounded-lg text-sm font-semibold shadow-sm hover:bg-[#D4900E] active:scale-95 transition-all">
          <Plus className="w-4 h-4" />
          Voertuig toevoegen
        </button>
      }
    >
      {/* Statusindicatoren */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        {Object.entries(statusKleur).map(([status, kleur]) => {
          const count = voertuigen.filter((v) => v.status === status).length;
          return (
            <div key={status} className="bg-white border border-gray-200 rounded-xl px-4 py-3 flex items-center gap-3">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${kleur}`}>
                <Bike className="w-4 h-4" />
              </div>
              <div>
                <p className="text-lg font-bold text-gray-900">{count}</p>
                <p className="text-xs text-gray-400 leading-tight">{status}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-4">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Zoek kenteken, locatie of crediteurnummer..."
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            value={zoek}
            onChange={(e) => setZoek(e.target.value)}
          />
        </div>
        <FilterSelect value={statusFilter} onChange={setStatusFilter} options={[
          { value: '', label: 'Alle statussen' },
          { value: 'Operationeel', label: 'Operationeel' },
          { value: 'Reparatie', label: 'Reparatie' },
          { value: 'Reparatie in loods', label: 'Reparatie in loods' },
          { value: 'Opslag', label: 'Opslag' },
        ]} />
        <FilterSelect value={landFilter} onChange={setLandFilter} options={[
          { value: '', label: 'Alle landen' },
          { value: 'NL', label: 'Nederland' },
          { value: 'BE', label: 'België' },
          { value: 'DE', label: 'Duitsland' },
          { value: 'FR', label: 'Frankrijk' },
        ]} />
        <FilterSelect value={verzekerdFilter} onChange={setVerzekerdFilter} options={[
          { value: '', label: 'In verzekering' },
          { value: 'ja', label: 'Verzekerd' },
          { value: 'nee', label: 'Niet verzekerd' },
        ]} />
      </div>

      {/* Tabel */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50/60">
              {['Kenteken', 'Naam locatie', 'Status', 'Kleur'].map((h) => (
                <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  <span className="flex items-center gap-1">{h}<ArrowUpDown className="w-3 h-3 opacity-40" /></span>
                </th>
              ))}
              <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Land</th>
              <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Verzekerd</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {gefilterd.length === 0 && (
              <tr><td colSpan={6} className="py-12 text-center text-gray-400 text-sm">Geen voertuigen gevonden</td></tr>
            )}
            {gefilterd.map((v) => (
              <tr key={v.kenteken} className="hover:bg-gray-50/60 cursor-pointer transition-colors group">
                <td className="px-4 py-3">
                  <Link href={`/voertuigen/${encodeURIComponent(v.kenteken)}`} className="font-mono font-semibold text-gray-800 group-hover:text-primary transition-colors">
                    {v.kenteken}
                  </Link>
                </td>
                <td className="px-4 py-3 text-gray-700">{v.locatie}</td>
                <td className="px-4 py-3">
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${statusKleur[v.status] ?? 'bg-gray-100 text-gray-600'}`}>
                    <span className="w-1.5 h-1.5 rounded-full bg-current opacity-60" />
                    {v.status}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded border border-gray-200 flex-shrink-0" style={{ backgroundColor: v.kleur }} />
                    <span className="text-xs text-gray-400 font-mono">{v.kleur}</span>
                  </div>
                </td>
                <td className="px-4 py-3 text-gray-500 text-xs">{v.land}</td>
                <td className="px-4 py-3">
                  <span className={`text-xs font-medium ${v.verzekerd ? 'text-green-600' : 'text-gray-400'}`}>
                    {v.verzekerd ? 'Ja' : 'Nee'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="px-4 py-2.5 border-t border-gray-100 bg-gray-50/40 text-xs text-gray-400">
          {gefilterd.length} van {voertuigen.length} voertuigen
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
