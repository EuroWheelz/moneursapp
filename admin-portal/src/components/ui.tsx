/**
 * Gedeelde UI-primitieven in EuroWheelz huisstijl.
 */
import React from 'react';

/* ── Knoppen ─────────────────────────────────────────────── */

/** Hoofdknop: amber achtergrond, donkere tekst */
export function BtnPrimary({
  children, onClick, type = 'button', className = '',
}: { children: React.ReactNode; onClick?: () => void; type?: 'button' | 'submit'; className?: string }) {
  return (
    <button
      type={type}
      onClick={onClick}
      className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold shadow-sm active:scale-95 transition-all
        bg-[#F3A713] text-[#1A1A1A] hover:bg-[#D4900E] ${className}`}
    >
      {children}
    </button>
  );
}

/** Secundaire knop: wit/outline */
export function BtnSecondary({
  children, onClick, className = '',
}: { children: React.ReactNode; onClick?: () => void; className?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 transition-colors ${className}`}
    >
      {children}
    </button>
  );
}

/* ── Status badges ───────────────────────────────────────── */
const opdrachtStatusKleuren: Record<string, string> = {
  Nieuw: 'bg-yellow-50 text-yellow-700 border border-yellow-200',
  Ingepland: 'bg-blue-50 text-blue-700 border border-blue-200',
  Onderweg: 'bg-indigo-50 text-indigo-700 border border-indigo-200',
  Uitgevoerd: 'bg-orange-50 text-orange-700 border border-orange-200',
  Akkoord: 'bg-teal-50 text-teal-700 border border-teal-200',
  Afgerond: 'bg-green-50 text-green-700 border border-green-200',
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${opdrachtStatusKleuren[status] ?? 'bg-gray-100 text-gray-600'}`}>
      {status}
    </span>
  );
}

/* ── Kaartencontainer ────────────────────────────────────── */
export function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-white rounded-xl border border-gray-200 shadow-sm ${className}`}>
      {children}
    </div>
  );
}

/* ── Sectie-header in kaart ──────────────────────────────── */
export function CardHeader({ title, action }: { title: string; action?: React.ReactNode }) {
  return (
    <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
      <h2 className="font-semibold text-gray-900">{title}</h2>
      {action}
    </div>
  );
}

/* ── Filter select ───────────────────────────────────────── */
import { ChevronDown } from 'lucide-react';

export function FilterSelect({
  value, onChange, options,
}: { value: string; onChange: (v: string) => void; options: { value: string; label: string }[] }) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="appearance-none pl-3 pr-8 py-2 text-sm border border-gray-200 rounded-lg bg-white
          focus:outline-none focus:ring-2 focus:ring-[#F3A713]/30 focus:border-[#F3A713] text-gray-700 transition-colors"
      >
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
    </div>
  );
}

/* ── Tabel-header cel ────────────────────────────────────── */
import { ArrowUpDown } from 'lucide-react';

export function Th({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <th className={`px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap ${className}`}>
      <span className="flex items-center gap-1">
        {children}
        <ArrowUpDown className="w-3 h-3 opacity-30" />
      </span>
    </th>
  );
}
