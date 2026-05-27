import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { supabase } from './supabase';
import type { Monteur } from './types';

type AuthState = {
  monteur: Monteur | null;
  laden: boolean;
  uitloggen: () => Promise<void>;
};

const AuthContext = createContext<AuthState>({
  monteur: null,
  laden: true,
  uitloggen: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [monteur, setMonteur] = useState<Monteur | null>(null);
  const [laden, setLaden] = useState(true);

  async function laadMonteur(email: string) {
    const { data } = await supabase
      .from('monteurs')
      .select('id, naam, voornaam, email, bus_capaciteit, van_huis')
      .eq('email', email)
      .single();
    if (data) {
      setMonteur({
        id: data.id,
        naam: data.naam,
        voornaam: data.voornaam,
        email: data.email,
        busCapaciteit: data.bus_capaciteit ?? 8,
        vanHuis: data.van_huis ?? false,
      });
    } else {
      setMonteur(null);
    }
  }

  useEffect(() => {
    // Herstel sessie bij opstarten
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user?.email) {
        laadMonteur(session.user.email).finally(() => setLaden(false));
      } else {
        setLaden(false);
      }
    });

    // Luister naar auth wijzigingen
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user?.email) {
        laadMonteur(session.user.email);
      } else {
        setMonteur(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  async function uitloggen() {
    await supabase.auth.signOut();
    setMonteur(null);
  }

  return (
    <AuthContext.Provider value={{ monteur, laden, uitloggen }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
