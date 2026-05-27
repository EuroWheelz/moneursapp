'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import DashboardLayout from '@/components/DashboardLayout';
import { supabase } from '@/lib/supabase';
import {
  BookUser, CalendarDays, Bike, FileText, Users, Inbox,
  ArrowRight, Wrench, AlertTriangle, CheckCircle2, Clock, Loader2,
} from 'lucide-react';

const modules = [
  { href: '/relaties', icon: BookUser, label: 'Relaties', omschrijving: 'Adresboek & locatie-dashboards', bg: '#345022', fg: 'white' },
  { href: '/planning', icon: CalendarDays, label: 'Planning & Opdrachten', omschrijving: 'Planbord, monteur-agendas', bg: '#F3A713', fg: '#1A1A1A' },
  { href: '/voertuigen', icon: Bike, label: 'Voertuigen', omschrijving: '~1.500 e-choppers', bg: '#345022', fg: 'white' },
  { href: '/werkbonnen', icon: FileText, label: 'Werkbonnen', omschrijving: 'Archief alle opdrachten', bg: '#F3A713', fg: '#1A1A1A' },
  { href: '/personeel', icon: Users, label: 'Personeel', omschrijving: 'Beheerders & monteurs', bg: '#345022', fg: 'white' },
  { href: '/service-center', icon: Inbox, label: 'Service Center', omschrijving: 'Akkoord-flow & vervolg', bg: '#F3A713', fg: '#1A1A1A' },
];

const statusKleur: Record<string, string> = {
  ingepland: 'bg-blue-50 text-blue-700',
  uitgevoerd: 'bg-orange-50 text-orange-700',
  afgerond: 'bg-green-50 text-green-700',
  nieuw: 'bg-yellow-50 text-yellow-700',
};

const typeLabels: Record<string, string> = {
  onderhoud: 'Onderhoud', reparatie: 'Reparatie', accu: 'Accu',
  plaatsen: 'Plaatsen', terughalen: 'Terughalen', evaluatie: 'Evaluatie',
  voertuigruil: 'Voertuigruil', pechhulp: 'Pechhulp',
};

type StatsData = { openstaand: number; wachtenAkkoord: number; afgerondVandaag: number; activeMonteurs: number };
type RecentOpdracht = { id: string; type: string; locatie: string; status: string; urgent: boolean };

export default function DashboardPage() {
  const [stats, setStats] = useState<StatsData | null>(null);
  const [recente, setRecente] = useState<RecentOpdracht[]>([]);
  const [laden, setLaden] = useState(true);

  useEffect(() => {
    async function laad() {
      const vandaag = new Date().toISOString().split('T')[0];
      const [
        { count: openstaand },
        { count: wachtenAkkoord },
        { count: afgerondVandaag },
        { count: activeMonteurs },
        { data: recent },
      ] = await Promise.all([
        supabase.from('opdrachten').select('*', { count: 'exact', head: true })
          .is('deleted_at', null).not('status', 'in', '("uitgevoerd","afgerond")'),
        supabase.from('opdrachten').select('*', { count: 'exact', head: true })
          .is('deleted_at', null).eq('status', 'uitgevoerd'),
        supabase.from('opdrachten').select('*', { count: 'exact', head: true })
          .is('deleted_at', null).eq('status', 'afgerond').eq('datum', vandaag),
        supabase.from('monteurs').select('*', { count: 'exact', head: true }),
        supabase.from('opdrachten').select('id, type, locatie, status, urgent')
          .is('deleted_at', null).order('updated_at', { ascending: false }).limit(5),
      ]);
      setStats({ openstaand: openstaand ?? 0, wachtenAkkoord: wachtenAkkoord ?? 0, afgerondVandaag: afgerondVandaag ?? 0, activeMonteurs: activeMonteurs ?? 0 });
      setRecente((recent ?? []) as RecentOpdracht[]);
      setLaden(false);
    }
    laad();
  }, []);

  const kpiBlokken = stats ? [
    { label: 'Openstaande opdrachten', value: stats.openstaand, icon: Wrench, kleur: 'text-[#345022] bg-[#345022]/10' },
    { label: 'Wachten op akkoord', value: stats.wachtenAkkoord, icon: AlertTriangle, kleur: 'text-[#F3A713] bg-[#F3A713]/15' },
    { label: 'Afgerond vandaag', value: stats.afgerondVandaag, icon: CheckCircle2, kleur: 'text-green-600 bg-green-50' },
    { label: 'Actieve monteurs', value: stats.activeMonteurs, icon: Users, kleur: 'text-primary bg-primary/10' },
  ] : [];

  return (
    <DashboardLayout title="Dashboard">
      <div className="space-y-6">
        {/* KPI stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {laden
            ? Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="bg-white border border-gray-200 rounded-xl p-4 flex items-center gap-4 animate-pulse">
                  <div className="w-10 h-10 rounded-xl bg-gray-100 flex-shrink-0" />
                  <div className="space-y-2 flex-1">
                    <div className="h-6 w-8 bg-gray-100 rounded" />
                    <div className="h-3 w-28 bg-gray-100 rounded" />
                  </div>
                </div>
              ))
            : kpiBlokken.map((s) => (
                <div key={s.label} className="bg-white border border-gray-200 rounded-xl p-4 flex items-center gap-4">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${s.kleur}`}>
                    <s.icon className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-gray-900">{s.value}</p>
                    <p className="text-xs text-gray-400 leading-tight">{s.label}</p>
                  </div>
                </div>
              ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Recente opdrachten */}
          <div className="lg:col-span-2 bg-white border border-gray-200 rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="font-semibold text-gray-900">Recente opdrachten</h2>
              <Link href="/planning" className="text-sm text-primary hover:underline flex items-center gap-1">
                Naar planbord <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
            {laden ? (
              <div className="p-8 flex items-center justify-center gap-2 text-sm text-gray-400">
                <Loader2 className="w-4 h-4 animate-spin" /> Laden...
              </div>
            ) : recente.length === 0 ? (
              <div className="p-8 text-center text-sm text-gray-400">Nog geen opdrachten.</div>
            ) : (
              <div className="divide-y divide-gray-50">
                {recente.map((op) => (
                  <div key={op.id} className="px-5 py-3.5 flex items-center gap-4 hover:bg-gray-50/60 transition-colors">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        {op.urgent && <AlertTriangle className="w-3.5 h-3.5 text-red-500 flex-shrink-0" />}
                        <span className="font-medium text-gray-800 text-sm truncate">{op.locatie}</span>
                      </div>
                      <span className="text-xs text-gray-400">{typeLabels[op.type] ?? op.type} · {op.id}</span>
                    </div>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium flex-shrink-0 ${statusKleur[op.status] ?? 'bg-gray-100 text-gray-600'}`}>
                      {op.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Service Center */}
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="font-semibold text-gray-900">Service Center</h2>
              <Link href="/service-center" className="text-sm text-primary hover:underline flex items-center gap-1">
                Bekijken <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
            <div className="p-5 space-y-3">
              {laden ? (
                <div className="flex items-center justify-center gap-2 py-4 text-sm text-gray-400">
                  <Loader2 className="w-4 h-4 animate-spin" /> Laden...
                </div>
              ) : (
                <>
                  <AlertBox icon={Clock} kleur="amber" count={stats?.wachtenAkkoord ?? 0} label="Wachten op akkoord" href="/service-center" />
                </>
              )}
            </div>
          </div>
        </div>

        {/* Modules overzicht */}
        <div>
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">Modules</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {modules.map((m) => (
              <Link key={m.href} href={m.href}
                className="bg-white border border-gray-200 rounded-xl p-4 hover:border-primary/40 hover:shadow-sm transition-all group text-center">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center mx-auto mb-2 group-hover:scale-110 transition-transform"
                  style={{ backgroundColor: m.bg, color: m.fg }}>
                  <m.icon className="w-5 h-5" />
                </div>
                <p className="text-xs font-semibold text-gray-800 leading-tight">{m.label}</p>
                <p className="text-[10px] text-gray-400 mt-0.5 leading-tight">{m.omschrijving}</p>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}

function AlertBox({ icon: Icon, kleur, count, label, href }: { icon: React.ElementType; kleur: string; count: number; label: string; href: string }) {
  const kleuren: Record<string, string> = {
    amber: 'bg-amber-50 text-amber-700',
    blue: 'bg-blue-50 text-blue-700',
    green: 'bg-green-50 text-green-700',
  };
  return (
    <Link href={href} className={`flex items-center gap-3 p-3 rounded-lg ${kleuren[kleur]} hover:opacity-80 transition-opacity`}>
      <Icon className="w-4 h-4 flex-shrink-0" />
      <span className="text-sm font-medium flex-1">{label}</span>
      <span className="font-bold text-lg">{count}</span>
    </Link>
  );
}
