'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  BookUser,
  CalendarDays,
  Bike,
  FileText,
  Users,
  Inbox,
  ChevronRight,
  LogOut,
  Settings,
  TrendingUp,
  Package,
} from 'lucide-react';

const navItems = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard },
  { name: 'Relaties', href: '/relaties', icon: BookUser },
  { name: 'Planning & Opdrachten', href: '/planning', icon: CalendarDays },
  { name: 'Statistieken', href: '/statistieken', icon: TrendingUp },
  { name: 'Voertuigen', href: '/voertuigen', icon: Bike },
  { name: 'Onderdelen', href: '/onderdelen', icon: Package },
  { name: 'Werkbonnen', href: '/werkbonnen', icon: FileText },
  { name: 'Personeel', href: '/personeel', icon: Users },
  { name: 'Service Center', href: '/service-center', icon: Inbox },
];

export default function DashboardLayout({
  children,
  title,
  actions,
}: {
  children: React.ReactNode;
  title?: string;
  actions?: React.ReactNode;
}) {
  const pathname = usePathname();

  const activeItem = navItems
    .slice()
    .reverse()
    .find((item) => pathname === item.href || pathname.startsWith(item.href + '/'));

  const pageTitle = title ?? activeItem?.name ?? 'EuroWheelz';

  return (
    <div className="flex h-screen bg-[#F2F4F0]">
      {/* ── Sidebar ──────────────────────────────── */}
      <aside className="w-60 flex-shrink-0 flex flex-col" style={{ backgroundColor: '#345022' }}>

        {/* Logo */}
        <div className="px-5 py-5 border-b border-white/10">
          <Link href="/" className="flex items-center gap-3 group">
            {/* EW badge */}
            <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 font-black text-base"
              style={{ backgroundColor: '#F3A713', color: '#345022' }}>
              EW
            </div>
            <div className="flex flex-col leading-tight">
              <span className="font-bold text-white text-[15px] tracking-tight">EuroWheelz</span>
              <span className="text-white/40 text-[10px] font-medium uppercase tracking-widest">Plansysteem</span>
            </div>
          </Link>
        </div>

        {/* Navigatie */}
        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          <p className="px-3 mb-2 text-[10px] font-semibold uppercase tracking-widest text-white/30">Modules</p>
          {navItems.map((item) => {
            const isActive =
              item.href === '/'
                ? pathname === '/'
                : pathname === item.href || pathname.startsWith(item.href + '/');
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all
                  ${isActive
                    ? 'text-[#345022] font-semibold'
                    : 'text-white/70 hover:text-white hover:bg-white/10'}`}
                style={isActive ? { backgroundColor: '#F3A713' } : {}}
              >
                <item.icon className="w-4 h-4 flex-shrink-0" />
                <span className="flex-1 truncate">{item.name}</span>
                {isActive && <ChevronRight className="w-3 h-3 opacity-60" />}
              </Link>
            );
          })}
        </nav>

        {/* Onderste sectie */}
        <div className="border-t border-white/10 p-3 space-y-1">
          <Link href="/instellingen"
            className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-white/60 hover:text-white hover:bg-white/10 transition-all">
            <Settings className="w-4 h-4" />
            <span>Instellingen</span>
          </Link>
          <div className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-white/10 cursor-pointer transition-all group">
            <div className="w-7 h-7 rounded-full font-bold text-xs flex items-center justify-center flex-shrink-0 text-white"
              style={{ backgroundColor: '#F3A713', color: '#345022' }}>
              M
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white leading-tight truncate">Maxim</p>
              <p className="text-[11px] text-white/40">Beheerder</p>
            </div>
            <LogOut className="w-3.5 h-3.5 text-white/30 group-hover:text-white/70 transition-colors flex-shrink-0" />
          </div>
        </div>
      </aside>

      {/* ── Hoofdcontent ─────────────────────────── */}
      <main className="flex-1 overflow-auto flex flex-col min-w-0">

        {/* Header */}
        <header className="h-14 bg-white border-b border-gray-200 px-6 flex items-center justify-between sticky top-0 z-10 flex-shrink-0">
          <div className="flex items-center gap-2">
            {/* Breadcrumb-achtig paginatitel */}
            <span className="text-sm font-semibold text-gray-800">{pageTitle}</span>
          </div>
          {actions && (
            <div className="flex items-center gap-3">{actions}</div>
          )}
        </header>

        <div className="flex-1 p-6">
          {children}
        </div>
      </main>
    </div>
  );
}
