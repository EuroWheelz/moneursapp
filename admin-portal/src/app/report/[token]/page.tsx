'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Camera, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';

export default function ReportDefectPage({ params }: { params: { token: string } }) {
  const [location, setLocation] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  // Form state
  const [vehicleId, setVehicleId] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState('medium');

  useEffect(() => {
    async function fetchLocation() {
      const { data, error } = await supabase
        .from('locations')
        .select('id, name')
        .eq('secret_token', params.token)
        .single();

      if (error || !data) {
        setError('Ongeldige locatie link. Neem contact op met EuroWheelz.');
      } else {
        setLocation(data);
      }
      setLoading(false);
    }

    fetchLocation();
  }, [params.token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!vehicleId || !description) return;

    setIsSubmitting(true);
    
    // In a real app, we'd handle photo uploads here
    const { error: submitError } = await supabase.from('defects').insert({
      location_id: location.id,
      vehicle_id: vehicleId,
      description,
      priority,
      status: 'new',
    });

    if (submitError) {
      setError('Er is iets misgegaan bij het verzenden. Probeer het opnieuw.');
    } else {
      setIsSuccess(true);
    }
    setIsSubmitting(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-white">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4 text-center">
        <AlertCircle className="w-12 h-12 text-red-500 mb-4" />
        <h1 className="text-xl font-bold mb-2">Foutmelding</h1>
        <p className="text-gray-600">{error}</p>
      </div>
    );
  }

  if (isSuccess) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4 text-center">
        <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mb-6">
          <CheckCircle2 className="w-12 h-12 text-primary" />
        </div>
        <h1 className="text-2xl font-bold mb-2 text-primary">Melding Ontvangen!</h1>
        <p className="text-gray-600 mb-8">Bedankt voor je melding. Een monteur zal hier zo spoedig mogelijk naar kijken.</p>
        <button 
          onClick={() => setIsSuccess(false)}
          className="px-6 py-2 bg-primary text-white rounded-lg font-medium"
        >
          Nog een defect melden
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto min-h-screen bg-white p-6">
      <header className="mb-8">
        <div className="w-12 h-12 bg-primary rounded-xl mb-4 flex items-center justify-center text-white font-bold text-xl">
          E
        </div>
        <h1 className="text-2xl font-bold text-primary">Defect Melden</h1>
        <p className="text-gray-500">{location.name}</p>
      </header>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Kenteken / ID Voertuig</label>
          <input 
            type="text" 
            value={vehicleId}
            onChange={(e) => setVehicleId(e.target.value)}
            className="w-full px-4 py-3 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            placeholder="Bijv. XP-123-Z"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Wat is het probleem?</label>
          <textarea 
            rows={4}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full px-4 py-3 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            placeholder="Omschrijf het defect..."
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Prioriteit</label>
          <div className="grid grid-cols-2 gap-2">
            {['low', 'medium', 'high', 'urgent'].map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPriority(p)}
                className={`py-2 px-4 rounded-lg border text-sm font-medium capitalize transition-colors
                  ${priority === p 
                    ? 'bg-primary text-white border-primary' 
                    : 'bg-white text-gray-600 border-gray-200 hover:border-primary/50'}`}
              >
                {p === 'low' ? 'Laag' : p === 'medium' ? 'Gemiddeld' : p === 'high' ? 'Hoog' : 'Spoed'}
              </button>
            ))}
          </div>
        </div>

        <button
          type="button"
          className="w-full py-4 border-2 border-dashed border-gray-200 rounded-xl flex flex-col items-center justify-center text-gray-500 hover:bg-gray-50 transition-colors"
        >
          <Camera className="w-8 h-8 mb-1" />
          <span className="text-sm">Foto's toevoegen</span>
        </button>

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full py-4 bg-primary text-white rounded-xl font-bold shadow-lg shadow-primary/20 active:scale-[0.98] transition-all disabled:opacity-50"
        >
          {isSubmitting ? 'Bezig met verzenden...' : 'Defect Melden'}
        </button>
      </form>
    </div>
  );
}
