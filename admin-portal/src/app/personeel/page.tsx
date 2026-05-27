'use client';

import { useState, useEffect } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { supabase, type DbMonteur } from '@/lib/supabase';
import {
  Plus, Phone, Mail, Truck, Home, X, Trash2, AlertTriangle,
  CheckCircle, Pencil, Loader2,
} from 'lucide-react';

/* ─── Bus-capaciteit opties ─────────────────────────────── */

const BUS_OPTIES = [4, 8, 12];

function initials(m: DbMonteur) {
  return `${m.voornaam[0] ?? ''}${m.naam[0] ?? ''}`.toUpperCase();
}

function volledigeNaam(m: DbMonteur) {
  return `${m.voornaam} ${m.naam}`;
}

/* ─── Pagina ─────────────────────────────────────────────── */

export default function PersoneelPage() {
  const [monteurs, setMonteurs] = useState<DbMonteur[]>([]);
  const [laden, setLaden] = useState(true);
  const [geselecteerd, setGeselecteerd] = useState<DbMonteur | null>(null);
  const [showNieuw, setShowNieuw] = useState(false);
  const [bewerkId, setBewerkId] = useState<string | null>(null);
  const [succesBericht, setSuccesBericht] = useState('');
  const [foutBericht, setFoutBericht] = useState('');

  useEffect(() => { laad(); }, []);

  async function laad() {
    setLaden(true);
    const { data } = await supabase.from('monteurs').select('*').order('naam');
    setMonteurs((data ?? []) as DbMonteur[]);
    setLaden(false);
  }

  function toonSucces(t: string) { setSuccesBericht(t); setTimeout(() => setSuccesBericht(''), 4000); }
  function toonFout(t: string) { setFoutBericht(t); setTimeout(() => setFoutBericht(''), 6000); }

  async function verwijder(m: DbMonteur) {
    const { error } = await supabase.from('monteurs').delete().eq('id', m.id);
    if (error) { toonFout(error.message); return; }
    setMonteurs((p) => p.filter((x) => x.id !== m.id));
    if (geselecteerd?.id === m.id) setGeselecteerd(null);
    toonSucces(`${volledigeNaam(m)} verwijderd`);
  }

  const bewerkMonteur = bewerkId ? monteurs.find((m) => m.id === bewerkId) ?? null : null;

  return (
    <DashboardLayout
      title="Personeel"
      actions={
        <button
          onClick={() => setShowNieuw(true)}
          className="flex items-center gap-2 px-4 py-2 bg-[#F3A713] text-[#1A1A1A] rounded-lg text-sm font-semibold shadow-sm hover:bg-[#D4900E] active:scale-95 transition-all"
        >
          <Plus className="w-4 h-4" />
          Monteur toevoegen
        </button>
      }
    >
      {/* Toasts */}
      {succesBericht && (
        <div className="fixed top-4 right-4 z-50 flex items-center gap-2 bg-green-600 text-white px-4 py-3 rounded-xl shadow-lg text-sm font-medium">
          <CheckCircle className="w-4 h-4" /> {succesBericht}
        </div>
      )}
      {foutBericht && (
        <div className="fixed top-4 right-4 z-50 flex items-center gap-2 bg-red-600 text-white px-4 py-3 rounded-xl shadow-lg text-sm font-medium">
          <AlertTriangle className="w-4 h-4" /> {foutBericht}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Lijst */}
        <div className="lg:col-span-2 space-y-2">
          {laden ? (
            <div className="flex items-center justify-center py-16 text-gray-400 gap-2">
              <Loader2 className="w-5 h-5 animate-spin" /> Laden...
            </div>
          ) : monteurs.length === 0 ? (
            <div className="bg-gray-50 border border-dashed border-gray-200 rounded-xl py-16 text-center">
              <Truck className="w-8 h-8 text-gray-300 mx-auto mb-3" />
              <p className="text-sm text-gray-500 font-medium">Nog geen monteurs aangemaakt</p>
              <p className="text-xs text-gray-400 mt-1">Klik op &quot;Monteur toevoegen&quot; om te beginnen</p>
            </div>
          ) : monteurs.map((m) => (
            <MonteurKaart
              key={m.id}
              monteur={m}
              actief={geselecteerd?.id === m.id}
              onClick={() => setGeselecteerd(geselecteerd?.id === m.id ? null : m)}
            />
          ))}
        </div>

        {/* Detail paneel */}
        <div className="space-y-3">
          {geselecteerd ? (
            <div className="bg-white rounded-xl border border-gray-200 p-5 sticky top-4">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary/10 text-primary font-bold flex items-center justify-center text-sm">
                    {initials(geselecteerd)}
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900">{volledigeNaam(geselecteerd)}</p>
                    <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-blue-50 text-blue-700">Monteur</span>
                  </div>
                </div>
                <button onClick={() => setGeselecteerd(null)} className="p-1 rounded hover:bg-gray-100 text-gray-400 transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-3 text-sm">
                <div className="flex items-center gap-2.5 text-gray-700">
                  <Mail className="w-4 h-4 text-gray-400 flex-shrink-0" />
                  <span className="truncate">{geselecteerd.email}</span>
                </div>
                <div className="flex items-center gap-2.5 text-gray-700">
                  <Truck className="w-4 h-4 text-gray-400 flex-shrink-0" />
                  <span>Bus: {geselecteerd.bus_capaciteit} voertuigen capaciteit</span>
                </div>
                <div className="flex items-center gap-2.5 text-gray-700">
                  <Home className="w-4 h-4 text-gray-400 flex-shrink-0" />
                  <span>
                    Vanuit huis starten:{' '}
                    <span className={geselecteerd.van_huis ? 'text-green-600 font-medium' : 'text-gray-400'}>
                      {geselecteerd.van_huis ? 'Ja' : 'Nee'}
                    </span>
                  </span>
                </div>
              </div>

              {/* Bus capaciteit visueel */}
              <div className="mt-4 pt-4 border-t border-gray-100">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Buscapaciteit</p>
                <div className="flex gap-1">
                  {Array.from({ length: geselecteerd.bus_capaciteit }, (_, i) => (
                    <div key={i} className="w-5 h-5 rounded bg-primary/20 border border-primary/30 flex items-center justify-center">
                      <Truck className="w-2.5 h-2.5 text-primary" />
                    </div>
                  ))}
                </div>
                <p className="text-xs text-gray-400 mt-1.5">{geselecteerd.bus_capaciteit} e-choppers per rit</p>
              </div>

              <div className="mt-4 pt-4 border-t border-gray-100 space-y-2">
                <button
                  onClick={() => setBewerkId(geselecteerd.id)}
                  className="w-full px-3 py-2 bg-primary text-white text-sm font-medium rounded-lg hover:bg-primary/90 transition-colors flex items-center justify-center gap-2"
                >
                  <Pencil className="w-3.5 h-3.5" /> Gegevens aanpassen
                </button>
                <VerwijderKnop monteur={geselecteerd} onVerwijderd={verwijder} />
              </div>
            </div>
          ) : (
            <div className="bg-gray-50 border border-dashed border-gray-200 rounded-xl p-8 text-center">
              <p className="text-sm text-gray-400">Selecteer een monteur voor details</p>
            </div>
          )}
        </div>
      </div>

      {/* Nieuw modal */}
      {showNieuw && (
        <MonteurModal
          onClose={() => setShowNieuw(false)}
          onOpgeslagen={(nieuw) => {
            setMonteurs((p) => [...p, nieuw].sort((a, b) => a.naam.localeCompare(b.naam)));
            setShowNieuw(false);
            toonSucces(`${volledigeNaam(nieuw)} aangemaakt`);
          }}
        />
      )}

      {/* Bewerk modal */}
      {bewerkMonteur && (
        <MonteurModal
          bestaand={bewerkMonteur}
          onClose={() => setBewerkId(null)}
          onOpgeslagen={(bijgewerkt) => {
            setMonteurs((p) => p.map((m) => m.id === bijgewerkt.id ? bijgewerkt : m));
            if (geselecteerd?.id === bijgewerkt.id) setGeselecteerd(bijgewerkt);
            setBewerkId(null);
            toonSucces(`${volledigeNaam(bijgewerkt)} opgeslagen`);
          }}
        />
      )}
    </DashboardLayout>
  );
}

/* ─── Monteur kaart ─────────────────────────────────────── */

function MonteurKaart({ monteur, actief, onClick }: { monteur: DbMonteur; actief: boolean; onClick: () => void }) {
  return (
    <div
      onClick={onClick}
      className={`bg-white border rounded-xl p-4 cursor-pointer transition-all hover:shadow-sm ${
        actief ? 'border-primary/40 bg-primary/5 shadow-sm' : 'border-gray-200 hover:border-gray-300'
      }`}
    >
      <div className="flex items-center gap-3">
        <div className={`w-9 h-9 rounded-full font-bold text-sm flex items-center justify-center flex-shrink-0 ${
          actief ? 'bg-primary text-white' : 'bg-gray-100 text-gray-600'
        }`}>
          {initials(monteur)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="font-semibold text-gray-900 text-sm">{volledigeNaam(monteur)}</p>
            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-blue-50 text-blue-700">Monteur</span>
          </div>
          <div className="flex items-center gap-3 mt-0.5 text-xs text-gray-400">
            <span className="flex items-center gap-1"><Mail className="w-3 h-3" />{monteur.email}</span>
            <span className="flex items-center gap-1"><Truck className="w-3 h-3" />{monteur.bus_capaciteit}</span>
            {monteur.van_huis && <span className="flex items-center gap-1"><Home className="w-3 h-3 text-green-500" />Vanuit huis</span>}
          </div>
        </div>
        {/* Mini capaciteitsbar */}
        <div className="flex gap-0.5 flex-shrink-0">
          {Array.from({ length: monteur.bus_capaciteit }, (_, i) => (
            <div key={i} className="w-1.5 h-5 rounded-sm bg-primary/25" />
          ))}
        </div>
      </div>
    </div>
  );
}

/* ─── Verwijder knop ────────────────────────────────────── */

function VerwijderKnop({ monteur, onVerwijderd }: { monteur: DbMonteur; onVerwijderd: (m: DbMonteur) => void }) {
  const [bevestig, setBevestig] = useState(false);

  if (bevestig) {
    return (
      <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
        <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0" />
        <span className="text-xs text-red-700 font-medium flex-1">Monteur definitief verwijderen?</span>
        <button onClick={() => onVerwijderd(monteur)} className="px-2.5 py-1 bg-red-600 text-white text-xs font-bold rounded hover:bg-red-700">Ja</button>
        <button onClick={() => setBevestig(false)} className="px-2.5 py-1 bg-gray-200 text-gray-700 text-xs font-bold rounded hover:bg-gray-300">Nee</button>
      </div>
    );
  }

  return (
    <button
      onClick={() => setBevestig(true)}
      className="w-full px-3 py-2 border border-red-200 text-red-500 text-sm font-medium rounded-lg hover:bg-red-50 transition-colors flex items-center justify-center gap-2"
    >
      <Trash2 className="w-3.5 h-3.5" /> Verwijderen
    </button>
  );
}

/* ─── Monteur aanmaken / bewerken modal ─────────────────── */

function MonteurModal({ bestaand, onClose, onOpgeslagen }: {
  bestaand?: DbMonteur;
  onClose: () => void;
  onOpgeslagen: (m: DbMonteur) => void;
}) {
  const [voornaam, setVoornaam] = useState(bestaand?.voornaam ?? '');
  const [naam, setNaam] = useState(bestaand?.naam ?? '');
  const [email, setEmail] = useState(bestaand?.email ?? '');
  const [busCapaciteit, setBusCapaciteit] = useState(bestaand?.bus_capaciteit ?? 8);
  const [vanHuis, setVanHuis] = useState(bestaand?.van_huis ?? true);
  const [huisadres, setHuisadres] = useState(bestaand?.huisadres ?? '');
  const [huisCoords, setHuisCoords] = useState<{lat: number, lng: number} | null>(
    bestaand?.huisadres_lat && bestaand?.huisadres_lng
      ? {lat: bestaand.huisadres_lat, lng: bestaand.huisadres_lng}
      : null
  );
  const [geocodeBezig, setGeocodeBezig] = useState(false);
  const [bezig, setBezig] = useState(false);
  const [fout, setFout] = useState('');

  async function geocodeAdres(adres: string) {
    if (!adres.trim()) return;
    setGeocodeBezig(true);
    try {
      const q = encodeURIComponent(adres);
      const res = await fetch(`https://nominatim.openstreetmap.org/search?q=${q}&format=json&limit=1&countrycodes=nl,be,de,fr`, {
        headers: { 'Accept-Language': 'nl', 'User-Agent': 'EuroWheelzPlanner/1.0' },
      });
      const data = await res.json();
      if (data[0]) setHuisCoords({ lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) });
      else setFout('Adres niet gevonden — controleer het adres');
    } catch { setFout('Geocoding mislukt'); }
    setGeocodeBezig(false);
  }

  async function opslaan() {
    if (!voornaam.trim() || !naam.trim() || !email.trim()) {
      setFout('Vul voornaam, achternaam en e-mail in.'); return;
    }
    setFout(''); setBezig(true);

    // Auto-geocode huisadres als nog geen coords
    let lat = huisCoords?.lat ?? null;
    let lng = huisCoords?.lng ?? null;
    if (huisadres.trim() && (!lat || !lng)) {
      try {
        const q = encodeURIComponent(huisadres.trim());
        const res = await fetch(`https://nominatim.openstreetmap.org/search?q=${q}&format=json&limit=1`, {
          headers: { 'User-Agent': 'EuroWheelzPlanner/1.0' },
        });
        const data = await res.json();
        if (data[0]) { lat = parseFloat(data[0].lat); lng = parseFloat(data[0].lon); }
      } catch {}
    }

    const record = {
      voornaam: voornaam.trim(),
      naam: naam.trim(),
      email: email.trim().toLowerCase(),
      bus_capaciteit: busCapaciteit,
      van_huis: vanHuis,
      huisadres: huisadres.trim(),
      huisadres_lat: lat,
      huisadres_lng: lng,
    };

    if (bestaand) {
      const { error } = await supabase.from('monteurs').update(record).eq('id', bestaand.id);
      if (error) { setFout(error.message); setBezig(false); return; }
      onOpgeslagen({ ...bestaand, ...record });
    } else {
      const id = `m-${voornaam.trim().toLowerCase().replace(/\s+/g, '')}-${Date.now().toString(36)}`;
      const { error } = await supabase.from('monteurs').insert({ id, ...record });
      if (error) { setFout(error.message); setBezig(false); return; }
      onOpgeslagen({ id, ...record, created_at: new Date().toISOString() } as DbMonteur);
    }
    setBezig(false);
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-lg font-bold text-gray-900">
            {bestaand ? 'Monteur bewerken' : 'Nieuwe monteur'}
          </h2>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors">
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          {/* Naam */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Voornaam *</label>
              <input
                type="text"
                value={voornaam}
                onChange={(e) => setVoornaam(e.target.value)}
                placeholder="Jan"
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                autoFocus
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Achternaam *</label>
              <input
                type="text"
                value={naam}
                onChange={(e) => setNaam(e.target.value)}
                placeholder="Bakker"
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              />
            </div>
          </div>

          {/* Email */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">E-mailadres *</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="jan@eurowheelz.nl"
                className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              />
            </div>
          </div>

          {/* Bus capaciteit */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
              Buscapaciteit — hoeveel e-choppers past de bus?
            </label>
            <div className="flex gap-2">
              {BUS_OPTIES.map((cap) => (
                <button
                  key={cap}
                  type="button"
                  onClick={() => setBusCapaciteit(cap)}
                  className={`flex-1 py-3 rounded-xl border-2 font-bold text-sm transition-all flex flex-col items-center gap-1 ${
                    busCapaciteit === cap
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-gray-200 text-gray-600 hover:border-gray-300'
                  }`}
                >
                  <span className="text-xl">{cap}</span>
                  <div className="flex gap-0.5">
                    {Array.from({ length: cap }, (_, i) => (
                      <div key={i} className={`w-1.5 h-3 rounded-sm ${busCapaciteit === cap ? 'bg-primary' : 'bg-gray-200'}`} />
                    ))}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Huisadres */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
              Huisadres
              {huisCoords && <span className="ml-2 text-green-600 normal-case font-normal">✓ coördinaten bekend</span>}
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={huisadres}
                onChange={(e) => { setHuisadres(e.target.value); setHuisCoords(null); }}
                onBlur={(e) => { if (e.target.value.trim()) geocodeAdres(e.target.value); }}
                placeholder="Straatnaam 1, 1234 AB Stad"
                className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              />
              <button
                type="button"
                onClick={() => geocodeAdres(huisadres)}
                disabled={geocodeBezig || !huisadres.trim()}
                className="px-3 py-2 bg-gray-100 text-gray-600 text-xs font-semibold rounded-lg hover:bg-gray-200 disabled:opacity-50 transition-colors whitespace-nowrap"
              >
                {geocodeBezig ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Opzoeken'}
              </button>
            </div>
          </div>

          {/* Van huis */}
          <label className="flex items-start gap-3 p-3 border border-gray-200 rounded-xl cursor-pointer hover:border-gray-300 transition-colors">
            <input
              type="checkbox"
              checked={vanHuis}
              onChange={(e) => setVanHuis(e.target.checked)}
              className="w-4 h-4 accent-primary mt-0.5 flex-shrink-0"
            />
            <div>
              <p className="text-sm font-semibold text-gray-800 flex items-center gap-2">
                <Home className="w-4 h-4 text-green-500" />
                Mag standaard vanuit huis starten
              </p>
              <p className="text-xs text-gray-400 mt-0.5">Monteur rijdt direct van thuis naar de eerste locatie</p>
            </div>
          </label>

          {fout && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm text-red-700">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" /> {fout}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 pb-5 flex gap-3">
          <button
            onClick={opslaan}
            disabled={bezig}
            className="flex-1 py-2.5 bg-[#F3A713] text-[#1A1A1A] text-sm font-bold rounded-xl hover:bg-[#D4900E] transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {bezig ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
            {bezig ? 'Opslaan...' : bestaand ? 'Wijzigingen opslaan' : 'Monteur aanmaken'}
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2.5 border border-gray-200 text-gray-600 text-sm font-medium rounded-xl hover:bg-gray-50 transition-colors"
          >
            Annuleer
          </button>
        </div>
      </div>
    </div>
  );
}
