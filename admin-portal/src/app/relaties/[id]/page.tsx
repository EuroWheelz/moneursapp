'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import DashboardLayout from '@/components/DashboardLayout';
import {
  ChevronLeft, MapPin, Phone, Mail, Clock, Battery, Bike,
  Users, ClipboardList, Star, Megaphone, Edit2, Trash2, Plus,
  CheckCircle2, AlertCircle, Wrench,
} from 'lucide-react';

// Mock data — wordt later uit Supabase geladen
const mockRelatie = {
  id: '1',
  crediteurnummer: 'EW-0001',
  naam: 'Strandhotel Scheveningen',
  type: 'consignatie' as const,
  status: 'actief',
  land: 'NL',
  adres: 'Gevers Deynootplein 30',
  postcode: '2586 CK',
  plaats: 'Scheveningen',
  coordinaten: '52.1054° N, 4.2773° E',
  telefoon: '+31 70 416 2636',
  email: 'info@strandhotelscheveningen.nl',
  aanmaakdatum: '2023-03-15',
  echopers: 8,
  accus: 4,
  openingstijden: 'Ma–Zo 08:00–22:00',
  winterstalling: { van: '01-11', tot: '01-04' },
  mailToggles: {
    werkbon: true,
    afspraakbevestiging: true,
    nieuwsbrief: false,
  },
};

const mockContactpersonen = [
  { id: '1', naam: 'Lisa de Groot', functie: 'Receptie', email: 'lisa@sh-scheveningen.nl', telefoon: '+31 6 1234 5678', toggles: { werkbon: true, afspraakbevestiging: true } },
  { id: '2', naam: 'Mark Visser', functie: 'Beheerder', email: 'mark@sh-scheveningen.nl', telefoon: '+31 6 8765 4321', toggles: { werkbon: true, afspraakbevestiging: false } },
];

const mockVoertuigen = [
  { kenteken: 'EW-0001-A', kleur: '#E63946', status: 'Operationeel' },
  { kenteken: 'EW-0001-B', kleur: '#2A9D8F', status: 'Operationeel' },
  { kenteken: 'EW-0001-C', kleur: '#264653', status: 'Reparatie' },
  { kenteken: 'EW-0001-D', kleur: '#E9C46A', status: 'Operationeel' },
  { kenteken: 'EW-0001-E', kleur: '#F4A261', status: 'Operationeel' },
  { kenteken: 'EW-0001-F', kleur: '#E63946', status: 'Operationeel' },
  { kenteken: 'EW-0001-G', kleur: '#2A9D8F', status: 'Opslag' },
  { kenteken: 'EW-0001-H', kleur: '#264653', status: 'Operationeel' },
];

const mockOpdrachten = [
  { id: 'OP-1042', type: 'Onderhoud', datum: '2025-03-12', monteur: 'Jan Bakker', status: 'Afgerond' },
  { id: 'OP-1018', type: 'Reparatie', datum: '2025-02-05', monteur: 'Kevin Smit', status: 'Afgerond' },
  { id: 'OP-0991', type: 'Accu', datum: '2024-11-20', monteur: 'Jan Bakker', status: 'Afgerond' },
  { id: 'OP-1055', type: 'Onderhoud', datum: '2025-09-01', monteur: '', status: 'Nieuw' },
];

type Tab = 'home' | 'gegevens' | 'contactpersonen' | 'voertuigen' | 'opdrachten' | 'evaluatie' | 'promotiemateriaal';

const tabs: { id: Tab; label: string; icon: React.ElementType; consignatieOnly?: boolean }[] = [
  { id: 'home', label: 'Overzicht', icon: MapPin },
  { id: 'gegevens', label: 'Relatiegegevens', icon: Edit2 },
  { id: 'contactpersonen', label: 'Contactpersonen', icon: Users },
  { id: 'voertuigen', label: 'Voertuigen', icon: Bike },
  { id: 'opdrachten', label: 'Opdrachten', icon: ClipboardList },
  { id: 'evaluatie', label: 'Evaluatie', icon: Star },
  { id: 'promotiemateriaal', label: 'Promotiemateriaal', icon: Megaphone, consignatieOnly: true },
];

const statusKleur: Record<string, string> = {
  Operationeel: 'bg-green-100 text-green-700',
  Reparatie: 'bg-orange-100 text-orange-700',
  'Reparatie in loods': 'bg-red-100 text-red-700',
  Opslag: 'bg-gray-100 text-gray-600',
};

const opdrachtStatusKleur: Record<string, string> = {
  Nieuw: 'bg-yellow-50 text-yellow-700',
  Ingepland: 'bg-blue-50 text-blue-700',
  Onderweg: 'bg-indigo-50 text-indigo-700',
  Uitgevoerd: 'bg-orange-50 text-orange-700',
  Akkoord: 'bg-teal-50 text-teal-700',
  Afgerond: 'bg-green-50 text-green-700',
};

export default function RelatieDetailPage() {
  const params = useParams();
  const [activeTab, setActiveTab] = useState<Tab>('home');
  const relatie = mockRelatie; // in productie: laden op basis van params.id

  const zichtbareTabs = tabs.filter((t) => !t.consignatieOnly || relatie.type === 'consignatie');

  return (
    <DashboardLayout
      title={relatie.naam}
      actions={
        <Link href="/relaties" className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition-colors">
          <ChevronLeft className="w-4 h-4" />
          Alle relaties
        </Link>
      }
    >
      {/* Header kaart */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 mb-4 flex items-center gap-5">
        <div className="w-12 h-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold text-xl flex-shrink-0">
          {relatie.naam.charAt(0)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-lg font-bold text-gray-900">{relatie.naam}</h2>
            <span className={`px-2 py-0.5 rounded text-[11px] font-semibold uppercase tracking-wide
              ${relatie.type === 'consignatie' ? 'bg-blue-50 text-blue-600' : 'bg-gray-100 text-gray-500'}`}>
              {relatie.type}
            </span>
            <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium
              ${relatie.status === 'actief' ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${relatie.status === 'actief' ? 'bg-green-500' : 'bg-gray-400'}`} />
              {relatie.status}
            </span>
          </div>
          <p className="text-sm text-gray-500 mt-0.5">{relatie.crediteurnummer} · {relatie.adres}, {relatie.postcode} {relatie.plaats}</p>
        </div>
        <div className="flex gap-6 text-center flex-shrink-0">
          <div>
            <p className="text-2xl font-bold text-gray-900">{relatie.echopers}</p>
            <p className="text-xs text-gray-400">e-choppers</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-900">{relatie.accus}</p>
            <p className="text-xs text-gray-400">accu&apos;s</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200 mb-5 overflow-x-auto">
        {zichtbareTabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors
              ${activeTab === tab.id
                ? 'border-primary text-primary'
                : 'border-transparent text-gray-500 hover:text-gray-800'}`}
          >
            <tab.icon className="w-3.5 h-3.5" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'home' && <TabHome relatie={relatie} />}
      {activeTab === 'gegevens' && <TabGegevens relatie={relatie} />}
      {activeTab === 'contactpersonen' && <TabContactpersonen />}
      {activeTab === 'voertuigen' && <TabVoertuigen />}
      {activeTab === 'opdrachten' && <TabOpdrachten />}
      {activeTab === 'evaluatie' && <TabEvaluatie />}
      {activeTab === 'promotiemateriaal' && <TabPromotiemateriaal />}
    </DashboardLayout>
  );
}

/* ── Tab: Home ─────────────────────────────────────────────── */
function TabHome({ relatie }: { relatie: typeof mockRelatie }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      <InfoKaart titel="Locatie & adres" icon={MapPin}>
        <dl className="space-y-2 text-sm">
          <InfoRij label="Adres">{relatie.adres}, {relatie.postcode} {relatie.plaats}</InfoRij>
          <InfoRij label="Land">{relatie.land}</InfoRij>
          <InfoRij label="Coördinaten">{relatie.coordinaten}</InfoRij>
          <InfoRij label="Openingstijden">{relatie.openingstijden}</InfoRij>
        </dl>
      </InfoKaart>

      <InfoKaart titel="Contact" icon={Phone}>
        <dl className="space-y-2 text-sm">
          <InfoRij label="Telefoon">{relatie.telefoon}</InfoRij>
          <InfoRij label="E-mail">{relatie.email}</InfoRij>
        </dl>
      </InfoKaart>

      <InfoKaart titel="Vloot & accu's" icon={Bike}>
        <div className="flex gap-6">
          <div className="text-center">
            <p className="text-3xl font-bold text-gray-900">{relatie.echopers}</p>
            <p className="text-xs text-gray-400 mt-0.5">e-choppers</p>
          </div>
          <div className="text-center">
            <p className="text-3xl font-bold text-gray-900">{relatie.accus}</p>
            <p className="text-xs text-gray-400 mt-0.5">accu&apos;s</p>
          </div>
        </div>
        <div className="mt-3">
          <AccuBalk aanwezig={relatie.accus} totaal={Math.ceil(relatie.echopers / 2)} />
        </div>
      </InfoKaart>

      <InfoKaart titel="Winterstalling" icon={Clock}>
        <dl className="space-y-2 text-sm">
          <InfoRij label="Van">{relatie.winterstalling.van}</InfoRij>
          <InfoRij label="Tot">{relatie.winterstalling.tot}</InfoRij>
        </dl>
      </InfoKaart>

      <InfoKaart titel="Mail-instellingen" icon={Mail}>
        <dl className="space-y-2 text-sm">
          <ToggleRij label="Werkbon" aan={relatie.mailToggles.werkbon} />
          <ToggleRij label="Afspraakbevestiging" aan={relatie.mailToggles.afspraakbevestiging} />
          <ToggleRij label="Nieuwsbrief" aan={relatie.mailToggles.nieuwsbrief} />
        </dl>
      </InfoKaart>
    </div>
  );
}

/* ── Tab: Relatiegegevens ──────────────────────────────────── */
function TabGegevens({ relatie }: { relatie: typeof mockRelatie }) {
  return (
    <div className="max-w-2xl space-y-6">
      <Section titel="Basisgegevens">
        <FormGrid>
          <FormVeld label="Crediteurnummer" value={relatie.crediteurnummer} />
          <FormVeld label="Naam" value={relatie.naam} />
          <FormVeld label="Relatietype" value={relatie.type} />
          <FormVeld label="Status" value={relatie.status} />
          <FormVeld label="Aanmaakdatum" value={relatie.aanmaakdatum} />
        </FormGrid>
      </Section>
      <Section titel="Adres & locatie">
        <FormGrid>
          <FormVeld label="Adres" value={relatie.adres} />
          <FormVeld label="Postcode" value={relatie.postcode} />
          <FormVeld label="Plaats" value={relatie.plaats} />
          <FormVeld label="Land" value={relatie.land} />
          <FormVeld label="Coördinaten" value={relatie.coordinaten} />
        </FormGrid>
      </Section>
      <Section titel="Contact">
        <FormGrid>
          <FormVeld label="Telefoon" value={relatie.telefoon} />
          <FormVeld label="E-mail" value={relatie.email} />
          <FormVeld label="Openingstijden" value={relatie.openingstijden} />
        </FormGrid>
      </Section>
      <Section titel="Mail-toggles (algemeen)">
        <div className="space-y-3">
          {Object.entries(relatie.mailToggles).map(([key, aan]) => (
            <label key={key} className="flex items-center gap-3 cursor-pointer">
              <div className={`w-9 h-5 rounded-full transition-colors ${aan ? 'bg-primary' : 'bg-gray-200'} relative`}>
                <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${aan ? 'translate-x-4' : 'translate-x-0.5'}`} />
              </div>
              <span className="text-sm text-gray-700 capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}</span>
            </label>
          ))}
        </div>
      </Section>
      <Section titel="Winterstalling">
        <FormGrid>
          <FormVeld label="Startdatum" value={relatie.winterstalling.van} />
          <FormVeld label="Einddatum" value={relatie.winterstalling.tot} />
        </FormGrid>
      </Section>
      <div className="flex gap-3">
        <button className="px-5 py-2 bg-primary text-white text-sm font-medium rounded-lg hover:bg-primary/90 transition-colors">
          Opslaan
        </button>
        <button className="px-5 py-2 bg-white border border-gray-200 text-gray-600 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors">
          Annuleren
        </button>
      </div>
    </div>
  );
}

/* ── Tab: Contactpersonen ──────────────────────────────────── */
function TabContactpersonen() {
  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <button className="flex items-center gap-2 px-3 py-2 bg-[#F3A713] text-[#1A1A1A] text-sm font-semibold rounded-lg hover:bg-[#D4900E] transition-colors">
          <Plus className="w-4 h-4" />
          Contactpersoon toevoegen
        </button>
      </div>
      {mockContactpersonen.map((cp) => (
        <div key={cp.id} className="bg-white border border-gray-200 rounded-xl p-4 flex items-start gap-4">
          <div className="w-9 h-9 rounded-full bg-gray-100 text-gray-600 flex items-center justify-center font-semibold text-sm flex-shrink-0">
            {cp.naam.charAt(0)}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-medium text-gray-900">{cp.naam}</span>
              <span className="text-xs text-gray-400">{cp.functie}</span>
            </div>
            <div className="mt-1 flex flex-wrap gap-4 text-sm text-gray-500">
              <span className="flex items-center gap-1"><Mail className="w-3.5 h-3.5" />{cp.email}</span>
              <span className="flex items-center gap-1"><Phone className="w-3.5 h-3.5" />{cp.telefoon}</span>
            </div>
            <div className="mt-2 flex gap-4 text-xs">
              <ToggleRij label="Werkbon" aan={cp.toggles.werkbon} />
              <ToggleRij label="Afspraakbevestiging" aan={cp.toggles.afspraakbevestiging} />
            </div>
          </div>
          <div className="flex gap-2 flex-shrink-0">
            <button className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors">
              <Edit2 className="w-4 h-4" />
            </button>
            <button className="p-1.5 rounded hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors">
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ── Tab: Voertuigen ───────────────────────────────────────── */
function TabVoertuigen() {
  const operationeel = mockVoertuigen.filter((v) => v.status === 'Operationeel').length;
  const totaal = mockVoertuigen.length;

  return (
    <div className="space-y-4">
      {/* Accu balk */}
      <div className="bg-white border border-gray-200 rounded-xl p-4">
        <div className="flex items-center gap-3 mb-2">
          <Battery className="w-4 h-4 text-gray-500" />
          <span className="text-sm font-medium text-gray-700">Vloot status</span>
          <span className="text-sm text-gray-400">{operationeel}/{totaal} operationeel</span>
        </div>
        <AccuBalk aanwezig={operationeel} totaal={totaal} />
      </div>

      {/* Voertuigtegels */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
        {mockVoertuigen.map((v) => (
          <Link key={v.kenteken} href={`/voertuigen/${v.kenteken}`}
            className="bg-white border border-gray-200 rounded-xl p-3 hover:border-primary/40 hover:shadow-sm transition-all group">
            <div className="w-full h-16 rounded-lg mb-2.5 flex items-center justify-center" style={{ backgroundColor: v.kleur + '20' }}>
              <Bike className="w-8 h-8" style={{ color: v.kleur }} />
            </div>
            <p className="text-xs font-semibold text-gray-800 text-center leading-tight">{v.kenteken}</p>
            <span className={`mt-1.5 block text-center px-1.5 py-0.5 rounded text-[10px] font-medium ${statusKleur[v.status] ?? 'bg-gray-100 text-gray-600'}`}>
              {v.status}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}

/* ── Tab: Opdrachten ───────────────────────────────────────── */
function TabOpdrachten() {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">{mockOpdrachten.length} opdrachten in totaal</p>
        <button className="flex items-center gap-2 px-3 py-2 bg-[#F3A713] text-[#1A1A1A] text-sm font-semibold rounded-lg hover:bg-[#D4900E] transition-colors">
          <Plus className="w-4 h-4" />
          Opdracht aanmaken
        </button>
      </div>
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50/60">
              {['Opdrachtnummer', 'Type', 'Datum', 'Monteur', 'Status'].map((h) => (
                <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {mockOpdrachten.map((op) => (
              <tr key={op.id} className="hover:bg-gray-50/60 cursor-pointer">
                <td className="px-4 py-3 font-mono text-xs text-gray-600">{op.id}</td>
                <td className="px-4 py-3">
                  <span className="flex items-center gap-1.5">
                    <Wrench className="w-3.5 h-3.5 text-gray-400" />
                    {op.type}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-500">{op.datum}</td>
                <td className="px-4 py-3 text-gray-600">{op.monteur || <span className="text-gray-300 italic">Niet toegewezen</span>}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${opdrachtStatusKleur[op.status] ?? 'bg-gray-100 text-gray-600'}`}>
                    {op.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ── Tab: Evaluatie ────────────────────────────────────────── */
function TabEvaluatie() {
  return (
    <div className="max-w-2xl">
      <p className="text-sm text-gray-500 mb-3">Vrij tekstveld voor notities en evaluaties over deze locatie.</p>
      <textarea
        className="w-full h-48 p-4 text-sm border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary resize-none"
        placeholder="Notities over deze locatie..."
        defaultValue="Locatie is goed bereikbaar. Contactpersoon Lisa is altijd aanwezig bij bezoek. Parkeren mogelijk op het terrein van het hotel."
      />
      <div className="flex gap-3 mt-3">
        <button className="px-5 py-2 bg-primary text-white text-sm font-medium rounded-lg hover:bg-primary/90 transition-colors">
          Opslaan
        </button>
      </div>
    </div>
  );
}

/* ── Tab: Promotiemateriaal ────────────────────────────────── */
function TabPromotiemateriaal() {
  const items = [
    { naam: 'Brochures', aanwezig: true, aantal: 50 },
    { naam: 'Standaard', aanwezig: true, aantal: 1 },
    { naam: 'Vlaggen', aanwezig: false, aantal: 0 },
    { naam: 'Stickers', aanwezig: true, aantal: 100 },
  ];
  return (
    <div className="max-w-lg space-y-3">
      <p className="text-sm text-gray-500">Promotiemateriaal aanwezig bij deze consignatieklant.</p>
      {items.map((item) => (
        <div key={item.naam} className="bg-white border border-gray-200 rounded-xl px-4 py-3 flex items-center gap-4">
          {item.aanwezig
            ? <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0" />
            : <AlertCircle className="w-5 h-5 text-gray-300 flex-shrink-0" />}
          <span className="flex-1 text-sm font-medium text-gray-800">{item.naam}</span>
          {item.aanwezig && <span className="text-sm text-gray-400">{item.aantal}×</span>}
        </div>
      ))}
      <button className="flex items-center gap-2 px-3 py-2 border border-dashed border-gray-300 text-gray-500 text-sm rounded-lg hover:border-primary hover:text-primary transition-colors">
        <Plus className="w-4 h-4" />
        Materiaal toevoegen
      </button>
    </div>
  );
}

/* ── Herbruikbare componenten ──────────────────────────────── */
function InfoKaart({ titel, icon: Icon, children }: { titel: string; icon: React.ElementType; children: React.ReactNode }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4">
      <div className="flex items-center gap-2 mb-3">
        <Icon className="w-4 h-4 text-gray-400" />
        <h3 className="text-sm font-semibold text-gray-700">{titel}</h3>
      </div>
      {children}
    </div>
  );
}

function InfoRij({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-2">
      <dt className="text-gray-400 w-28 flex-shrink-0">{label}</dt>
      <dd className="text-gray-800 font-medium">{children}</dd>
    </div>
  );
}

function ToggleRij({ label, aan }: { label: string; aan: boolean }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className={`w-1.5 h-1.5 rounded-full ${aan ? 'bg-green-500' : 'bg-gray-300'}`} />
      <span className={aan ? 'text-gray-700' : 'text-gray-400'}>{label}</span>
    </div>
  );
}

function AccuBalk({ aanwezig, totaal }: { aanwezig: number; totaal: number }) {
  const pct = totaal === 0 ? 0 : Math.round((aanwezig / totaal) * 100);
  return (
    <div>
      <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${pct > 66 ? 'bg-green-500' : pct > 33 ? 'bg-yellow-400' : 'bg-red-400'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="text-xs text-gray-400 mt-1">{pct}% beschikbaar</p>
    </div>
  );
}

function Section({ titel, children }: { titel: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-sm font-semibold text-gray-700 mb-3 pb-2 border-b border-gray-100">{titel}</h3>
      {children}
    </div>
  );
}

function FormGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-2 gap-4">{children}</div>;
}

function FormVeld({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-500 mb-1">{label}</label>
      <input
        type="text"
        defaultValue={value}
        className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
      />
    </div>
  );
}
