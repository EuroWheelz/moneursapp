import { useState, useEffect } from 'react';
import { ScrollView, View, Text, TouchableOpacity, StyleSheet, Linking, Platform, ActivityIndicator, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase, dbToOpdracht } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { Colors } from '@/lib/colors';
import type { Opdracht } from '@/lib/types';

const TYPENAAM: Record<string, string> = {
  onderhoud: 'Onderhoud', reparatie: 'Reparatie', accu: 'Accu',
  plaatsen: 'Plaatsen', terughalen: 'Terughalen', evaluatie: 'Evaluatie',
  voertuigruil: 'Voertuigruil', pechhulp: 'Pechhulp',
};

const prioDot = (p: number, urgent: boolean) => {
  if (urgent || p === 1) return Colors.prio1;
  if (p === 2) return Colors.prio2;
  return Colors.prio3;
};

function navigeerNaar(adres: string, postcode: string, stad: string) {
  const q = encodeURIComponent(`${adres}, ${postcode} ${stad}`);
  const url = Platform.OS === 'ios'
    ? `maps://?daddr=${q}`
    : `https://www.google.com/maps/dir/?api=1&destination=${q}`;
  Linking.openURL(url);
}

export default function VandaagScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { monteur } = useAuth();

  const [opdrachten, setOpdrachten] = useState<Opdracht[]>([]);
  const [laden, setLaden] = useState(true);

  const vandaag = new Date().toISOString().split('T')[0];
  const datum = new Date().toLocaleDateString('nl-NL', { weekday: 'long', day: 'numeric', month: 'long' });

  useEffect(() => {
    if (!monteur) return;
    laadOpdrachten();

    const channel = supabase
      .channel(`vandaag-monteur-${monteur.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'opdrachten' }, laadOpdrachten)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'voertuigen' }, laadOpdrachten)
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [monteur?.id]);

  async function laadOpdrachten() {
    if (!monteur) return;
    const { data } = await supabase
      .from('opdrachten')
      .select('*, voertuigen(*), pech_stops(*)')
      .eq('datum', vandaag)
      .eq('monteur_id', monteur.id)
      .order('route_volgorde', { ascending: true });

    if (data) {
      setOpdrachten(data.map(dbToOpdracht));
    }
    setLaden(false);
  }

  async function verplaatsVolgorde(opId: string, richting: 'omhoog' | 'omlaag') {
    const gesorteerd = [...opdrachten].sort((a, b) => a.routeVolgorde - b.routeVolgorde);
    const idx = gesorteerd.findIndex((o) => o.id === opId);
    const buurIdx = richting === 'omhoog' ? idx - 1 : idx + 1;
    if (buurIdx < 0 || buurIdx >= gesorteerd.length) return;

    const huidig = gesorteerd[idx];
    const buur = gesorteerd[buurIdx];

    // Blokkeer wisselen als één van beide een vaste tijd heeft
    if (huidig.tijdVastzetten || buur.tijdVastzetten) {
      Alert.alert(
        'Tijd vastgezet',
        'Let op: de tijd staat vast. Er kan niet worden gewisseld.',
        [{ text: 'OK', style: 'default' }]
      );
      return;
    }

    const nieuweHuidig = buur.routeVolgorde;
    const nieuweBuur = huidig.routeVolgorde;

    // Optimistisch updaten
    setOpdrachten((p) => p.map((o) => {
      if (o.id === huidig.id) return { ...o, routeVolgorde: nieuweHuidig };
      if (o.id === buur.id) return { ...o, routeVolgorde: nieuweBuur };
      return o;
    }));

    await Promise.all([
      supabase.from('opdrachten').update({ route_volgorde: nieuweHuidig }).eq('id', huidig.id),
      supabase.from('opdrachten').update({ route_volgorde: nieuweBuur }).eq('id', buur.id),
    ]);
  }

  const afgesloten = opdrachten.filter((o) => o.status === 'uitgevoerd').length;
  const openstaand = opdrachten.filter((o) => o.status !== 'uitgevoerd').length;
  const eersteOpen = opdrachten.find((o) => o.status !== 'uitgevoerd');

  return (
    <View style={{ flex: 1, backgroundColor: Colors.background }}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <View>
          <Text style={styles.headerGroet}>Goedemorgen, {monteur.voornaam} 👋</Text>
          <Text style={styles.headerDatum}>{datum}</Text>
        </View>
        <View style={styles.headerBadge}>
          <Text style={styles.headerBadgeTekst}>{opdrachten.length}</Text>
          <Text style={styles.headerBadgeSub}>stops</Text>
        </View>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 16, paddingBottom: 24 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Dagkaart */}
        <View style={styles.dagKaart}>
          <View style={styles.dagKaartRij}>
            <View style={styles.dagStat}>
              <Ionicons name="checkmark-circle" size={20} color={Colors.amber} />
              <Text style={styles.dagStatGetal}>{afgesloten}</Text>
              <Text style={styles.dagStatLabel}>afgerond</Text>
            </View>
            <View style={styles.dagStatScheidslijn} />
            <View style={styles.dagStat}>
              <Ionicons name="time-outline" size={20} color={Colors.white} />
              <Text style={styles.dagStatGetal}>{openstaand}</Text>
              <Text style={styles.dagStatLabel}>openstaand</Text>
            </View>
            <View style={styles.dagStatScheidslijn} />
            <View style={styles.dagStat}>
              <Ionicons name="car-outline" size={20} color={Colors.white} />
              <Text style={styles.dagStatGetal}>
                {opdrachten.reduce((t, o) => t + o.voertuigen.length, 0)}
              </Text>
              <Text style={styles.dagStatLabel}>voertuigen</Text>
            </View>
          </View>
          {eersteOpen && (
            <TouchableOpacity
              style={styles.navigeerStartKnop}
              onPress={() => navigeerNaar(eersteOpen.adres, eersteOpen.postcode, eersteOpen.stad)}
              activeOpacity={0.85}
            >
              <Ionicons name="navigate" size={18} color={Colors.textDark} />
              <Text style={styles.navigeerStartTekst}>Navigeer naar eerste stop</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Route van de dag */}
        <Text style={styles.sectionTitel}>Route van de dag</Text>

        {laden ? (
          <View style={styles.laadContainer}>
            <ActivityIndicator color={Colors.green} />
            <Text style={styles.laadTekst}>Opdrachten laden...</Text>
          </View>
        ) : opdrachten.length === 0 ? (
          <View style={styles.leegContainer}>
            <Ionicons name="calendar-outline" size={40} color={Colors.textLight} />
            <Text style={styles.leegTekst}>Geen opdrachten vandaag</Text>
          </View>
        ) : (
          [...opdrachten]
            .sort((a, b) => a.routeVolgorde - b.routeVolgorde)
            .map((opdracht, idx, arr) => (
              <OpdrachtKaart
                key={opdracht.id}
                opdracht={opdracht}
                volgorde={idx + 1}
                totaal={arr.length}
                kanOmhoog={idx > 0}
                kanOmlaag={idx < arr.length - 1}
                onPress={() => router.push(`/opdracht/${opdracht.id}`)}
                onNavigeer={() => navigeerNaar(opdracht.adres, opdracht.postcode, opdracht.stad)}
                onOmhoog={() => verplaatsVolgorde(opdracht.id, 'omhoog')}
                onOmlaag={() => verplaatsVolgorde(opdracht.id, 'omlaag')}
              />
            ))
        )}
      </ScrollView>
    </View>
  );
}

function OpdrachtKaart({
  opdracht, volgorde, totaal, kanOmhoog, kanOmlaag, onPress, onNavigeer, onOmhoog, onOmlaag,
}: {
  opdracht: Opdracht; volgorde: number; totaal: number;
  kanOmhoog: boolean; kanOmlaag: boolean;
  onPress: () => void; onNavigeer: () => void;
  onOmhoog: () => void; onOmlaag: () => void;
}) {
  const typekleur = Colors.typeKleuren[opdracht.type] ?? { bg: '#F3F4F6', text: '#374151' };
  const afgerond = opdracht.status === 'uitgevoerd';

  return (
    <View style={[styles.kaart, afgerond && styles.kaartAfgerond]}>
      {volgorde < totaal && <View style={styles.connectorLijn} />}

      <View style={styles.stopLinks}>
        <View style={[styles.stopNummer, afgerond && styles.stopNummerAfgerond]}>
          {afgerond
            ? <Ionicons name="checkmark" size={14} color={Colors.white} />
            : <Text style={styles.stopNummerTekst}>{volgorde}</Text>}
        </View>
        {!afgerond && (
          <View style={styles.volgordeKnoppen}>
            <TouchableOpacity onPress={onOmhoog} disabled={!kanOmhoog} activeOpacity={0.7}
              style={[styles.volgordeKnop, !kanOmhoog && { opacity: 0.2 }]}>
              <Ionicons name="chevron-up" size={14} color={Colors.textMedium} />
            </TouchableOpacity>
            <TouchableOpacity onPress={onOmlaag} disabled={!kanOmlaag} activeOpacity={0.7}
              style={[styles.volgordeKnop, !kanOmlaag && { opacity: 0.2 }]}>
              <Ionicons name="chevron-down" size={14} color={Colors.textMedium} />
            </TouchableOpacity>
          </View>
        )}
      </View>

      <TouchableOpacity style={styles.kaartInhoud} onPress={onPress} activeOpacity={0.8}>
        <View style={styles.kaartBovenRij}>
          <View style={[styles.typeBadge, { backgroundColor: typekleur.bg }]}>
            <Text style={[styles.typeBadgeTekst, { color: typekleur.text }]}>
              {TYPENAAM[opdracht.type]}
            </Text>
          </View>
          <View style={styles.prioWrapper}>
            {(opdracht.urgent || opdracht.prioriteit === 1) && (
              <View style={styles.urgentBadge}>
                <Ionicons name="flash" size={11} color="#fff" />
                <Text style={styles.urgentTekst}>Urgent</Text>
              </View>
            )}
            <View style={[styles.prioDot, { backgroundColor: prioDot(opdracht.prioriteit, opdracht.urgent) }]} />
          </View>
        </View>

        <Text style={[styles.locatieNaam, afgerond && styles.locatieNaamAfgerond]}>
          {opdracht.locatie}
        </Text>

        {opdracht.tijdStart && (
          <View style={styles.tijdRij}>
            <Ionicons name="time-outline" size={12} color={opdracht.tijdVastzetten ? Colors.amber : Colors.textLight} />
            <Text style={[styles.tijdTekst, opdracht.tijdVastzetten && styles.tijdTekstVast]}>
              {opdracht.tijdStart}{opdracht.tijdEind ? ` – ${opdracht.tijdEind}` : ''}
            </Text>
            {opdracht.tijdVastzetten && (
              <Ionicons name="lock-closed" size={11} color={Colors.amber} style={{ marginLeft: 2 }} />
            )}
          </View>
        )}

        <View style={styles.adresRij}>
          <Ionicons name="location-outline" size={13} color={Colors.textLight} />
          <Text style={styles.adresTekst}>{opdracht.adres}, {opdracht.postcode} {opdracht.stad}</Text>
        </View>

        <View style={styles.infoRij}>
          {opdracht.voertuigen.length > 0 && (
            <View style={styles.infoPil}>
              <Ionicons name="bicycle-outline" size={12} color={Colors.textMedium} />
              <Text style={styles.infoPilTekst}>{opdracht.voertuigen.length} voertuig{opdracht.voertuigen.length !== 1 ? 'en' : ''}</Text>
            </View>
          )}
          {opdracht.deadline && (
            <View style={[styles.infoPil, styles.infoPilWaarschuwing]}>
              <Ionicons name="calendar-outline" size={12} color="#92400E" />
              <Text style={[styles.infoPilTekst, { color: '#92400E' }]}>Deadline {opdracht.deadline}</Text>
            </View>
          )}
          {opdracht.pechStops && (
            <View style={[styles.infoPil, { backgroundColor: '#FEE2E2' }]}>
              <Ionicons name="flash-outline" size={12} color="#991B1B" />
              <Text style={[styles.infoPilTekst, { color: '#991B1B' }]}>{opdracht.pechStops.length} pechhulp-stops</Text>
            </View>
          )}
        </View>

        {!afgerond && (
          <View style={styles.actieRij}>
            <TouchableOpacity style={styles.navigeerKnop} onPress={onNavigeer} activeOpacity={0.8}>
              <Ionicons name="navigate-outline" size={15} color={Colors.green} />
              <Text style={styles.navigeerKnopTekst}>Navigeren</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.detailKnop} onPress={onPress} activeOpacity={0.8}>
              <Text style={styles.detailKnopTekst}>Open opdracht</Text>
              <Ionicons name="chevron-forward" size={15} color={Colors.amber} />
            </TouchableOpacity>
          </View>
        )}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    backgroundColor: Colors.green,
    paddingHorizontal: 20,
    paddingBottom: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  headerGroet: { fontSize: 20, fontWeight: '800', color: Colors.white, marginBottom: 2 },
  headerDatum: { fontSize: 13, color: 'rgba(255,255,255,0.6)', textTransform: 'capitalize' },
  headerBadge: { alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 8 },
  headerBadgeTekst: { fontSize: 22, fontWeight: '900', color: Colors.amber },
  headerBadgeSub: { fontSize: 10, color: 'rgba(255,255,255,0.6)', marginTop: -2 },

  dagKaart: {
    backgroundColor: Colors.green,
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    shadowColor: Colors.green,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  dagKaartRij: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 14 },
  dagStat: { alignItems: 'center', gap: 4 },
  dagStatGetal: { fontSize: 22, fontWeight: '900', color: Colors.white },
  dagStatLabel: { fontSize: 11, color: 'rgba(255,255,255,0.55)', textTransform: 'uppercase', letterSpacing: 0.5 },
  dagStatScheidslijn: { width: 1, backgroundColor: 'rgba(255,255,255,0.2)', marginVertical: 4 },
  navigeerStartKnop: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, backgroundColor: Colors.amber, borderRadius: 12, paddingVertical: 12,
  },
  navigeerStartTekst: { fontSize: 14, fontWeight: '700', color: Colors.textDark },

  sectionTitel: { fontSize: 12, fontWeight: '700', color: Colors.textLight, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 },

  laadContainer: { alignItems: 'center', paddingVertical: 40, gap: 12 },
  laadTekst: { fontSize: 14, color: Colors.textLight },
  leegContainer: { alignItems: 'center', paddingVertical: 48, gap: 10 },
  leegTekst: { fontSize: 14, color: Colors.textLight },

  kaart: { flexDirection: 'row', marginBottom: 4, paddingLeft: 8 },
  kaartAfgerond: { opacity: 0.55 },
  connectorLijn: {
    position: 'absolute', left: 19, top: 36, bottom: -8,
    width: 2, backgroundColor: Colors.border, zIndex: 0,
  },
  stopLinks: { alignItems: 'center', marginRight: 10, zIndex: 1 },
  stopNummer: {
    width: 28, height: 28, borderRadius: 14, backgroundColor: Colors.green,
    alignItems: 'center', justifyContent: 'center', marginTop: 14, flexShrink: 0,
  },
  stopNummerAfgerond: { backgroundColor: Colors.textLight },
  stopNummerTekst: { fontSize: 12, fontWeight: '800', color: Colors.white },
  volgordeKnoppen: { marginTop: 4, gap: 2 },
  volgordeKnop: { padding: 2, alignItems: 'center', justifyContent: 'center' },
  kaartInhoud: {
    flex: 1, backgroundColor: Colors.white, borderRadius: 14, padding: 14,
    marginBottom: 8, borderWidth: 1, borderColor: Colors.border,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 4, elevation: 1,
  },
  kaartBovenRij: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  typeBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  typeBadgeTekst: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.3 },
  prioWrapper: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  urgentBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: Colors.prio1, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  urgentTekst: { fontSize: 10, fontWeight: '700', color: Colors.white },
  prioDot: { width: 8, height: 8, borderRadius: 4 },
  locatieNaam: { fontSize: 16, fontWeight: '700', color: Colors.textDark, marginBottom: 4 },
  locatieNaamAfgerond: { color: Colors.textLight },
  tijdRij: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 6 },
  tijdTekst: { fontSize: 12, color: Colors.textMedium, fontWeight: '500' },
  tijdTekstVast: { color: Colors.amber, fontWeight: '700' },
  adresRij: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 8 },
  adresTekst: { fontSize: 12, color: Colors.textLight, flex: 1 },
  infoRij: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 10 },
  infoPil: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: Colors.background, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  infoPilWaarschuwing: { backgroundColor: '#FEF3D6' },
  infoPilTekst: { fontSize: 11, color: Colors.textMedium, fontWeight: '500' },
  actieRij: { flexDirection: 'row', gap: 8, borderTopWidth: 1, borderTopColor: Colors.border, paddingTop: 10 },
  navigeerKnop: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 5, borderWidth: 1.5, borderColor: Colors.green, borderRadius: 10, paddingVertical: 8,
  },
  navigeerKnopTekst: { fontSize: 13, fontWeight: '600', color: Colors.green },
  detailKnop: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 5, backgroundColor: Colors.greenLight, borderRadius: 10, paddingVertical: 8,
  },
  detailKnopTekst: { fontSize: 13, fontWeight: '600', color: Colors.green },
});
