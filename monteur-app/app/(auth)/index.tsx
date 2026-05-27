import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/lib/colors';
import { supabase } from '@/lib/supabase';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [wachtwoord, setWachtwoord] = useState('');
  const [toonWachtwoord, setToonWachtwoord] = useState(false);
  const [loading, setLoading] = useState(false);
  const [fout, setFout] = useState('');

  const handleLogin = async () => {
    if (!email.trim() || !wachtwoord) {
      setFout('Vul je e-mailadres en wachtwoord in.');
      return;
    }
    setFout('');
    setLoading(true);

    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password: wachtwoord,
    });

    setLoading(false);

    if (error) {
      if (error.message.includes('Invalid login credentials')) {
        setFout('Onjuist e-mailadres of wachtwoord.');
      } else if (error.message.includes('Email not confirmed')) {
        setFout('E-mailadres nog niet bevestigd. Neem contact op met de beheerder.');
      } else {
        setFout(error.message);
      }
      return;
    }
    // NavigatieWacht in _layout.tsx stuurt automatisch door naar /(tabs)
  };

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        bounces={false}
      >
        {/* Header / Logo */}
        <View style={styles.header}>
          <View style={styles.logoBadge}>
            <Text style={styles.logoBadgeText}>EW</Text>
          </View>
          <Text style={styles.logoNaam}>EuroWheelz</Text>
          <Text style={styles.logoSub}>Monteur App</Text>
        </View>

        {/* Formulier */}
        <View style={styles.card}>
          <Text style={styles.titel}>Inloggen</Text>
          <Text style={styles.subtitel}>Alleen voor EuroWheelz monteurs</Text>

          {fout ? (
            <View style={styles.foutBanner}>
              <Ionicons name="alert-circle" size={16} color="#DC2626" />
              <Text style={styles.foutTekst}>{fout}</Text>
            </View>
          ) : null}

          {/* E-mail */}
          <View style={styles.veldGroep}>
            <Text style={styles.label}>E-mailadres</Text>
            <View style={styles.inputWrapper}>
              <Ionicons name="mail-outline" size={18} color={Colors.textLight} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                placeholder="naam@eurowheelz.nl"
                placeholderTextColor={Colors.textLight}
              />
            </View>
          </View>

          {/* Wachtwoord */}
          <View style={styles.veldGroep}>
            <Text style={styles.label}>Wachtwoord</Text>
            <View style={styles.inputWrapper}>
              <Ionicons name="lock-closed-outline" size={18} color={Colors.textLight} style={styles.inputIcon} />
              <TextInput
                style={[styles.input, { flex: 1 }]}
                value={wachtwoord}
                onChangeText={setWachtwoord}
                secureTextEntry={!toonWachtwoord}
                placeholder="••••••••"
                placeholderTextColor={Colors.textLight}
                onSubmitEditing={handleLogin}
                returnKeyType="go"
              />
              <TouchableOpacity onPress={() => setToonWachtwoord(!toonWachtwoord)} style={styles.oogKnop}>
                <Ionicons
                  name={toonWachtwoord ? 'eye-off-outline' : 'eye-outline'}
                  size={18}
                  color={Colors.textLight}
                />
              </TouchableOpacity>
            </View>
          </View>

          {/* Login knop */}
          <TouchableOpacity
            style={[styles.loginKnop, loading && styles.loginKnopDisabled]}
            onPress={handleLogin}
            disabled={loading}
            activeOpacity={0.85}
          >
            {loading ? (
              <ActivityIndicator color={Colors.textDark} />
            ) : (
              <>
                <Ionicons name="log-in-outline" size={20} color={Colors.textDark} />
                <Text style={styles.loginKnopTekst}>Inloggen</Text>
              </>
            )}
          </TouchableOpacity>

          <Text style={styles.vergeten}>Wachtwoord vergeten? Neem contact op met je beheerder.</Text>
        </View>

        {/* Footer */}
        <Text style={styles.versie}>EuroWheelz Monteur App v1.0</Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.green },
  scroll: {
    flexGrow: 1,
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 80,
    paddingBottom: 40,
  },

  // Header
  header: { alignItems: 'center', marginBottom: 36 },
  logoBadge: {
    width: 72,
    height: 72,
    borderRadius: 20,
    backgroundColor: Colors.amber,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  logoBadgeText: { fontSize: 28, fontWeight: '900', color: Colors.textDark },
  logoNaam: { fontSize: 26, fontWeight: '800', color: Colors.white, letterSpacing: -0.5 },
  logoSub: { fontSize: 13, color: 'rgba(255,255,255,0.55)', marginTop: 2, letterSpacing: 1, textTransform: 'uppercase' },

  // Kaart
  card: {
    width: '100%',
    backgroundColor: Colors.white,
    borderRadius: 20,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 20,
    elevation: 8,
  },
  titel: { fontSize: 20, fontWeight: '800', color: Colors.textDark, marginBottom: 4 },
  subtitel: { fontSize: 13, color: Colors.textLight, marginBottom: 20 },

  // Fout
  foutBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FEF2F2',
    borderRadius: 10,
    padding: 10,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  foutTekst: { fontSize: 13, color: '#DC2626', flex: 1 },

  // Velden
  veldGroep: { marginBottom: 16 },
  label: { fontSize: 12, fontWeight: '600', color: Colors.textMedium, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: 12,
    backgroundColor: Colors.background,
    paddingHorizontal: 12,
    height: 48,
  },
  inputIcon: { marginRight: 8 },
  input: { flex: 1, fontSize: 15, color: Colors.textDark },
  oogKnop: { padding: 4 },

  // Login knop
  loginKnop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.amber,
    borderRadius: 12,
    height: 52,
    marginTop: 8,
    shadowColor: Colors.amber,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 4,
  },
  loginKnopDisabled: { opacity: 0.7 },
  loginKnopTekst: { fontSize: 16, fontWeight: '700', color: Colors.textDark },

  vergeten: { fontSize: 12, color: Colors.textLight, textAlign: 'center', marginTop: 16, lineHeight: 18 },
  versie: { fontSize: 11, color: 'rgba(255,255,255,0.3)', marginTop: 24 },
});
