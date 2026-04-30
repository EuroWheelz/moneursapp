import { useState, useEffect } from 'react';
import {
  ScrollView, View, Text, TouchableOpacity, StyleSheet, Switch, Alert, ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '@/lib/supabase';
import { monteur as mockMonteur } from '@/lib/mock-data';
import { Colors } from '@/lib/colors';

type WeekStats = { totaal: number; uitgevoerd: number; voertuigen: number };

const VRIJE_DAGEN_MOCK = [
  { datum: '2025-04-21', goedgekeurd: true },
  { datum: '2025-04-22', goedgekeurd: true },
  { datum: '2025-05-05', goedgekeurd: null },
];

function weekGrenzen(): { ma: string; zo: string } {
  const nu = new Date();
  const dag = nu.getDay();
  const diffNaarMa = dag === 0 ? -6 : 1 - dag;
  const ma = new Date(nu);
  ma.setDate(nu.getDate() + diffNaarMa);
  const zo = new Date(ma);
  zo.setDate(ma.getDate() + 6);
  return {
    ma: ma.toISOString().split('T')[0],
    zo: zo.toISOString().split('T')[0],
  };
}

export default function ProfielScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [meldingen, setMeldingen] = useState(true);
  const [vroegtijdig, setVroegtijdig] = useState(false);
  const [stats, setStats] = useState<WeekStats>({ totaal: 0, uitgevoerd: 0, voertuigen: 0 });
  const [ladenStats, setLadenStats] = useState(true);

  const { ma, zo } = weekGrenzen();

  useEffect(() => {
    laadStats();
  }, []);

  async function laadStats() {
    const { data } = await supabase
      .from('opdrachten')
      .select('status, voertuigen(id)')
      .eq('monteur_id', mockMonteur.id)
      .gte('datum', ma)
      .lte('datum', zo)
      .is('deleted_at', null);

    if (data) {
      const totaal = data.length;
      const uitgevoerd = data.filter((o: any) => o.status === 'uitgevoerd').length;
      const voertuigen = data.reduce((t: number, o: any) => t + (o.voertuigen?.length ?? 0), 0);
      setStats({ totaal, uitgevoerd, voertuigen });
    }
    setLadenStats(false);
  }

  function handleUitloggen() {
    Alert.alert(
      'Uitloggen',
      'Weet je zeker dat je wilt uitloggen?',
      [
        { text: 'Annuleren', style: 'cancel' },
        { text: 'Uitloggen', style: 'destructive', onPress: () => router.replace('/(auth)') },
      ],
    );
  }

  function handleVrijedag() {
    Alert.alert('Vrije dag aanvragen', 'Kies een datum via de beheerder of via de planner in het systeem.');
  }

  const pct = stats.totaal > 0 ? Math.round((stats.uitgevoerd / stats.totaal) * 100) : 0;

  return (
    <View style={{ flex: 1, backgroundColor: Colors.background }}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <View style={styles.avatarWrapper}>
          <Text style={styles.avatarTekst}>
            {mockMonteur.voornaam[0]}{mockMonteur.naam.split(' ').pop()?.[0]}
          </Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerNaam}>{mockMonteur.naam}</Text>
          <Text style={styles.headerEmail}>{mockMonteur.email}</Text>
          <View style={styles.rolBadge}>
            <Ionicons name="construct-outline" size={11} color={Colors.white} />
            <Text style={styles.rolBadgeTekst}>Monteur</Text>
          </View>
        </View>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Stats */}
        {ladenStats ? (
          <View style={[styles.statsRij, { justifyContent: 'center' }]}>
            <ActivityIndicator color={Colors.green} />
          </View>
        ) : (
          <View style={styles.statsRij}>
            <View style={styles.statKaart}>
              <Text style={styles.statGetal}>{stats.uitgevoerd}</Text>
              <Text style={styles.statLabel}>Afgerond{'\n'}deze week</Text>
            </View>
            <View style={styles.statKaart}>
              <Text style={styles.statGetal}>{stats.voertuigen}</Text>
              <Text style={styles.statLabel}>Voertuigen{'\n'}bediend</Text>
            </View>
            <View style={styles.statKaart}>
              <Text style={[styles.statGetal, { fontSize: 20 }]}>{pct}%</Text>
              <Text style={styles.statLabel}>Week{'\n'}voltooid</Text>
            </View>
          </View>
        )}

        {/* Businfo */}
        <View style={styles.sectie}>
          <Text style={styles.sectieTitel}>Mijn bus</Text>
          <View style={styles.kaart}>
            <InfoRij icoon="car-outline" label="Vertrek vanuit huis" waarde={mockMonteur.vanHuis ? 'Ja' : 'Nee'} />
            <InfoRij icoon="layers-outline" label="Laadcapaciteit" waarde={`${mockMonteur.busCapaciteit} voertuigen`} />
            <InfoRij icoon="id-card-outline" label="Medewerker ID" waarde={mockMonteur.id} />
          </View>
        </View>

        {/* Vrije dagen */}
        <View style={styles.sectie}>
          <View style={styles.sectieHeaderRij}>
            <Text style={styles.sectieTitel}>Vrije dagen</Text>
            <TouchableOpacity style={styles.toevoegenKnop} onPress={handleVrijedag} activeOpacity={0.8}>
              <Ionicons name="add" size={14} color={Colors.green} />
              <Text style={styles.toevoegenTekst}>Aanvragen</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.kaart}>
            {VRIJE_DAGEN_MOCK.map((vd) => {
              const d = new Date(vd.datum + 'T12:00:00');
              const label = d.toLocaleDateString('nl-NL', { weekday: 'short', day: 'numeric', month: 'long' });
              return (
                <View key={vd.datum} style={styles.vrijeDagRij}>
                  <View style={styles.vrijeDagLinks}>
                    <Ionicons name="calendar-outline" size={16} color={Colors.textMedium} />
                    <Text style={styles.vrijeDagTekst}>{label}</Text>
                  </View>
                  <View style={[
                    styles.statusPil,
                    vd.goedgekeurd === true && styles.statusPilOk,
                    vd.goedgekeurd === null && styles.statusPilWacht,
                  ]}>
                    <Text style={[
                      styles.statusPilTekst,
                      vd.goedgekeurd === true && { color: '#166534' },
                      vd.goedgekeurd === null && { color: '#92400E' },
                    ]}>
                      {vd.goedgekeurd === true ? 'Goedgekeurd' : vd.goedgekeurd === false ? 'Afgewezen' : 'In behandeling'}
                    </Text>
                  </View>
                </View>
              );
            })}
          </View>
        </View>

        {/* Instellingen */}
        <View style={styles.sectie}>
          <Text style={styles.sectieTitel}>Instellingen</Text>
          <View style={styles.kaart}>
            <View style={styles.switchRij}>
              <View style={styles.switchLinks}>
                <Ionicons name="notifications-outline" size={18} color={Colors.textMedium} />
                <View>
                  <Text style={styles.switchLabel}>Pushmeldingen</Text>
                  <Text style={styles.switchSub}>Nieuwe opdrachten & updates</Text>
                </View>
              </View>
              <Switch
                value={meldingen}
                onValueChange={setMeldingen}
                trackColor={{ false: Colors.border, true: Colors.green }}
                thumbColor={Colors.white}
              />
            </View>
            <View style={[styles.switchRij, { borderTopWidth: 1, borderTopColor: Colors.border, marginTop: 2, paddingTop: 14 }]}>
              <View style={styles.switchLinks}>
                <Ionicons name="time-outline" size={18} color={Colors.textMedium} />
                <View>
                  <Text style={styles.switchLabel}>Vroeg opstarten</Text>
                  <Text style={styles.switchSub}>Start route 30 min eerder</Text>
                </View>
              </View>
              <Switch
                value={vroegtijdig}
                onValueChange={setVroegtijdig}
                trackColor={{ false: Colors.border, true: Colors.green }}
                thumbColor={Colors.white}
              />
            </View>
          </View>
        </View>

        {/* Acties */}
        <View style={styles.sectie}>
          <View style={styles.kaart}>
            <TouchableOpacity style={styles.actieRij} activeOpacity={0.7}>
              <Ionicons name="help-circle-outline" size={18} color={Colors.textMedium} />
              <Text style={styles.actieTekst}>Help & ondersteuning</Text>
              <Ionicons name="chevron-forward" size={16} color={Colors.textLight} style={{ marginLeft: 'auto' as any }} />
            </TouchableOpacity>
            <View style={{ borderTopWidth: 1, borderTopColor: Colors.border }} />
            <TouchableOpacity style={styles.actieRij} activeOpacity={0.7}>
              <Ionicons name="document-text-outline" size={18} color={Colors.textMedium} />
              <Text style={styles.actieTekst}>Privacybeleid</Text>
              <Ionicons name="chevron-forward" size={16} color={Colors.textLight} style={{ marginLeft: 'auto' as any }} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Uitloggen */}
        <TouchableOpacity style={styles.uitlogKnop} onPress={handleUitloggen} activeOpacity={0.85}>
          <Ionicons name="log-out-outline" size={18} color="#DC2626" />
          <Text style={styles.uitlogTekst}>Uitloggen</Text>
        </TouchableOpacity>

        <Text style={styles.versie}>EuroWheelz Monteur App v1.0 · {mockMonteur.id}</Text>
      </ScrollView>
    </View>
  );
}

function InfoRij({ icoon, label, waarde }: { icoon: any; label: string; waarde: string }) {
  return (
    <View style={styles.infoRij}>
      <Ionicons name={icoon} size={16} color={Colors.textMedium} />
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoWaarde}>{waarde}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    backgroundColor: Colors.green,
    paddingHorizontal: 20,
    paddingBottom: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  avatarWrapper: {
    width: 60, height: 60, borderRadius: 30,
    backgroundColor: Colors.amber,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarTekst: { fontSize: 22, fontWeight: '900', color: Colors.textDark },
  headerNaam: { fontSize: 18, fontWeight: '800', color: Colors.white },
  headerEmail: { fontSize: 12, color: 'rgba(255,255,255,0.6)', marginBottom: 6 },
  rolBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignSelf: 'flex-start',
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6,
  },
  rolBadgeTekst: { fontSize: 10, fontWeight: '700', color: Colors.white, textTransform: 'uppercase' },

  statsRij: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  statKaart: {
    flex: 1, backgroundColor: Colors.white, borderRadius: 14, padding: 14,
    alignItems: 'center', borderWidth: 1, borderColor: Colors.border,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04, shadowRadius: 3, elevation: 1,
  },
  statGetal: { fontSize: 26, fontWeight: '900', color: Colors.green },
  statLabel: { fontSize: 11, color: Colors.textLight, textAlign: 'center', marginTop: 2, lineHeight: 15 },

  sectie: { marginBottom: 20 },
  sectieHeaderRij: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 8,
  },
  sectieTitel: {
    fontSize: 11, fontWeight: '700', color: Colors.textLight,
    textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8,
  },
  kaart: {
    backgroundColor: Colors.white, borderRadius: 14,
    borderWidth: 1, borderColor: Colors.border, overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04, shadowRadius: 3, elevation: 1,
  },
  toevoegenKnop: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    borderWidth: 1.5, borderColor: Colors.green,
    borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4,
  },
  toevoegenTekst: { fontSize: 12, fontWeight: '600', color: Colors.green },
  infoRij: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 14, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  infoLabel: { fontSize: 13, color: Colors.textMedium, flex: 1 },
  infoWaarde: { fontSize: 13, fontWeight: '600', color: Colors.textDark },

  vrijeDagRij: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 14, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  vrijeDagLinks: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  vrijeDagTekst: { fontSize: 13, color: Colors.textDark, textTransform: 'capitalize' },
  statusPil: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, backgroundColor: '#FEE2E2' },
  statusPilOk: { backgroundColor: '#DCFCE7' },
  statusPilWacht: { backgroundColor: '#FEF3C7' },
  statusPilTekst: { fontSize: 11, fontWeight: '600', color: '#991B1B' },

  switchRij: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 14, paddingVertical: 12,
  },
  switchLinks: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  switchLabel: { fontSize: 14, color: Colors.textDark, fontWeight: '600' },
  switchSub: { fontSize: 11, color: Colors.textLight, marginTop: 1 },

  actieRij: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 14, paddingVertical: 14,
  },
  actieTekst: { fontSize: 14, color: Colors.textDark },

  uitlogKnop: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: '#FEF2F2', borderRadius: 14, paddingVertical: 14,
    borderWidth: 1, borderColor: '#FECACA', marginBottom: 20,
  },
  uitlogTekst: { fontSize: 15, fontWeight: '700', color: '#DC2626' },
  versie: { fontSize: 11, color: Colors.textLight, textAlign: 'center' },
});
