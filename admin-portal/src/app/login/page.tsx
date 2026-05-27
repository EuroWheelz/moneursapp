'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import { Loader2, Eye, EyeOff, AlertCircle } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [wachtwoord, setWachtwoord] = useState('');
  const [toonWachtwoord, setToonWachtwoord] = useState(false);
  const [fout, setFout] = useState('');
  const [bezig, setBezig] = useState(false);

  async function inloggen(e: React.FormEvent) {
    e.preventDefault();
    setFout('');
    setBezig(true);

    const { error } = await supabase.auth.signInWithPassword({ email, password: wachtwoord });

    if (error) {
      setFout(
        error.message.includes('Invalid login')
          ? 'Ongeldig e-mailadres of wachtwoord.'
          : error.message
      );
      setBezig(false);
      return;
    }

    router.push('/');
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

        {/* Card */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-6 py-5 border-b border-gray-100">
            <h2 className="text-base font-semibold text-gray-900">Inloggen</h2>
            <p className="text-sm text-gray-400 mt-0.5">Toegang tot het beheerportaal</p>
          </div>

          <form onSubmit={inloggen} className="p-6 space-y-4">
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
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoFocus
                autoComplete="email"
                placeholder="naam@eurowheelz.nl"
                className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-sm font-medium text-gray-700">Wachtwoord</label>
                <Link href="/wachtwoord-vergeten" className="text-xs text-gray-400 hover:text-gray-700 transition-colors">
                  Vergeten?
                </Link>
              </div>
              <div className="relative">
                <input
                  type={toonWachtwoord ? 'text' : 'password'}
                  value={wachtwoord}
                  onChange={(e) => setWachtwoord(e.target.value)}
                  required
                  autoComplete="current-password"
                  placeholder="••••••••"
                  className="w-full px-3 py-2.5 pr-10 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setToonWachtwoord(!toonWachtwoord)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600 transition-colors"
                >
                  {toonWachtwoord ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={bezig || !email || !wachtwoord}
              className="w-full flex items-center justify-center gap-2 py-2.5 text-sm font-bold rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ backgroundColor: '#345022', color: 'white' }}
            >
              {bezig ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Inloggen...
                </>
              ) : (
                'Inloggen'
              )}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-gray-400 mt-6">
          Geen toegang? Neem contact op met de systeembeheerder.
        </p>
      </div>
    </div>
  );
}
