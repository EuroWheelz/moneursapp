'use client';

import { useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { Plus, Edit2, Phone, Mail, MapPin, Truck, Home, Calendar, ChevronDown, X } from 'lucide-react';

const personeel = [
  {
    id: 'p1', naam: 'Maxim de Vries', rol: 'beheerder', subrol: 'Directie',
    telefoon: '+31 6 1234 0001', email: 'maxim@eurowheelz.nl',
    adres: 'Hoofdstraat 1, Amsterdam', busCapaciteit: null, vanHuis: false,
    vrijeDagen: ['2025-06-24', '2025-06-25'],
  },
  {
    id: 'p2', naam: 'Anna Bergman', rol: 'beheerder', subrol: 'Accountmanager',
    telefoon: '+31 6 1234 0002', email: 'anna@eurowheelz.nl',
    adres: 'Keizersgracht 45, Amsterdam', busCapaciteit: null, vanHuis: false,
    vrijeDagen: [],
  },
  {
    id: 'p3', naam: 'Jan Bakker', rol: 'monteur', subrol: 'Monteur',
    telefoon: '+31 6 1234 0003', email: 'jan@eurowheelz.nl',
    adres: 'Tulpstraat 8, Den Haag', busCapaciteit: 8, vanHuis: true,
    vrijeDagen: ['2025-07-01'],
  },
  {
    id: 'p4', naam: 'Kevin Smit', rol: 'monteur', subrol: 'Monteur',
    telefoon: '+31 6 1234 0004', email: 'kevin@eurowheelz.nl',
    adres: 'Rozenlaan 12, Haarlem', busCapaciteit: 4, vanHuis: false,
    vrijeDagen: [],
  },
  {
    id: 'p5', naam: 'Sophie van Dam', rol: 'monteur', subrol: 'Monteur',
    telefoon: '+31 6 1234 0005', email: 'sophie@eurowheelz.nl',
    adres: 'Parkweg 3, Utrecht', busCapaciteit: 8, vanHuis: true,
    vrijeDagen: ['2025-06-30'],
  },
];

const rolKleur: Record<string, string> = {
  beheerder: 'bg-purple-50 text-purple-700',
  monteur: 'bg-blue-50 text-blue-700',
};

export default function PersoneelPage() {
  const [geselecteerd, setGeselecteerd] = useState<string | null>(null);
  const [showNieuw, setShowNieuw] = useState(false);

  const selectedPersoon = personeel.find((p) => p.id === geselecteerd);

  return (
    <DashboardLayout
      title="Personeel"
      actions={
        <button
          onClick={() => setShowNieuw(true)}
          className="flex items-center gap-2 px-4 py-2 bg-[#F3A713] text-[#1A1A1A] rounded-lg text-sm font-semibold shadow-sm hover:bg-[#D4900E] active:scale-95 transition-all"
        >
          <Plus className="w-4 h-4" />
          Medewerker toevoegen
        </button>
      }
    >
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Personeel lijst */}
        <div className="lg:col-span-2 space-y-3">
          {/* Beheerders */}
          <GroepHeader titel="Beheerders (directie & accountmanagers)" count={personeel.filter((p) => p.rol === 'beheerder').length} />
          {personeel.filter((p) => p.rol === 'beheerder').map((p) => (
            <PersoonKaart key={p.id} persoon={p} actief={geselecteerd === p.id} onClick={() => setGeselecteerd(geselecteerd === p.id ? null : p.id)} />
          ))}

          {/* Monteurs */}
          <GroepHeader titel="Monteurs" count={personeel.filter((p) => p.rol === 'monteur').length} />
          {personeel.filter((p) => p.rol === 'monteur').map((p) => (
            <PersoonKaart key={p.id} persoon={p} actief={geselecteerd === p.id} onClick={() => setGeselecteerd(geselecteerd === p.id ? null : p.id)} />
          ))}

          {/* Bakwagen */}
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center gap-4 mt-4">
            <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center flex-shrink-0">
              <Truck className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-amber-900">Bakwagen (los bedrijfsmiddel)</p>
              <p className="text-sm text-amber-700">Capaciteit: 12 e-choppers · Niet aan vaste monteur gekoppeld</p>
            </div>
            <button className="p-2 rounded-lg hover:bg-amber-100 text-amber-600 transition-colors">
              <Edit2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Detail paneel */}
        <div>
          {selectedPersoon ? (
            <div className="bg-white rounded-xl border border-gray-200 p-5 sticky top-4">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary/10 text-primary font-bold flex items-center justify-center">
                    {selectedPersoon.naam.split(' ').map((n) => n[0]).join('').slice(0, 2)}
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900">{selectedPersoon.naam}</p>
                    <span className={`text-[11px] font-semibold px-2 py-0.5 rounded ${rolKleur[selectedPersoon.rol]}`}>{selectedPersoon.subrol}</span>
                  </div>
                </div>
                <button onClick={() => setGeselecteerd(null)} className="p-1 rounded hover:bg-gray-100 text-gray-400 transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-3 text-sm">
                <InfoRij icon={Phone}>{selectedPersoon.telefoon}</InfoRij>
                <InfoRij icon={Mail}>{selectedPersoon.email}</InfoRij>
                <InfoRij icon={MapPin}>{selectedPersoon.adres}</InfoRij>
                {selectedPersoon.busCapaciteit && (
                  <InfoRij icon={Truck}>Bus: {selectedPersoon.busCapaciteit} e-choppers capaciteit</InfoRij>
                )}
                {selectedPersoon.rol === 'monteur' && (
                  <InfoRij icon={Home}>
                    Mag vanuit huis starten: <span className={selectedPersoon.vanHuis ? 'text-green-600 font-medium' : 'text-gray-400'}>{selectedPersoon.vanHuis ? 'Ja' : 'Nee'}</span>
                  </InfoRij>
                )}
              </div>

              {/* Vrije dagen */}
              <div className="mt-4 pt-4 border-t border-gray-100">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Vrije dagen</p>
                  <button className="text-xs text-primary hover:underline">+ Toevoegen</button>
                </div>
                {selectedPersoon.vrijeDagen.length === 0 ? (
                  <p className="text-xs text-gray-400 italic">Geen vrije dagen ingevoerd</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {selectedPersoon.vrijeDagen.map((dag) => (
                      <span key={dag} className="flex items-center gap-1 px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded-lg">
                        <Calendar className="w-3 h-3" />
                        {dag}
                        <button className="ml-0.5 hover:text-red-500 transition-colors"><X className="w-3 h-3" /></button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Acties */}
              <div className="mt-4 pt-4 border-t border-gray-100 space-y-2">
                <button className="w-full px-3 py-2 bg-primary text-white text-sm font-medium rounded-lg hover:bg-primary/90 transition-colors">
                  Gegevens aanpassen
                </button>
                <button className="w-full px-3 py-2 border border-gray-200 text-gray-600 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors">
                  Inloggegevens beheren
                </button>
              </div>
            </div>
          ) : (
            <div className="bg-gray-50 border border-dashed border-gray-200 rounded-xl p-8 text-center">
              <p className="text-sm text-gray-400">Selecteer een medewerker voor details</p>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}

function GroepHeader({ titel, count }: { titel: string; count: number }) {
  return (
    <div className="flex items-center gap-2 pt-2">
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{titel}</p>
      <span className="px-1.5 py-0.5 bg-gray-100 text-gray-500 rounded text-xs font-medium">{count}</span>
    </div>
  );
}

function PersoonKaart({ persoon, actief, onClick }: { persoon: typeof personeel[0]; actief: boolean; onClick: () => void }) {
  return (
    <div
      onClick={onClick}
      className={`bg-white border rounded-xl p-4 cursor-pointer transition-all hover:shadow-sm
        ${actief ? 'border-primary/40 bg-primary/5 shadow-sm' : 'border-gray-200 hover:border-gray-300'}`}
    >
      <div className="flex items-center gap-3">
        <div className={`w-9 h-9 rounded-full font-bold text-sm flex items-center justify-center flex-shrink-0
          ${actief ? 'bg-primary text-white' : 'bg-gray-100 text-gray-600'}`}>
          {persoon.naam.split(' ').map((n) => n[0]).join('').slice(0, 2)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="font-semibold text-gray-900 text-sm">{persoon.naam}</p>
            <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${rolKleur[persoon.rol]}`}>{persoon.subrol}</span>
          </div>
          <div className="flex items-center gap-3 mt-0.5 text-xs text-gray-400">
            <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{persoon.telefoon}</span>
            {persoon.busCapaciteit && <span className="flex items-center gap-1"><Truck className="w-3 h-3" />{persoon.busCapaciteit}</span>}
            {persoon.vanHuis && <span className="flex items-center gap-1"><Home className="w-3 h-3 text-green-500" />Vanuit huis</span>}
          </div>
        </div>
        {persoon.vrijeDagen.length > 0 && (
          <span className="flex items-center gap-1 text-xs text-amber-600 bg-amber-50 px-2 py-1 rounded-lg flex-shrink-0">
            <Calendar className="w-3 h-3" />
            {persoon.vrijeDagen.length} vrij
          </span>
        )}
      </div>
    </div>
  );
}

function InfoRij({ icon: Icon, children }: { icon: React.ElementType; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2.5 text-gray-700">
      <Icon className="w-4 h-4 text-gray-400 flex-shrink-0 mt-0.5" />
      <span>{children}</span>
    </div>
  );
}
