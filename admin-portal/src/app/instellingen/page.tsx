'use client';

import { useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { supabase } from '@/lib/supabase';
import { Save, Check, Database, Key, Bell, Info, Loader2, Eye, EyeOff } from 'lucide-react';

type Sectie = 'systeem' | 'api' | 'notificaties' | 'info';

export default function InstellingenPage() {
  const [actief, setActief] = useState<Sectie>('systeem');

  return (
    <DashboardLayout title="Instellingen">
      <div className="flex gap-6 h-full">
        {/* Zijmenu */}
        <aside className="w-52 flex-shrink-0">
          <nav className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            {([
              { id: 'systeem', label: 'Systeem', icon: Database },
              { id: 'api', label: 'API & Integraties', icon: Key },
              { id: 'notificaties', label: 'Notificaties', icon: Bell },
              { id: 'info', label: 'Over', icon: Info },
            ] as { id: Sectie; label: string; icon: React.ElementType }[]).map((item) => (
              <button
                key={item.id}
                onClick={() => setActief(item.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-medium text-left transition-colors border-b border-gray-100 last:border-0
                  ${actief === item.id ? 'bg-primary/5 text-primary font-semibold' : 'text-gray-600 hover:bg-gray-50'}`}
              >
                <item.icon className="w-4 h-4 flex-shrink-0" />
                {item.label}
              </button>
            ))}
          </nav>
        </aside>

        {/* Inhoud */}
        <div className="flex-1 min-w-0">
          {actief === 'systeem' && <SectieSysteme />}
          {actief === 'api' && <SectieApi />}
          {actief === 'notificaties' && <SectieNotificaties />}
          {actief === 'info' && <SectieInfo />}
        </div>
      </div>
    </DashboardLayout>
  );
}

/* ── Sectie: Systeem ────────────────────────────────────────── */
function SectieSysteme() {
  const [form, setForm] = useState({
    bedrijfsnaam: 'EuroWheelz',
    afzender_email: 'info@eurowheelz.nl',
    standaard_prioriteit: '3',
    auto_archiveer_dagen: '30',
  });
  const [opgeslagen, setOpgeslagen] = useState(false);
  const [bezig, setBezig] = useState(false);

  async function opslaan() {
    setBezig(true);
    await new Promise((r) => setTimeout(r, 400));
    setBezig(false);
    setOpgeslagen(true);
    setTimeout(() => setOpgeslagen(false), 2500);
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="px-6 py-5 border-b border-gray-100">
        <h2 className="text-base font-semibold text-gray-900">Systeeminstellingen</h2>
        <p className="text-sm text-gray-400 mt-0.5">Algemene instellingen voor het plansysteem</p>
      </div>
      <div className="p-6 space-y-5">
        <Veld label="Bedrijfsnaam" waarde={form.bedrijfsnaam} onChange={(v) => setForm({ ...form, bedrijfsnaam: v })} />
        <Veld label="Afzender e-mailadres" type="email" waarde={form.afzender_email} onChange={(v) => setForm({ ...form, afzender_email: v })}
          hint="Wordt gebruikt bij werkbonnen en afspraakbevestigingen" />
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Standaard prioriteit nieuwe opdrachten</label>
          <select
            value={form.standaard_prioriteit}
            onChange={(e) => setForm({ ...form, standaard_prioriteit: e.target.value })}
            className="w-full max-w-xs px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 appearance-none"
          >
            <option value="1">P1 — Hoog</option>
            <option value="2">P2 — Middel</option>
            <option value="3">P3 — Laag</option>
          </select>
        </div>
        <Veld label="Verwijderde opdrachten archiveren na (dagen)" type="number" waarde={form.auto_archiveer_dagen}
          onChange={(v) => setForm({ ...form, auto_archiveer_dagen: v })}
          hint="Opdrachten in de prullenbak worden na dit aantal dagen definitief verwijderd" />
      </div>
      <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex items-center justify-end gap-3">
        <button
          onClick={opslaan}
          disabled={bezig}
          className="flex items-center gap-2 px-5 py-2 bg-primary text-white text-sm font-bold rounded-lg hover:bg-primary/90 disabled:opacity-60 transition-colors"
        >
          {bezig ? <Loader2 className="w-4 h-4 animate-spin" /> : opgeslagen ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
          {opgeslagen ? 'Opgeslagen!' : 'Opslaan'}
        </button>
      </div>
    </div>
  );
}

/* ── Sectie: API & Integraties ─────────────────────────────── */
function SectieApi() {
  const [toonUrl, setToonUrl] = useState(false);
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'https://cqtpscaefqxntopxyrnr.supabase.co';

  async function testVerbinding() {
    const { error } = await supabase.from('relaties').select('id').limit(1);
    if (error) alert('Verbinding mislukt: ' + error.message);
    else alert('Verbinding met Supabase is actief.');
  }

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-6 py-5 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-900">Supabase database</h2>
          <p className="text-sm text-gray-400 mt-0.5">Verbindingsinstellingen voor de backend database</p>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Database URL</label>
            <div className="flex items-center gap-2">
              <input
                type={toonUrl ? 'text' : 'password'}
                readOnly
                value={supabaseUrl}
                className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg bg-gray-50 font-mono text-gray-500 focus:outline-none"
              />
              <button onClick={() => setToonUrl(!toonUrl)} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                {toonUrl ? <EyeOff className="w-4 h-4 text-gray-400" /> : <Eye className="w-4 h-4 text-gray-400" />}
              </button>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Status</label>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 px-3 py-1.5 bg-green-50 text-green-700 rounded-lg text-sm font-medium">
                <span className="w-2 h-2 rounded-full bg-green-500" />
                Verbonden
              </div>
              <button onClick={testVerbinding} className="px-3 py-1.5 border border-gray-200 text-gray-600 text-sm rounded-lg hover:bg-gray-50 transition-colors">
                Verbinding testen
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-6 py-5 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-900">Kenteken API</h2>
          <p className="text-sm text-gray-400 mt-0.5">RDW kenteken detectie voor de monteur-app</p>
        </div>
        <div className="p-6">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 text-blue-700 rounded-lg text-sm font-medium w-fit">
            <span className="w-2 h-2 rounded-full bg-blue-500" />
            Opendata RDW — geen API-sleutel vereist
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Sectie: Notificaties ──────────────────────────────────── */
function SectieNotificaties() {
  const [instellingen, setInstellingen] = useState({
    mail_werkbon: true,
    mail_afspraak: true,
    mail_nieuwsbrief: false,
    push_nieuwe_opdracht: true,
    push_status_wijziging: true,
  });
  const [opgeslagen, setOpgeslagen] = useState(false);

  async function opslaan() {
    await new Promise((r) => setTimeout(r, 300));
    setOpgeslagen(true);
    setTimeout(() => setOpgeslagen(false), 2500);
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="px-6 py-5 border-b border-gray-100">
        <h2 className="text-base font-semibold text-gray-900">Notificatie-instellingen</h2>
        <p className="text-sm text-gray-400 mt-0.5">Standaard instellingen voor e-mail en pushberichten</p>
      </div>
      <div className="p-6 space-y-6">
        <div>
          <p className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">E-mail standaarden</p>
          <div className="space-y-3">
            <Toggle label="Stuur digitale werkbon na afronding" aan={instellingen.mail_werkbon}
              onChange={(v) => setInstellingen({ ...instellingen, mail_werkbon: v })} />
            <Toggle label="Stuur afspraakbevestiging bij inplannen" aan={instellingen.mail_afspraak}
              onChange={(v) => setInstellingen({ ...instellingen, mail_afspraak: v })} />
            <Toggle label="Nieuwsbrief versturen aan relaties" aan={instellingen.mail_nieuwsbrief}
              onChange={(v) => setInstellingen({ ...instellingen, mail_nieuwsbrief: v })} />
          </div>
        </div>
        <div>
          <p className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Monteur app meldingen</p>
          <div className="space-y-3">
            <Toggle label="Melding bij nieuwe opdracht" aan={instellingen.push_nieuwe_opdracht}
              onChange={(v) => setInstellingen({ ...instellingen, push_nieuwe_opdracht: v })} />
            <Toggle label="Melding bij statuswijziging" aan={instellingen.push_status_wijziging}
              onChange={(v) => setInstellingen({ ...instellingen, push_status_wijziging: v })} />
          </div>
        </div>
      </div>
      <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex justify-end">
        <button onClick={opslaan}
          className="flex items-center gap-2 px-5 py-2 bg-primary text-white text-sm font-bold rounded-lg hover:bg-primary/90 transition-colors">
          {opgeslagen ? <><Check className="w-4 h-4" /> Opgeslagen!</> : <><Save className="w-4 h-4" /> Opslaan</>}
        </button>
      </div>
    </div>
  );
}

/* ── Sectie: Info ───────────────────────────────────────────── */
function SectieInfo() {
  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="px-6 py-5 border-b border-gray-100">
        <h2 className="text-base font-semibold text-gray-900">Over EuroWheelz Plansysteem</h2>
      </div>
      <div className="p-6 space-y-5 text-sm text-gray-600">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center font-black text-xl flex-shrink-0"
            style={{ backgroundColor: '#F3A713', color: '#345022' }}>
            EW
          </div>
          <div>
            <p className="text-lg font-bold text-gray-900">EuroWheelz Plansysteem</p>
            <p className="text-gray-400">Versie 1.0 · Intern beheer</p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          {[
            { label: 'Gebouwd met', waarde: 'Next.js 15 + Supabase' },
            { label: 'Database', waarde: 'PostgreSQL (Supabase)' },
            { label: 'Monteur app', waarde: 'Expo (React Native)' },
            { label: 'Hosting', waarde: 'Vercel / Supabase Cloud' },
          ].map((r) => (
            <div key={r.label} className="bg-gray-50 rounded-lg px-4 py-3">
              <p className="text-xs text-gray-400 mb-0.5">{r.label}</p>
              <p className="font-semibold text-gray-800">{r.waarde}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ── Herbruikbare componenten ─────────────────────────────── */
function Veld({ label, waarde, onChange, type = 'text', hint }: { label: string; waarde: string; onChange: (v: string) => void; type?: string; hint?: string }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1.5">{label}</label>
      <input
        type={type}
        value={waarde}
        onChange={(e) => onChange(e.target.value)}
        className="w-full max-w-md px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20"
      />
      {hint && <p className="text-xs text-gray-400 mt-1">{hint}</p>}
    </div>
  );
}

function Toggle({ label, aan, onChange }: { label: string; aan: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-3 cursor-pointer group">
      <div
        onClick={() => onChange(!aan)}
        className={`relative w-10 h-5 rounded-full transition-colors flex-shrink-0 ${aan ? 'bg-primary' : 'bg-gray-200'}`}
      >
        <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${aan ? 'translate-x-5' : 'translate-x-0.5'}`} />
      </div>
      <span className="text-sm text-gray-700 group-hover:text-gray-900">{label}</span>
    </label>
  );
}
