'use client';

import { useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { Loader2, Mail, ArrowLeft, CheckCircle2, AlertCircle } from 'lucide-react';

export default function WachtwoordVergetenPage() {
  const [email, setEmail] = useState('');
  const [bezig, setBezig] = useState(false);
  const [verstuurd, setVerstuurd] = useState(false);
  const [fout, setFout] = useState('');

  async function verstuur(e: React.FormEvent) {
    e.preventDefault();
    setFout('');
    setBezig(true);

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-wachtwoord`,
    });

    setBezig(false);

    if (error) {
      setFout(error.message);
      return;
    }

    setVerstuurd(true);
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
            <h2 className="text-base font-semibold text-gray-900">Wachtwoord vergeten</h2>
            <p className="text-sm text-gray-400 mt-0.5">
              {verstuurd ? 'Controleer je inbox' : 'We sturen je een reset-link per e-mail'}
            </p>
          </div>

          <div className="p-6">
            {verstuurd ? (
              <div className="space-y-4">
                <div className="flex items-start gap-3 p-4 bg-green-50 border border-green-200 rounded-xl">
                  <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold text-green-800">E-mail verstuurd!</p>
                    <p className="text-sm text-green-700 mt-0.5">
                      Als <span className="font-medium">{email}</span> bekend is, ontvang je binnen enkele minuten een e-mail met een reset-link.
                    </p>
                  </div>
                </div>
                <p className="text-xs text-gray-400 text-center">
                  Geen e-mail ontvangen? Controleer je spammap of probeer opnieuw.
                </p>
                <button
                  onClick={() => { setVerstuurd(false); setEmail(''); }}
                  className="w-full py-2.5 text-sm font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Opnieuw proberen
                </button>
              </div>
            ) : (
              <form onSubmit={verstuur} className="space-y-4">
                {fout && (
                  <div className="flex items-center gap-2.5 px-3 py-2.5 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    {fout}
                  </div>
                )}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    E-mailadres
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      autoFocus
                      placeholder="naam@eurowheelz.nl"
                      className="w-full pl-9 pr-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors"
                    />
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={bezig || !email}
                  className="w-full flex items-center justify-center gap-2 py-2.5 text-sm font-bold rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{ backgroundColor: '#345022', color: 'white' }}
                >
                  {bezig ? <><Loader2 className="w-4 h-4 animate-spin" /> Versturen...</> : 'Reset-link versturen'}
                </button>
              </form>
            )}
          </div>
        </div>

        <div className="mt-4 text-center">
          <Link
            href="/login"
            className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Terug naar inloggen
          </Link>
        </div>
      </div>
    </div>
  );
}
