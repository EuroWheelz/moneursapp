'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import DashboardLayout from '@/components/DashboardLayout';
import {
  ChevronLeft, MapPin, Phone, Mail, Clock, Battery, Bike,
  Users, ClipboardList, Star, Megaphone, Edit2, Trash2, Plus,
  CheckCircle2, AlertCircle, Wrench, Loader2, Save, TrendingUp,
  X,
} from 'lucide-react';
import { supabase, DbRelatie } from '@/lib/supabase';
import VoertuigVerledenModal from '@/components/VoertuigVerledenModal';


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
  const router = useRouter();
  const [relatie, setRelatie] = useState<DbRelatie | null>(null);
  const [voertuigen, setVoertuigen] = useState<any[]>([]);
  const [contactpersonen, setContactpersonen] = useState<any[]>([]);
  const [opdrachten, setOpdrachten] = useState<any[]>([]);
  const [monteurMap, setMonteurMap] = useState<Record<string, string>>({});
  const [onderhoudData, setOnderhoudData] = useState<any[]>([]);
  const [accusInventaris, setAccusInventaris] = useState<{ type: string; aantal: number }[]>([]);
  const [laden, setLaden] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>('home');
  const [showVerwijderModal, setShowVerwijderModal] = useState(false);

  useEffect(() => { laadData(); }, [params.id]);

  async function laadData() {
    setLaden(true);
    const { data } = await supabase
      .from('relaties')
      .select('*')
      .eq('id', params.id as string)
      .is('deleted_at', null)
      .single();
    
    if (data) {
      setRelatie(data);
      // Haal gekoppelde voertuigen op
      const { data: v } = await supabase.from('voertuigen').select('*').eq('relatie_id', data.id);
      setVoertuigen(v ?? []);

      // Haal contactpersonen op
      const { data: cp } = await supabase.from('contactpersonen').select('*').eq('relatie_id', data.id);
      setContactpersonen(cp ?? []);

      // Haal opdrachten op
      const { data: o } = await supabase.from('opdrachten').select('*').eq('locatie', data.naam).order('created_at', { ascending: false });
      setOpdrachten(o ?? []);

      // Haal monteur namen op
      const { data: m } = await supabase.from('monteurs').select('id, naam, voornaam');
      const mMap: Record<string, string> = {};
      (m ?? []).forEach((mont: any) => { mMap[mont.id] = `${mont.voornaam} ${mont.naam}`; });
      setMonteurMap(mMap);

      // Haal accu inventaris op
      const { data: accuData } = await supabase
        .from('accu_inventaris')
        .select('type, aantal')
        .eq('relatie_id', data.id)
        .order('type');
      setAccusInventaris((accuData ?? []) as { type: string; aantal: number }[]);

      // Haal gebruikte onderdelen op voor alle opdrachten van deze relatie
      const opIds = (o ?? []).map((op: any) => op.id);
      if (opIds.length > 0) {
        const { data: ooData } = await supabase
          .from('opdracht_onderdelen')
          .select('opdracht_id, aantal, onderdelen(naam, prijs)')
          .in('opdracht_id', opIds);
        setOnderhoudData(ooData ?? []);
      }
    }
    setLaden(false);
  }

  if (laden) {
    return (
      <DashboardLayout title="Laden..." actions={<Link href="/relaties" className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition-colors"><ChevronLeft className="w-4 h-4" />Alle relaties</Link>}>
        <div className="py-16 text-center text-sm text-gray-400">Laden...</div>
      </DashboardLayout>
    );
  }

  if (!relatie) {
    return (
      <DashboardLayout title="Niet gevonden" actions={<Link href="/relaties" className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition-colors"><ChevronLeft className="w-4 h-4" />Alle relaties</Link>}>
        <div className="py-16 text-center text-sm text-gray-400">Relatie niet gevonden.</div>
      </DashboardLayout>
    );
  }

  const zichtbareTabs = tabs.filter((t) => !t.consignatieOnly || relatie.type === 'consignatie');

  return (
    <DashboardLayout
      title={relatie.naam}
      actions={
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowVerwijderModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Verwijderen
          </button>
          <Link href="/relaties" className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition-colors">
            <ChevronLeft className="w-4 h-4" />
            Alle relaties
          </Link>
        </div>
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
          <p className="text-sm text-gray-500 mt-0.5">{relatie.crediteurnummer ?? '—'} · {relatie.adres}, {relatie.postcode} {relatie.plaats}</p>
        </div>
        <div className="flex gap-6 text-center flex-shrink-0 items-start">
          <div>
            <p className="text-2xl font-bold text-gray-900">{voertuigen.length}</p>
            <p className="text-xs text-gray-400">e-choppers</p>
          </div>
          <div className="text-left">
            <div className="flex items-baseline gap-1.5 mb-1">
              <p className="text-2xl font-bold text-gray-900">
                {accusInventaris.reduce((s, a) => s + a.aantal, 0) || relatie.accus}
              </p>
              <p className="text-xs text-gray-400">accu&apos;s</p>
            </div>
            {accusInventaris.length > 0 ? (
              <div className="flex flex-col gap-0.5">
                {accusInventaris.filter((a) => a.aantal > 0).map((a) => (
                  <span
                    key={a.type}
                    className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold border ${
                      a.type === 'Nieuw 30Ah'
                        ? 'bg-yellow-50 text-yellow-700 border-yellow-200'
                        : a.type === 'Nieuw 20Ah'
                        ? 'bg-blue-50 text-blue-700 border-blue-200'
                        : 'bg-gray-100 text-gray-500 border-gray-200'
                    }`}
                  >
                    {a.aantal}× {a.type}
                  </span>
                ))}
              </div>
            ) : null}
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
      {activeTab === 'home' && <TabHome relatie={relatie} opdrachten={opdrachten} monteurMap={monteurMap} onderhoudData={onderhoudData} accusInventaris={accusInventaris} />}
      {activeTab === 'gegevens' && <TabGegevens relatie={relatie} onOpgeslagen={setRelatie} />}
      {activeTab === 'contactpersonen' && <TabContactpersonen contactpersonen={contactpersonen} relatieId={relatie.id} onUpdate={laadData} />}
      {activeTab === 'voertuigen' && <TabVoertuigen voertuigen={voertuigen} onUpdate={laadData} />}
      {activeTab === 'opdrachten' && <TabOpdrachten opdrachten={opdrachten} monteurMap={monteurMap} onderhoudData={onderhoudData} relatieNaam={relatie.naam} />}
      {activeTab === 'evaluatie' && <TabEvaluatie relatieId={relatie.id} initNotitie={relatie.notitie ?? ''} />}
      {activeTab === 'promotiemateriaal' && <TabPromotiemateriaal relatieId={relatie.id} />}

      {showVerwijderModal && (
        <VerwijderRelatieModal
          relatie={relatie}
          onClose={() => setShowVerwijderModal(false)}
          onSuccess={() => router.push('/relaties')}
        />
      )}
    </DashboardLayout>
  );
}

function VerwijderRelatieModal({ relatie, onClose, onSuccess }: { relatie: DbRelatie; onClose: () => void; onSuccess: () => void }) {
  const [bezig, setBezig] = useState(false);
  const [fout, setFout] = useState('');

  async function verwijder() {
    setBezig(true);
    setFout('');
    const { error } = await supabase
      .from('relaties')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', relatie.id);
    setBezig(false);
    if (error) { setFout(error.message); return; }
    onSuccess();
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-100">
          <div className="w-9 h-9 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
            <Trash2 className="w-4 h-4 text-red-600" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-bold text-gray-900">Relatie verwijderen</p>
            <p className="text-xs text-gray-500 mt-0.5">{relatie.naam}</p>
          </div>
        </div>
        <div className="px-5 py-4 space-y-3">
          <p className="text-sm text-gray-700">
            Weet je zeker dat je <span className="font-semibold">{relatie.naam}</span> wilt verwijderen?
          </p>
          <div className="bg-blue-50 border border-blue-200 rounded-lg px-3 py-2.5 text-xs text-blue-800 flex items-start gap-2">
            <span>De relatie wordt naar de prullenbak verplaatst en is terug te vinden via <strong>Relaties → Verwijderd</strong>.</span>
          </div>
          {fout && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{fout}</p>}
        </div>
        <div className="px-5 pb-5 flex gap-2">
          <button
            onClick={verwijder}
            disabled={bezig}
            className="flex-1 py-2.5 bg-red-600 text-white text-sm font-bold rounded-xl hover:bg-red-700 transition-colors disabled:opacity-60"
          >
            {bezig ? 'Verwijderen...' : 'Verwijderen'}
          </button>
          <button onClick={onClose} className="px-4 py-2.5 border border-gray-200 text-gray-600 text-sm font-medium rounded-xl hover:bg-gray-50 transition-colors">
            Annuleer
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Tab: Home ─────────────────────────────────────────────── */
function TabHome({ relatie, opdrachten, monteurMap, onderhoudData, accusInventaris }: {
  relatie: DbRelatie;
  opdrachten: any[];
  monteurMap: Record<string, string>;
  onderhoudData: any[];
  accusInventaris: { type: string; aantal: number }[];
}) {
  const coordStr = relatie.lat && relatie.lng
    ? `${relatie.lat.toFixed(4)}° N, ${relatie.lng.toFixed(4)}° E`
    : '—';

  const fmtD = (d: string | null) => d
    ? new Date(d + (d.length === 10 ? 'T12:00:00' : '')).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', year: 'numeric' })
    : null;

  // Onderhoud statistieken
  const afgesloten = opdrachten.filter((o) => o.status === 'uitgevoerd' || o.status === 'afgerond');
  const perType: Record<string, number> = {};
  for (const op of opdrachten) perType[op.type] = (perType[op.type] ?? 0) + 1;

  const typeLabels: Record<string, string> = {
    onderhoud: 'Onderhoud', reparatie: 'Reparatie', accu: 'Accu',
    plaatsen: 'Plaatsen', terughalen: 'Terughalen', evaluatie: 'Evaluatie',
    voertuigruil: 'Voertuigruil', pechhulp: 'Pechhulp',
  };

  // Onderdelen totalen
  let totaalOnderdelen = 0;
  let totaalKosten = 0;
  let heeftKosten = false;
  for (const oo of onderhoudData) {
    const aantal = oo.aantal ?? 1;
    const prijs = (oo.onderdelen as any)?.prijs ?? null;
    totaalOnderdelen += aantal;
    if (prijs != null) { totaalKosten += prijs * aantal; heeftKosten = true; }
  }

  const recenteOpdrachten = [...opdrachten].slice(0, 3);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {/* Onderhoud kaart — breed over volle breedte */}
      <div className="lg:col-span-3 bg-white border border-gray-200 rounded-xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-semibold text-gray-700">Onderhoud overzicht</h3>
          <span className="ml-auto text-xs text-gray-400">{opdrachten.length} opdrachten totaal</span>
        </div>

        {opdrachten.length === 0 ? (
          <p className="text-sm text-gray-400 italic">Nog geen opdrachten voor deze locatie.</p>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-5">
            <div className="bg-gray-50 rounded-xl p-3">
              <p className="text-2xl font-black text-gray-900">{opdrachten.length}</p>
              <p className="text-xs text-gray-400 mt-0.5">Opdrachten totaal</p>
            </div>
            <div className="bg-gray-50 rounded-xl p-3">
              <p className="text-2xl font-black text-gray-900">{afgesloten.length}</p>
              <p className="text-xs text-gray-400 mt-0.5">Uitgevoerd / afgerond</p>
            </div>
            <div className="bg-gray-50 rounded-xl p-3">
              <p className="text-2xl font-black text-gray-900">{totaalOnderdelen}</p>
              <p className="text-xs text-gray-400 mt-0.5">Onderdelen gebruikt</p>
            </div>
            <div className="bg-gray-50 rounded-xl p-3">
              <p className="text-2xl font-black text-gray-900">{heeftKosten ? `€ ${totaalKosten.toFixed(2)}` : '—'}</p>
              <p className="text-xs text-gray-400 mt-0.5">Totaal materiaalkosten</p>
            </div>
          </div>
        )}

        {Object.keys(perType).length > 0 && (
          <div className="mb-5">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Per type</p>
            <div className="flex flex-wrap gap-2">
              {Object.entries(perType).sort((a, b) => b[1] - a[1]).map(([type, count]) => (
                <span key={type} className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-primary/8 text-primary text-xs font-semibold rounded-lg">
                  <Wrench className="w-3 h-3" />
                  {typeLabels[type] ?? type} <span className="bg-primary/20 text-primary rounded px-1">{count}</span>
                </span>
              ))}
            </div>
          </div>
        )}

        {recenteOpdrachten.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Recente opdrachten</p>
            <div className="space-y-1.5">
              {recenteOpdrachten.map((op) => (
                <div key={op.id} className="flex items-center gap-3 text-xs text-gray-600 bg-gray-50 rounded-lg px-3 py-2">
                  <span className="font-mono text-gray-400 w-20 flex-shrink-0">{op.id}</span>
                  <span className="font-medium text-gray-700 w-24 flex-shrink-0">{typeLabels[op.type] ?? op.type}</span>
                  <span className="text-gray-400">{fmtD(op.datum) ?? 'Niet ingepland'}</span>
                  <span className="text-gray-400">{op.monteur_id ? monteurMap[op.monteur_id] ?? op.monteur_id : '—'}</span>
                  <span className={`ml-auto px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                    op.status === 'afgerond' ? 'bg-green-50 text-green-700' :
                    op.status === 'uitgevoerd' ? 'bg-orange-50 text-orange-700' :
                    op.status === 'ingepland' ? 'bg-blue-50 text-blue-700' : 'bg-gray-100 text-gray-500'
                  }`}>{op.status}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <InfoKaart titel="Locatie & adres" icon={MapPin}>
        <dl className="space-y-2 text-sm">
          <InfoRij label="Adres">{relatie.adres}, {relatie.postcode} {relatie.plaats}</InfoRij>
          <InfoRij label="Land">{relatie.land}</InfoRij>
          <InfoRij label="Coördinaten">{coordStr}</InfoRij>
          <InfoRij label="Openingstijden">{relatie.openingstijden || '—'}</InfoRij>
        </dl>
      </InfoKaart>

      <InfoKaart titel="Contact" icon={Phone}>
        <dl className="space-y-2 text-sm">
          <InfoRij label="Telefoon">{relatie.telefoon || '—'}</InfoRij>
          <InfoRij label="E-mail">{relatie.email || '—'}</InfoRij>
          <InfoRij label="Contactpersoon">{relatie.contactpersoon || '—'}</InfoRij>
        </dl>
      </InfoKaart>

      <InfoKaart titel="Accu-inventaris" icon={Battery}>
        {(() => {
          const gevuld = accusInventaris.filter((a) => a.aantal > 0);
          const totaal = gevuld.reduce((s, a) => s + a.aantal, 0) || relatie.accus;
          const typeKleur: Record<string, string> = {
            'Nieuw 30Ah': 'bg-yellow-50 text-yellow-700 border-yellow-200',
            'Nieuw 20Ah': 'bg-blue-50 text-blue-700 border-blue-200',
            'Oud 20Ah':   'bg-gray-100 text-gray-600 border-gray-200',
          };
          return (
            <>
              <div className="flex items-baseline gap-2 mb-3">
                <span className="text-3xl font-bold text-gray-900">{totaal}</span>
                <span className="text-sm text-gray-400">accu&apos;s totaal</span>
              </div>
              {gevuld.length > 0 ? (
                <div className="space-y-2">
                  {gevuld.map((a) => (
                    <div key={a.type} className="flex items-center justify-between gap-2">
                      <span className={`inline-flex items-center px-2 py-1 rounded-lg border text-xs font-semibold ${typeKleur[a.type] ?? 'bg-gray-100 text-gray-600 border-gray-200'}`}>
                        {a.type}
                      </span>
                      <span className="text-sm font-bold text-gray-800">{a.aantal}×</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-gray-400 italic">Nog geen accu-inventaris geïmporteerd</p>
              )}
              <div className="mt-3 pt-3 border-t border-gray-100">
                <AccuBalk aanwezig={totaal} totaal={Math.ceil(relatie.echopers / 2)} />
              </div>
            </>
          );
        })()}
      </InfoKaart>

      <InfoKaart titel="Winterstalling" icon={Clock}>
        <dl className="space-y-2 text-sm">
          <InfoRij label="Van">{relatie.winterstalling_van || '—'}</InfoRij>
          <InfoRij label="Tot">{relatie.winterstalling_tot || '—'}</InfoRij>
        </dl>
      </InfoKaart>

      <InfoKaart titel="Mail-instellingen" icon={Mail}>
        <dl className="space-y-2 text-sm">
          <ToggleRij label="Werkbon" aan={relatie.mail_werkbon} />
          <ToggleRij label="Afspraakbevestiging" aan={relatie.mail_afspraakbevestiging} />
          <ToggleRij label="Nieuwsbrief" aan={relatie.mail_nieuwsbrief} />
        </dl>
      </InfoKaart>
    </div>
  );
}

/* ── Tab: Relatiegegevens ──────────────────────────────────── */
function TabGegevens({ relatie, onOpgeslagen }: { relatie: DbRelatie; onOpgeslagen: (r: DbRelatie) => void }) {
  const aanmaakdatum = new Date(relatie.created_at).toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' });

  const [form, setForm] = useState({
    naam: relatie.naam,
    type: relatie.type,
    status: relatie.status,
    adres: relatie.adres,
    postcode: relatie.postcode,
    plaats: relatie.plaats,
    land: relatie.land,
    lat: relatie.lat?.toString() ?? '',
    lng: relatie.lng?.toString() ?? '',
    telefoon: relatie.telefoon,
    email: relatie.email,
    contactpersoon: relatie.contactpersoon,
    openingstijden: relatie.openingstijden,
    echopers: relatie.echopers.toString(),
    accus: relatie.accus.toString(),
    winterstalling_van: relatie.winterstalling_van,
    winterstalling_tot: relatie.winterstalling_tot,
    mail_werkbon: relatie.mail_werkbon,
    mail_afspraakbevestiging: relatie.mail_afspraakbevestiging,
    mail_nieuwsbrief: relatie.mail_nieuwsbrief,
  });

  const [geslotenDagen, setGeslotenDagen] = useState<number[]>(relatie.gesloten_dagen ?? []);

  const [bezig, setBezig] = useState(false);
  const [succes, setSucces] = useState(false);
  const [fout, setFout] = useState<string | null>(null);

  const wijzigd = JSON.stringify(form) !== JSON.stringify({
    naam: relatie.naam, type: relatie.type, status: relatie.status,
    adres: relatie.adres, postcode: relatie.postcode, plaats: relatie.plaats, land: relatie.land,
    lat: relatie.lat?.toString() ?? '', lng: relatie.lng?.toString() ?? '',
    telefoon: relatie.telefoon, email: relatie.email, contactpersoon: relatie.contactpersoon,
    openingstijden: relatie.openingstijden, echopers: relatie.echopers.toString(), accus: relatie.accus.toString(),
    winterstalling_van: relatie.winterstalling_van, winterstalling_tot: relatie.winterstalling_tot,
    mail_werkbon: relatie.mail_werkbon, mail_afspraakbevestiging: relatie.mail_afspraakbevestiging, mail_nieuwsbrief: relatie.mail_nieuwsbrief,
  }) || JSON.stringify([...geslotenDagen].sort()) !== JSON.stringify([...(relatie.gesloten_dagen ?? [])].sort());

  function set(key: string, val: string | boolean) {
    setForm((f) => ({ ...f, [key]: val }));
    setSucces(false);
    setFout(null);
  }

  function annuleer() {
    setForm({
      naam: relatie.naam, type: relatie.type, status: relatie.status,
      adres: relatie.adres, postcode: relatie.postcode, plaats: relatie.plaats, land: relatie.land,
      lat: relatie.lat?.toString() ?? '', lng: relatie.lng?.toString() ?? '',
      telefoon: relatie.telefoon, email: relatie.email, contactpersoon: relatie.contactpersoon,
      openingstijden: relatie.openingstijden, echopers: relatie.echopers.toString(), accus: relatie.accus.toString(),
      winterstalling_van: relatie.winterstalling_van, winterstalling_tot: relatie.winterstalling_tot,
      mail_werkbon: relatie.mail_werkbon, mail_afspraakbevestiging: relatie.mail_afspraakbevestiging, mail_nieuwsbrief: relatie.mail_nieuwsbrief,
    });
    setGeslotenDagen(relatie.gesloten_dagen ?? []);
    setFout(null);
    setSucces(false);
  }

  async function slaOp() {
    setBezig(true);
    setFout(null);

    const updates = {
      naam: form.naam.trim(),
      type: form.type,
      status: form.status,
      adres: form.adres.trim(),
      postcode: form.postcode.trim(),
      plaats: form.plaats.trim(),
      land: form.land.trim().toUpperCase(),
      lat: form.lat ? parseFloat(form.lat) : null,
      lng: form.lng ? parseFloat(form.lng) : null,
      telefoon: form.telefoon.trim(),
      email: form.email.trim(),
      contactpersoon: form.contactpersoon.trim(),
      openingstijden: form.openingstijden.trim(),
      echopers: parseInt(form.echopers) || 0,
      accus: parseInt(form.accus) || 0,
      winterstalling_van: form.winterstalling_van.trim(),
      winterstalling_tot: form.winterstalling_tot.trim(),
      mail_werkbon: form.mail_werkbon,
      mail_afspraakbevestiging: form.mail_afspraakbevestiging,
      mail_nieuwsbrief: form.mail_nieuwsbrief,
      gesloten_dagen: geslotenDagen,
    };

    const { data, error } = await supabase
      .from('relaties')
      .update(updates)
      .eq('id', relatie.id)
      .select()
      .single();

    setBezig(false);

    if (error) {
      setFout('Opslaan mislukt: ' + error.message);
      return;
    }

    setSucces(true);
    onOpgeslagen(data as DbRelatie);
    setTimeout(() => setSucces(false), 3000);
  }

  const invoer = (key: string) => ({
    value: form[key as keyof typeof form] as string,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => set(key, e.target.value),
  });

  return (
    <div className="max-w-2xl space-y-6">
      {fout && (
        <div className="p-3 bg-red-50 border border-red-100 rounded-xl flex items-center gap-2 text-red-600 text-sm">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {fout}
        </div>
      )}

      <Section titel="Basisgegevens">
        <FormGrid>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Crediteurnummer</label>
            <input type="text" value={relatie.crediteurnummer ?? '—'} disabled
              className="w-full px-3 py-2 text-sm border border-gray-100 rounded-lg bg-gray-50 text-gray-400 cursor-not-allowed" />
          </div>
          <FormInvoer label="Naam" {...invoer('naam')} />
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Relatietype</label>
            <select {...invoer('type')} className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary">
              <option value="consignatie">Consignatie</option>
              <option value="klant">Klant</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Status</label>
            <select {...invoer('status')} className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary">
              <option value="actief">Actief</option>
              <option value="inactief">Inactief</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Aanmaakdatum</label>
            <input type="text" value={aanmaakdatum} disabled
              className="w-full px-3 py-2 text-sm border border-gray-100 rounded-lg bg-gray-50 text-gray-400 cursor-not-allowed" />
          </div>
        </FormGrid>
      </Section>

      <Section titel="Vloot">
        <FormGrid>
          <FormInvoer label="Aantal e-choppers" type="number" {...invoer('echopers')} />
          <FormInvoer label="Aantal accu's" type="number" {...invoer('accus')} />
        </FormGrid>
      </Section>

      <Section titel="Adres & locatie">
        <FormGrid>
          <FormInvoer label="Adres" {...invoer('adres')} />
          <FormInvoer label="Postcode" {...invoer('postcode')} />
          <FormInvoer label="Plaats" {...invoer('plaats')} />
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Land</label>
            <select {...invoer('land')} className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary">
              <option value="NL">Nederland</option>
              <option value="BE">België</option>
              <option value="DE">Duitsland</option>
              <option value="FR">Frankrijk</option>
              <option value="LU">Luxemburg</option>
            </select>
          </div>
          <FormInvoer label="Breedtegraad (lat)" placeholder="bv. 52.1133" {...invoer('lat')} />
          <FormInvoer label="Lengtegraad (lng)" placeholder="bv. 4.2821" {...invoer('lng')} />
        </FormGrid>
      </Section>

      <Section titel="Contact">
        <FormGrid>
          <FormInvoer label="Telefoon" {...invoer('telefoon')} />
          <FormInvoer label="E-mail" {...invoer('email')} />
          <FormInvoer label="Contactpersoon" {...invoer('contactpersoon')} />
          <FormInvoer label="Openingstijden" {...invoer('openingstijden')} />
        </FormGrid>
      </Section>

      <Section titel="Mail-instellingen">
        <div className="space-y-3">
          {([
            { key: 'mail_werkbon', label: 'Werkbon' },
            { key: 'mail_afspraakbevestiging', label: 'Afspraakbevestiging' },
            { key: 'mail_nieuwsbrief', label: 'Nieuwsbrief' },
          ] as const).map(({ key, label }) => (
            <label key={key} className="flex items-center gap-3 cursor-pointer">
              <button
                type="button"
                onClick={() => set(key, !form[key])}
                className={`w-9 h-5 rounded-full transition-colors relative flex-shrink-0 ${form[key] ? 'bg-primary' : 'bg-gray-200'}`}
              >
                <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${form[key] ? 'translate-x-4' : 'translate-x-0.5'}`} />
              </button>
              <span className="text-sm text-gray-700">{label}</span>
            </label>
          ))}
        </div>
      </Section>

      <Section titel="Winterstalling">
        <FormGrid>
          <FormInvoer label="Startdatum (bv. 01-11)" {...invoer('winterstalling_van')} />
          <FormInvoer label="Einddatum (bv. 01-04)" {...invoer('winterstalling_tot')} />
        </FormGrid>
      </Section>

      <Section titel="Gesloten dagen">
        <p className="text-xs text-gray-400 mb-3">Vink aan op welke weekdagen deze locatie gesloten is. Auto-planning slaat deze dagen over.</p>
        <div className="flex gap-2 flex-wrap">
          {([1, 2, 3, 4, 5, 6, 0] as const).map((dag) => {
            const labels: Record<number, string> = { 1: 'Ma', 2: 'Di', 3: 'Wo', 4: 'Do', 5: 'Vr', 6: 'Za', 0: 'Zo' };
            const actief = geslotenDagen.includes(dag);
            return (
              <button
                key={dag}
                type="button"
                onClick={() => setGeslotenDagen((d) => actief ? d.filter((x) => x !== dag) : [...d, dag])}
                className={`w-12 h-10 rounded-lg text-sm font-semibold border-2 transition-all ${actief ? 'border-red-400 bg-red-50 text-red-600' : 'border-gray-200 text-gray-400 hover:border-gray-300 hover:text-gray-600'}`}
              >
                {labels[dag]}
              </button>
            );
          })}
        </div>
      </Section>

      <div className="flex items-center gap-3">
        <button
          onClick={slaOp}
          disabled={bezig || !wijzigd}
          className="flex items-center gap-2 px-5 py-2 bg-primary text-white text-sm font-semibold rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
        >
          {bezig ? <Loader2 className="w-4 h-4 animate-spin" /> : succes ? <CheckCircle2 className="w-4 h-4" /> : <Save className="w-4 h-4" />}
          {bezig ? 'Opslaan...' : succes ? 'Opgeslagen!' : 'Opslaan'}
        </button>
        <button
          onClick={annuleer}
          disabled={bezig || !wijzigd}
          className="px-5 py-2 bg-white border border-gray-200 text-gray-600 text-sm font-medium rounded-lg hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
        >
          Annuleren
        </button>
        {!wijzigd && <span className="text-xs text-gray-400">Geen wijzigingen</span>}
      </div>
    </div>
  );
}

/* ── Tab: Contactpersonen ──────────────────────────────────── */
function TabContactpersonen({ contactpersonen, relatieId, onUpdate }: { contactpersonen: any[]; relatieId: string; onUpdate: () => void }) {
  const [showAdd, setShowAdd] = useState(false);
  const [editCp, setEditCp] = useState<any | null>(null);
  const [bezig, setBezig] = useState<string | null>(null);

  async function verwijder(id: string) {
    if (!confirm('Weet je zeker dat je deze contactpersoon wilt verwijderen?')) return;
    setBezig(id);
    const { error } = await supabase.from('contactpersonen').delete().eq('id', id);
    if (error) alert('Verwijderen mislukt: ' + error.message);
    else onUpdate();
    setBezig(null);
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <button 
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-2 px-3 py-2 bg-[#F3A713] text-[#1A1A1A] text-sm font-semibold rounded-lg hover:bg-[#D4900E] transition-colors"
        >
          <Plus className="w-4 h-4" />
          Contactpersoon toevoegen
        </button>
      </div>

      {contactpersonen.length === 0 && (
        <div className="py-12 text-center text-sm text-gray-400 border-2 border-dashed border-gray-100 rounded-xl">
          Nog geen contactpersonen toegevoegd.
        </div>
      )}

      {contactpersonen.map((cp) => (
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
              {cp.email && <span className="flex items-center gap-1"><Mail className="w-3.5 h-3.5" />{cp.email}</span>}
              {cp.telefoon && <span className="flex items-center gap-1"><Phone className="w-3.5 h-3.5" />{cp.telefoon}</span>}
            </div>
            <div className="mt-2 flex gap-4 text-xs">
              <ToggleRij label="Werkbon" aan={cp.mail_werkbon} />
              <ToggleRij label="Afspraakbevestiging" aan={cp.mail_afspraakbevestiging} />
            </div>
          </div>
          <div className="flex gap-2 flex-shrink-0">
            <button onClick={() => setEditCp(cp)} className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors">
              <Edit2 className="w-4 h-4" />
            </button>
            <button 
              onClick={() => verwijder(cp.id)}
              disabled={bezig === cp.id}
              className="p-1.5 rounded hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors disabled:opacity-50"
            >
              {bezig === cp.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
            </button>
          </div>
        </div>
      ))}

      {showAdd && (
        <VoegContactpersoonModal
          relatieId={relatieId}
          onClose={() => setShowAdd(false)}
          onSuccess={() => { setShowAdd(false); onUpdate(); }}
        />
      )}
      {editCp && (
        <BewerkContactpersoonModal
          contactpersoon={editCp}
          onClose={() => setEditCp(null)}
          onSuccess={() => { setEditCp(null); onUpdate(); }}
        />
      )}
    </div>
  );
}

function VoegContactpersoonModal({ relatieId, onClose, onSuccess }: { relatieId: string; onClose: () => void; onSuccess: () => void }) {
  const [form, setForm] = useState({ naam: '', functie: '', email: '', telefoon: '', mail_werkbon: true, mail_afspraakbevestiging: true });
  const [bezig, setBezig] = useState(false);

  async function slaOp() {
    if (!form.naam) return alert('Naam is verplicht');
    setBezig(true);
    const { error } = await supabase.from('contactpersonen').insert([{ ...form, relatie_id: relatieId }]);
    if (error) alert('Opslaan mislukt: ' + error.message);
    else onSuccess();
    setBezig(false);
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
        <div className="p-6 border-b border-gray-100">
          <h3 className="text-lg font-bold text-gray-900">Contactpersoon toevoegen</h3>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Naam *</label>
            <input type="text" value={form.naam} onChange={e => setForm({ ...form, naam: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Functie</label>
            <input type="text" value={form.functie} onChange={e => setForm({ ...form, functie: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">E-mail</label>
              <input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Telefoon</label>
              <input type="text" value={form.telefoon} onChange={e => setForm({ ...form, telefoon: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20" />
            </div>
          </div>
          <div className="space-y-2 pt-2">
            <label className="flex items-center gap-3 cursor-pointer">
              <input type="checkbox" checked={form.mail_werkbon} onChange={e => setForm({ ...form, mail_werkbon: e.target.checked })} />
              <span className="text-sm text-gray-700">Ontvangt digitale werkbonnen</span>
            </label>
            <label className="flex items-center gap-3 cursor-pointer">
              <input type="checkbox" checked={form.mail_afspraakbevestiging} onChange={e => setForm({ ...form, mail_afspraakbevestiging: e.target.checked })} />
              <span className="text-sm text-gray-700">Ontvangt afspraakbevestigingen</span>
            </label>
          </div>
        </div>
        <div className="p-6 bg-gray-50 border-t border-gray-100 flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-800">Annuleren</button>
          <button onClick={slaOp} disabled={bezig} className="px-6 py-2 bg-primary text-white text-sm font-bold rounded-lg hover:bg-primary/90 disabled:opacity-50">
            {bezig ? 'Opslaan...' : 'Opslaan'}
          </button>
        </div>
      </div>
    </div>
  );
}

function BewerkContactpersoonModal({ contactpersoon, onClose, onSuccess }: { contactpersoon: any; onClose: () => void; onSuccess: () => void }) {
  const [form, setForm] = useState({
    naam: contactpersoon.naam ?? '',
    functie: contactpersoon.functie ?? '',
    email: contactpersoon.email ?? '',
    telefoon: contactpersoon.telefoon ?? '',
    mail_werkbon: contactpersoon.mail_werkbon ?? true,
    mail_afspraakbevestiging: contactpersoon.mail_afspraakbevestiging ?? true,
  });
  const [bezig, setBezig] = useState(false);

  async function slaOp() {
    if (!form.naam) return alert('Naam is verplicht');
    setBezig(true);
    const { error } = await supabase.from('contactpersonen').update(form).eq('id', contactpersoon.id);
    if (error) alert('Opslaan mislukt: ' + error.message);
    else onSuccess();
    setBezig(false);
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
        <div className="p-6 border-b border-gray-100">
          <h3 className="text-lg font-bold text-gray-900">Contactpersoon bewerken</h3>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Naam *</label>
            <input type="text" value={form.naam} onChange={e => setForm({ ...form, naam: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Functie</label>
            <input type="text" value={form.functie} onChange={e => setForm({ ...form, functie: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">E-mail</label>
              <input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Telefoon</label>
              <input type="text" value={form.telefoon} onChange={e => setForm({ ...form, telefoon: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20" />
            </div>
          </div>
          <div className="space-y-2 pt-2">
            <label className="flex items-center gap-3 cursor-pointer">
              <input type="checkbox" checked={form.mail_werkbon} onChange={e => setForm({ ...form, mail_werkbon: e.target.checked })} />
              <span className="text-sm text-gray-700">Ontvangt digitale werkbonnen</span>
            </label>
            <label className="flex items-center gap-3 cursor-pointer">
              <input type="checkbox" checked={form.mail_afspraakbevestiging} onChange={e => setForm({ ...form, mail_afspraakbevestiging: e.target.checked })} />
              <span className="text-sm text-gray-700">Ontvangt afspraakbevestigingen</span>
            </label>
          </div>
        </div>
        <div className="p-6 bg-gray-50 border-t border-gray-100 flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-800">Annuleren</button>
          <button onClick={slaOp} disabled={bezig} className="px-6 py-2 bg-primary text-white text-sm font-bold rounded-lg hover:bg-primary/90 disabled:opacity-50">
            {bezig ? 'Opslaan...' : 'Opslaan'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Tab: Voertuigen ───────────────────────────────────────── */
function TabVoertuigen({ voertuigen, onUpdate }: { voertuigen: any[]; onUpdate: () => void }) {
  const [selectedVoertuig, setSelectedVoertuig] = useState<any | null>(null);
  const [verledenKenteken, setVerledenKenteken] = useState<string | null>(null);
  const operationeel = voertuigen.filter((v) => v.object_status === 'Operationeel').length;
  const totaal = voertuigen.length;

  return (
    <div className="space-y-4">
      <div className="bg-white border border-gray-200 rounded-xl p-4">
        <div className="flex items-center gap-3 mb-2">
          <Battery className="w-4 h-4 text-gray-500" />
          <span className="text-sm font-medium text-gray-700">Vloot status</span>
          <span className="text-sm text-gray-400">{operationeel}/{totaal} operationeel op deze locatie</span>
        </div>
        <AccuBalk aanwezig={operationeel} totaal={totaal} />
      </div>

      {voertuigen.length === 0 && (
        <div className="py-12 text-center text-sm text-gray-400 border-2 border-dashed border-gray-100 rounded-xl">
          Geen voertuigen gekoppeld aan deze locatie.
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
        {voertuigen.map((v) => (
          <div key={v.kenteken} className="bg-white border border-gray-200 rounded-xl p-3 hover:border-primary/40 hover:shadow-sm transition-all group">
            <button onClick={() => setSelectedVoertuig(v)} className="w-full text-left">
              <div className="w-full h-16 rounded-lg mb-2.5 flex items-center justify-center" style={{ backgroundColor: (v.kleur || '#999999') + '20' }}>
                <Bike className="w-8 h-8" style={{ color: v.kleur || '#999999' }} />
              </div>
              <p className="text-xs font-semibold text-gray-800 text-center leading-tight">{v.kenteken}</p>
              <span className={`mt-1.5 block text-center px-1.5 py-0.5 rounded text-[10px] font-medium ${statusKleur[v.object_status] ?? 'bg-gray-100 text-gray-600'}`}>
                {v.object_status}
              </span>
            </button>
            <button
              onClick={() => setVerledenKenteken(v.kenteken)}
              className="mt-2 w-full text-[10px] text-primary font-medium py-1 rounded-lg hover:bg-primary/5 transition-colors"
            >
              Verleden
            </button>
          </div>
        ))}
      </div>

      {selectedVoertuig && (
        <UpdateStatusModal
          voertuig={selectedVoertuig}
          onClose={() => setSelectedVoertuig(null)}
          onSuccess={() => { setSelectedVoertuig(null); onUpdate(); }}
        />
      )}
      {verledenKenteken && (
        <VoertuigVerledenModal kenteken={verledenKenteken} onClose={() => setVerledenKenteken(null)} />
      )}
    </div>
  );
}

function UpdateStatusModal({ voertuig, onClose, onSuccess }: { voertuig: any; onClose: () => void; onSuccess: () => void }) {
  const [bezig, setBezig] = useState(false);
  const statussen = ['Operationeel', 'Reparatie op locatie', 'Reparatie in loods', 'In loods'];

  async function updateStatus(nw: string) {
    setBezig(true);
    const { error } = await supabase
      .from('voertuigen')
      .update({ object_status: nw })
      .eq('id', voertuig.id);
    
    if (error) alert('Update mislukt: ' + error.message);
    else onSuccess();
    setBezig(false);
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden">
        <div className="p-6 border-b border-gray-100">
          <h3 className="text-lg font-bold text-gray-900">Status wijzigen</h3>
          <p className="text-sm text-gray-500">{voertuig.kenteken}</p>
        </div>
        <div className="p-4 space-y-2">
          {statussen.map((s) => (
            <button
              key={s}
              disabled={bezig}
              onClick={() => updateStatus(s)}
              className={`w-full p-3 text-left rounded-xl border transition-all flex items-center justify-between group
                ${voertuig.object_status === s 
                  ? 'border-primary bg-primary/5 text-primary font-semibold' 
                  : 'border-gray-100 hover:border-gray-300 text-gray-700'}`}
            >
              <span>{s}</span>
              {voertuig.object_status === s && <CheckCircle2 className="w-4 h-4" />}
            </button>
          ))}
        </div>
        <div className="p-4 bg-gray-50 border-t border-gray-100 flex justify-end">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-600">Sluiten</button>
        </div>
      </div>
    </div>
  );
}

/* ── Tab: Opdrachten ───────────────────────────────────────── */
function TabOpdrachten({ opdrachten, monteurMap, onderhoudData, relatieNaam }: {
  opdrachten: any[];
  monteurMap: Record<string, string>;
  onderhoudData: any[];
  relatieNaam: string;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<any | null>(null);

  function fmtDatum(d: string | null) {
    if (!d) return null;
    return new Date(d + (d.length === 10 ? 'T12:00:00' : '')).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">{opdrachten.length} opdrachten in totaal</p>
        <button
          onClick={() => router.push(`/planning?locatie=${encodeURIComponent(relatieNaam)}`)}
          className="flex items-center gap-2 px-3 py-2 bg-[#F3A713] text-[#1A1A1A] text-sm font-semibold rounded-lg hover:bg-[#D4900E] transition-colors"
        >
          <Plus className="w-4 h-4" />
          Opdracht aanmaken
        </button>
      </div>
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50/60">
              <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Opdrachtnummer</th>
              <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Type</th>
              <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Datum opdracht</th>
              <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Monteur</th>
              <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {opdrachten.length === 0 && (
              <tr>
                <td colSpan={5} className="py-8 text-center text-gray-400">Nog geen opdrachten voor deze locatie.</td>
              </tr>
            )}
            {opdrachten.map((op) => (
              <tr key={op.id} onClick={() => setSelected(op)} className="hover:bg-gray-50/60 cursor-pointer">
                <td className="px-4 py-3 font-mono text-xs text-gray-600">{op.id}</td>
                <td className="px-4 py-3">
                  <span className="flex items-center gap-1.5">
                    <Wrench className="w-3.5 h-3.5 text-gray-400" />
                    {op.type}
                  </span>
                </td>
                <td className="px-4 py-3 text-xs">
                  {op.datum
                    ? <span className="text-blue-600 font-medium">{fmtDatum(op.datum)}</span>
                    : <span className="text-gray-300 italic">Nog niet ingepland</span>}
                </td>
                <td className="px-4 py-3 text-gray-600 text-xs">
                  {op.monteur_id
                    ? (monteurMap[op.monteur_id] ?? op.monteur_id)
                    : <span className="text-gray-300 italic">Niet toegewezen</span>}
                </td>
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

      {selected && (
        <OpdrachDetailModal
          opdracht={selected}
          monteurMap={monteurMap}
          onderdelen={onderhoudData.filter((oo) => oo.opdracht_id === selected.id)}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}

/* ── Opdracht detail modal ─────────────────────────────────── */
function OpdrachDetailModal({ opdracht, monteurMap, onderdelen, onClose }: {
  opdracht: any;
  monteurMap: Record<string, string>;
  onderdelen: any[];
  onClose: () => void;
}) {
  const fmtD = (d: string | null) => d
    ? new Date(d + (d.length === 10 ? 'T12:00:00' : '')).toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' })
    : null;

  const typeLabels: Record<string, string> = {
    onderhoud: 'Onderhoud', reparatie: 'Reparatie', accu: 'Accu',
    plaatsen: 'Plaatsen', terughalen: 'Terughalen', evaluatie: 'Evaluatie',
    voertuigruil: 'Voertuigruil', pechhulp: 'Pechhulp',
  };

  const totaalKosten = onderdelen.reduce((sum, oo) => {
    const prijs = (oo.onderdelen as any)?.prijs ?? null;
    return prijs != null ? sum + prijs * (oo.aantal ?? 1) : sum;
  }, 0);
  const heeftKosten = onderdelen.some((oo) => (oo.onderdelen as any)?.prijs != null);

  const urgentieKleur: Record<string, string> = {
    laag: 'bg-gray-100 text-gray-600',
    normaal: 'bg-blue-50 text-blue-700',
    hoog: 'bg-orange-100 text-orange-700',
    spoed: 'bg-red-100 text-red-700',
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-100">
          <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
            <Wrench className="w-4 h-4 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-gray-900 text-sm">{typeLabels[opdracht.type] ?? opdracht.type}</p>
            <p className="text-xs text-gray-400 font-mono">{opdracht.id}</p>
          </div>
          <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${opdrachtStatusKleur[opdracht.status] ?? 'bg-gray-100 text-gray-600'}`}>
            {opdracht.status}
          </span>
          <button onClick={onClose} className="ml-2 p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 px-6 py-5 space-y-5">
          {/* Tijdlijn */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Aangemaakt', waarde: fmtD(opdracht.created_at) },
              { label: 'Gepland op', waarde: fmtD(opdracht.datum) ?? 'Niet ingepland' },
              { label: 'Afgerond op', waarde: fmtD(opdracht.afgerond_op) ?? '—' },
            ].map((item) => (
              <div key={item.label} className="bg-gray-50 rounded-xl p-3">
                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-0.5">{item.label}</p>
                <p className="text-sm font-semibold text-gray-800">{item.waarde}</p>
              </div>
            ))}
          </div>

          {/* Details rij */}
          <div className="grid grid-cols-2 gap-4 text-sm">
            <DetailRij label="Monteur">
              {opdracht.monteur_id
                ? (monteurMap[opdracht.monteur_id] ?? opdracht.monteur_id)
                : <span className="text-gray-400 italic">Niet toegewezen</span>}
            </DetailRij>
            <DetailRij label="Locatie">{opdracht.locatie || '—'}</DetailRij>
            {opdracht.urgentie && (
              <DetailRij label="Urgentie">
                <span className={`px-2 py-0.5 rounded text-xs font-semibold ${urgentieKleur[opdracht.urgentie] ?? 'bg-gray-100 text-gray-600'}`}>
                  {opdracht.urgentie}
                </span>
              </DetailRij>
            )}
            {opdracht.deadline && (
              <DetailRij label="Deadline">{fmtD(opdracht.deadline)}</DetailRij>
            )}
            {opdracht.km_gereden != null && (
              <DetailRij label="Gereden">{opdracht.km_gereden} km</DetailRij>
            )}
          </div>

          {/* Voertuigen */}
          {opdracht.voertuigen && opdracht.voertuigen.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Voertuigen</p>
              <div className="flex flex-wrap gap-1.5">
                {opdracht.voertuigen.map((k: string) => (
                  <span key={k} className="px-2.5 py-1 bg-gray-100 rounded-lg text-xs font-mono font-semibold text-gray-700">{k}</span>
                ))}
              </div>
            </div>
          )}

          {/* Notitie */}
          {opdracht.notitie && (
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Notitie</p>
              <p className="text-sm text-gray-700 bg-gray-50 rounded-xl p-3 whitespace-pre-wrap">{opdracht.notitie}</p>
            </div>
          )}

          {/* Onderdelen */}
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
              Gebruikte onderdelen {onderdelen.length > 0 && `(${onderdelen.length})`}
            </p>
            {onderdelen.length === 0 ? (
              <p className="text-sm text-gray-400 italic">Geen onderdelen geregistreerd.</p>
            ) : (
              <div className="border border-gray-100 rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-100">
                      <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500">Onderdeel</th>
                      <th className="px-3 py-2 text-center text-xs font-semibold text-gray-500">Aantal</th>
                      <th className="px-3 py-2 text-right text-xs font-semibold text-gray-500">Stukprijs</th>
                      <th className="px-3 py-2 text-right text-xs font-semibold text-gray-500">Totaal</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {onderdelen.map((oo, i) => {
                      const naam = (oo.onderdelen as any)?.naam ?? '—';
                      const prijs = (oo.onderdelen as any)?.prijs ?? null;
                      const aantal = oo.aantal ?? 1;
                      return (
                        <tr key={i} className="hover:bg-gray-50/50">
                          <td className="px-3 py-2.5 font-medium text-gray-800">{naam}</td>
                          <td className="px-3 py-2.5 text-center text-gray-600">{aantal}×</td>
                          <td className="px-3 py-2.5 text-right text-gray-500">
                            {prijs != null ? `€ ${prijs.toFixed(2)}` : '—'}
                          </td>
                          <td className="px-3 py-2.5 text-right font-semibold text-gray-800">
                            {prijs != null ? `€ ${(prijs * aantal).toFixed(2)}` : '—'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  {heeftKosten && (
                    <tfoot>
                      <tr className="border-t border-gray-200 bg-gray-50">
                        <td colSpan={3} className="px-3 py-2.5 text-sm font-bold text-gray-700">Totaal materiaal</td>
                        <td className="px-3 py-2.5 text-right font-black text-primary">€ {totaalKosten.toFixed(2)}</td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 bg-gray-50/60 flex justify-end">
          <button onClick={onClose} className="px-5 py-2 bg-white border border-gray-200 text-gray-700 text-sm font-medium rounded-xl hover:bg-gray-50 transition-colors">
            Sluiten
          </button>
        </div>
      </div>
    </div>
  );
}

function DetailRij({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs text-gray-400 mb-0.5">{label}</p>
      <p className="text-sm font-medium text-gray-800">{children}</p>
    </div>
  );
}

/* ── Tab: Evaluatie ────────────────────────────────────────── */
function TabEvaluatie({ relatieId, initNotitie }: { relatieId: string; initNotitie: string }) {
  const [notitie, setNotitie] = useState(initNotitie);
  const [bezig, setBezig] = useState(false);
  const [opgeslagen, setOpgeslagen] = useState(false);

  async function opslaan() {
    setBezig(true);
    await supabase.from('relaties').update({ notitie }).eq('id', relatieId);
    setBezig(false);
    setOpgeslagen(true);
    setTimeout(() => setOpgeslagen(false), 2500);
  }

  return (
    <div className="max-w-2xl">
      <p className="text-sm text-gray-500 mb-3">Vrij tekstveld voor notities en evaluaties over deze locatie.</p>
      <textarea
        value={notitie}
        onChange={(e) => { setNotitie(e.target.value); setOpgeslagen(false); }}
        className="w-full h-48 p-4 text-sm border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary resize-none"
        placeholder="Notities over deze locatie..."
      />
      <div className="flex items-center gap-3 mt-3">
        <button
          onClick={opslaan}
          disabled={bezig}
          className="flex items-center gap-2 px-5 py-2 bg-primary text-white text-sm font-medium rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-60"
        >
          {bezig ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
          {bezig ? 'Opslaan...' : 'Opslaan'}
        </button>
        {opgeslagen && (
          <span className="flex items-center gap-1.5 text-sm text-green-600 font-medium">
            <CheckCircle2 className="w-4 h-4" />
            Opgeslagen
          </span>
        )}
      </div>
    </div>
  );
}

/* ── Tab: Promotiemateriaal ────────────────────────────────── */
function TabPromotiemateriaal({ relatieId }: { relatieId: string }) {
  const [items, setItems] = useState<{ id: string; naam: string; aantal: number }[]>([]);
  const [laden, setLaden] = useState(true);
  const [nieuw, setNieuw] = useState('');
  const [editId, setEditId] = useState<string | null>(null);
  const [editAantal, setEditAantal] = useState('');
  const [bezig, setBezig] = useState(false);

  useEffect(() => { laad(); }, [relatieId]);

  async function laad() {
    setLaden(true);
    const { data } = await supabase.from('promotiemateriaal').select('id, naam, aantal').eq('relatie_id', relatieId).order('created_at');
    setItems((data ?? []) as { id: string; naam: string; aantal: number }[]);
    setLaden(false);
  }

  async function voegToe() {
    const naam = nieuw.trim();
    if (!naam) return;
    setBezig(true);
    const { error } = await supabase.from('promotiemateriaal').insert([{ relatie_id: relatieId, naam, aantal: 0 }]);
    if (error) alert('Toevoegen mislukt: ' + error.message);
    else { setNieuw(''); await laad(); }
    setBezig(false);
  }

  async function slaAantalOp(id: string) {
    const aantal = parseInt(editAantal, 10);
    if (isNaN(aantal) || aantal < 0) return;
    await supabase.from('promotiemateriaal').update({ aantal }).eq('id', id);
    setEditId(null);
    await laad();
  }

  async function verwijder(id: string) {
    if (!confirm('Materiaal verwijderen?')) return;
    await supabase.from('promotiemateriaal').delete().eq('id', id);
    await laad();
  }

  if (laden) return <div className="py-8 text-center text-sm text-gray-400">Laden...</div>;

  return (
    <div className="max-w-lg space-y-3">
      <p className="text-sm text-gray-500">Promotiemateriaal aanwezig bij deze consignatieklant.</p>
      {items.length === 0 && (
        <div className="py-8 text-center text-sm text-gray-400 border-2 border-dashed border-gray-100 rounded-xl">
          Nog geen materiaal geregistreerd.
        </div>
      )}
      {items.map((item) => (
        <div key={item.id} className="bg-white border border-gray-200 rounded-xl px-4 py-3 flex items-center gap-4">
          {item.aantal > 0
            ? <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0" />
            : <AlertCircle className="w-5 h-5 text-gray-300 flex-shrink-0" />}
          <span className="flex-1 text-sm font-medium text-gray-800">{item.naam}</span>
          {editId === item.id ? (
            <div className="flex items-center gap-2">
              <input
                type="number"
                min="0"
                value={editAantal}
                onChange={e => setEditAantal(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') slaAantalOp(item.id); if (e.key === 'Escape') setEditId(null); }}
                className="w-16 px-2 py-1 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 text-center"
                autoFocus
              />
              <button onClick={() => slaAantalOp(item.id)} className="p-1 text-green-600 hover:text-green-700">
                <CheckCircle2 className="w-4 h-4" />
              </button>
              <button onClick={() => setEditId(null)} className="p-1 text-gray-400 hover:text-gray-600">
                <X className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <button
                onClick={() => { setEditId(item.id); setEditAantal(String(item.aantal)); }}
                className="text-sm text-gray-500 hover:text-gray-800 font-medium px-2 py-0.5 rounded hover:bg-gray-50"
              >
                {item.aantal}×
              </button>
              <button onClick={() => verwijder(item.id)} className="p-1 text-gray-300 hover:text-red-500 transition-colors">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      ))}
      <div className="flex gap-2">
        <input
          type="text"
          value={nieuw}
          onChange={e => setNieuw(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') voegToe(); }}
          placeholder="Naam materiaal..."
          className="flex-1 px-3 py-2 text-sm border border-dashed border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
        />
        <button
          onClick={voegToe}
          disabled={bezig || !nieuw.trim()}
          className="flex items-center gap-1.5 px-3 py-2 border border-dashed border-gray-300 text-gray-500 text-sm rounded-lg hover:border-primary hover:text-primary transition-colors disabled:opacity-40"
        >
          <Plus className="w-4 h-4" />
          Toevoegen
        </button>
      </div>
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

function FormInvoer({ label, value, onChange, type = 'text', placeholder = '' }: {
  label: string; value: string; onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  type?: string; placeholder?: string;
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-500 mb-1">{label}</label>
      <input
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
      />
    </div>
  );
}
