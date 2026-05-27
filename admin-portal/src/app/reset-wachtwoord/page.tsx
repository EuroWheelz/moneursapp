'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Loader2, Eye, EyeOff, CheckCircle2, AlertCircle, Lock } from 'lucide-react';

export default function ResetWachtwoordPage() {
  const router = useRouter();
  const [wachtwoord, setWachtwoord] = useState('');
  const [bevestig, setBevestig] = useState('');
  const [toonW, setToonW] = useState(false);
  const [toonB, setToonB] = useState(false);
  const [bezig, setBezig] = useState(false);
  const [klaar, setKlaar] = useState(false);
  const [fout, setFout] = useState('');
  const [geldigeLink, setGeldigeLink] = useState(false);

  useEffect(() => {
    // Supabase verwerkt het token uit de URL automatisch en zet de sessie
    supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setGeldigeLink(true);
      }
    });

    // Check ook of er al een actieve recovery sessie is
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setGeldigeLink(true);
    });
  }, []);

  async function slaOp(e: React.FormEvent) {
    e.preventDefault();
    setFout('');

    if (wachtwoord.length < 8) {
      setFout('Wachtwoord moet minimaal 8 tekens zijn.');
      return;
    }
    if (wachtwoord !== bevestig) {
      setFout('Wachtwoorden komen niet overeen.');
      return;
    }

    setBezig(true);
    const { error } = await supabase.auth.updateUser({ password: wachtwoord });
    setBezig(false);

    if (error) {
      setFout(error.message);
      return;
    }

    setKlaar(true);
    setTimeout(() => router.push('/'), 2500);
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ backgroundColor: '#F2F4F0' }}>
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center font-black text-2xl mb-4 shadow-lg"
            style={{ backgroundColor: '#F3A713', color: '#345022' }}
          >
            EW
          </div>
          <h1 className="text-2xl font-bold text-gray-900">EuroWheelz</h1>
          <p className="text-sm text-gray-400 mt-0.5 uppercase tracking-widest font-medium">Plansysteem</p>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-6 py-5 border-b border-gray-100">
            <h2 className="text-base font-semibold text-gray-900">Nieuw wachtwoord instellen</h2>
            <p className="text-sm text-gray-400 mt-0.5">Kies een sterk wachtwoord van minimaal 8 tekens</p>
          </div>

          <div className="p-6">
            {klaar ? (
              <div className="flex items-start gap-3 p-4 bg-green-50 border border-green-200 rounded-xl">
                <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-green-800">Wachtwoord gewijzigd!</p>
                  <p className="text-sm text-green-700 mt-0.5">Je wordt automatisch doorgestuurd...</p>
                </div>
              </div>
            ) : !geldigeLink ? (
              <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl">
                <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-amber-800">Link laden...</p>
                  <p className="text-sm text-amber-700 mt-0.5">Even geduld terwijl we je link verifiëren.</p>
                </div>
              </div>
            ) : (
              <form onSubmit={slaOp} className="space-y-4">
                {fout && (
                  <div className="flex items-center gap-2.5 px-3 py-2.5 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    {fout}
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Nieuw wachtwoord</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type={toonW ? 'text' : 'password'}
                      value={wachtwoord}
                      onChange={(e) => setWachtwoord(e.target.value)}
                      required
                      autoFocus
                      placeholder="Minimaal 8 tekens"
                      className="w-full pl-9 pr-10 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors"
                    />
                    <button type="button" onClick={() => setToonW(!toonW)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600">
                      {toonW ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Bevestig wachtwoord</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type={toonB ? 'text' : 'password'}
                      value={bevestig}
                      onChange={(e) => setBevestig(e.target.value)}
                      required
                      placeholder="Herhaal wachtwoord"
                      className={`w-full pl-9 pr-10 py-2.5 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 transition-colors ${
                        bevestig && bevestig !== wachtwoord
                          ? 'border-red-300 focus:border-red-400'
                          : 'border-gray-200 focus:border-primary'
                      }`}
                    />
                    <button type="button" onClick={() => setToonB(!toonB)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600">
                      {toonB ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {bevestig && bevestig !== wachtwoord && (
                    <p className="text-xs text-red-500 mt-1">Wachtwoorden komen niet overeen</p>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={bezig || !wachtwoord || !bevestig}
                  className="w-full flex items-center justify-center gap-2 py-2.5 text-sm font-bold rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{ backgroundColor: '#345022', color: 'white' }}
                >
                  {bezig ? <><Loader2 className="w-4 h-4 animate-spin" /> Opslaan...</> : 'Wachtwoord opslaan'}
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
