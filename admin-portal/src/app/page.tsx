import Link from 'next/link';
import DashboardLayout from '@/components/DashboardLayout';
import {
  BookUser, CalendarDays, Bike, FileText, Users, Inbox,
  ArrowRight, Wrench, AlertTriangle, CheckCircle2, Clock,
} from 'lucide-react';

const modules = [
  { href: '/relaties', icon: BookUser, label: 'Relaties', omschrijving: 'Adresboek & locatie-dashboards', bg: '#345022', fg: 'white' },
  { href: '/planning', icon: CalendarDays, label: 'Planning & Opdrachten', omschrijving: 'Planbord, monteur-agendas', bg: '#F3A713', fg: '#1A1A1A' },
  { href: '/voertuigen', icon: Bike, label: 'Voertuigen', omschrijving: '~1.500 e-choppers', bg: '#345022', fg: 'white' },
  { href: '/werkbonnen', icon: FileText, label: 'Werkbonnen', omschrijving: 'Archief alle opdrachten', bg: '#F3A713', fg: '#1A1A1A' },
  { href: '/personeel', icon: Users, label: 'Personeel', omschrijving: 'Beheerders & monteurs', bg: '#345022', fg: 'white' },
  { href: '/service-center', icon: Inbox, label: 'Service Center', omschrijving: 'Akkoord-flow & vervolg', bg: '#F3A713', fg: '#1A1A1A' },
];

const stats = [
  { label: 'Openstaande opdrachten', value: '6', icon: Wrench, kleur: 'text-[#345022] bg-[#345022]/10' },
  { label: 'Wachten op akkoord', value: '2', icon: AlertTriangle, kleur: 'text-[#F3A713] bg-[#F3A713]/15' },
  { label: 'Afgerond vandaag', value: '3', icon: CheckCircle2, kleur: 'text-green-600 bg-green-50' },
  { label: 'Actieve monteurs', value: '3', icon: Users, kleur: 'text-primary bg-primary/10' },
];

const recente = [
  { id: 'OP-1048', type: 'Onderhoud', locatie: 'Vakantiepark De Koog', status: 'Uitgevoerd', urgentie: false },
  { id: 'OP-1050', type: 'Reparatie', locatie: 'Strandhotel Scheveningen', status: 'Onderweg', urgentie: true },
  { id: 'OP-1055', type: 'Onderhoud', locatie: 'Strandhotel Scheveningen', status: 'Nieuw', urgentie: false },
];

const statusKleur: Record<string, string> = {
  Nieuw: 'bg-yellow-50 text-yellow-700',
  Ingepland: 'bg-blue-50 text-blue-700',
  Onderweg: 'bg-indigo-50 text-indigo-700',
  Uitgevoerd: 'bg-orange-50 text-orange-700',
  Akkoord: 'bg-teal-50 text-teal-700',
  Afgerond: 'bg-green-50 text-green-700',
};

export default function DashboardPage() {
  return (
    <DashboardLayout title="Dashboard">
      <div className="space-y-6">
        {/* KPI stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {stats.map((s) => (
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
          {/* Recente activiteit */}
          <div className="lg:col-span-2 bg-white border border-gray-200 rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="font-semibold text-gray-900">Recente opdrachten</h2>
              <Link href="/planning" className="text-sm text-primary hover:underline flex items-center gap-1">
                Naar planbord <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
            <div className="divide-y divide-gray-50">
              {recente.map((op) => (
                <div key={op.id} className="px-5 py-3.5 flex items-center gap-4 hover:bg-gray-50/60 transition-colors">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      {op.urgentie && <AlertTriangle className="w-3.5 h-3.5 text-red-500 flex-shrink-0" />}
                      <span className="font-medium text-gray-800 text-sm">{op.locatie}</span>
                    </div>
                    <span className="text-xs text-gray-400">{op.type} · {op.id}</span>
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium flex-shrink-0 ${statusKleur[op.status] ?? 'bg-gray-100 text-gray-600'}`}>
                    {op.status}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Service Center alert */}
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="font-semibold text-gray-900">Service Center</h2>
              <Link href="/service-center" className="text-sm text-primary hover:underline flex items-center gap-1">
                Bekijken <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
            <div className="p-5 space-y-3">
              <AlertBox icon={Clock} kleur="amber" count={2} label="Wachten op akkoord" href="/service-center" />
              <AlertBox icon={Wrench} kleur="blue" count={2} label="Vervolgverzoeken" href="/service-center" />
            </div>
          </div>
        </div>

        {/* Modules overzicht */}
        <div>
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">Modules</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {modules.map((m) => (
              <Link
                key={m.href}
                href={m.href}
                className="bg-white border border-gray-200 rounded-xl p-4 hover:border-primary/40 hover:shadow-sm transition-all group text-center"
              >
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
