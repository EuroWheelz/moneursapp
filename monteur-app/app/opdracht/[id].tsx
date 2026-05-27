import { useState, useEffect } from 'react';
import {
  ScrollView, View, Text, TouchableOpacity, StyleSheet,
  Linking, Platform, Alert, ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase, dbToOpdracht } from '@/lib/supabase';
import { Colors } from '@/lib/colors';
import type { Opdracht } from '@/lib/types';

const TYPENAAM: Record<string, string> = {
  onderhoud: 'Onderhoud', reparatie: 'Reparatie', accu: 'Accu',
  plaatsen: 'Plaatsen', terughalen: 'Terughalen', evaluatie: 'Evaluatie',
  voertuigruil: 'Voertuigruil', pechhulp: 'Pechhulp',
};

const PECHNAAM: Record<string, string> = {
  lekke_band: 'Lekke band', mechanisch: 'Mechanisch probleem', lege_accu: 'Lege accu',
};

export default function OpdrachtDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [opdracht, setOpdracht] = useState<Opdracht | null>(null);
  const [laden, setLaden] = useState(true);
  const [bevestigStart, setBevestigStart] = useState(false);

  useEffect(() => {
    laadOpdracht();
  }, [id]);

  async function laadOpdracht() {
    setLaden(true);
    const { data } = await supabase
      .from('opdrachten')
      .select('*, voertuigen(*), pech_stops(*)')
      .eq('id', id)
      .single();

    if (data) setOpdracht(dbToOpdracht(data));
    setLaden(false);
  }

  async function updateStatus(nieuwStatus: 'ingepland' | 'onderweg' | 'uitgevoerd') {
    const { error } = await supabase
      .from('opdrachten')
      .update({ status: nieuwStatus, updated_at: new Date().toISOString() })
      .eq('id', id);
    if (error) {
      Alert.alert('Fout', 'Status kon niet worden bijgewerkt. Probeer opnieuw.');
      return;
    }
    setOpdracht((prev) => prev ? { ...prev, status: nieuwStatus } : prev);
  }

  const navigeerNaar = () => {
    if (!opdracht) return;
    const q = encodeURIComponent(`${opdracht.adres}, ${opdracht.postcode} ${opdracht.stad}`);
    const url = Platform.OS === 'ios'
      ? `maps://?daddr=${q}`
      : `https://www.google.com/maps/dir/?api=1&destination=${q}`;
    Linking.openURL(url);
  };

  const belContact = () => {
    if (opdracht?.telefoon) Linking.openURL(`tel:${opdracht.telefoon}`);
  };

  const startOpdracht = () => setBevestigStart(true);

  if (laden) {
    return (
      <View style={styles.leeg}>
        <ActivityIndicator color={Colors.green} size="large" />
      </View>
    );
  }

  if (!opdracht) {
    return (
      <View style={styles.leeg}>
        <Ionicons name="alert-circle-outline" size={40} color={Colors.textLight} />
        <Text style={styles.leegTekst}>Opdracht niet gevonden</Text>
      </View>
    );
  }

  const typekleur = Colors.typeKleuren[opdracht.type] ?? { bg: '#F3F4F6', text: '#374151' };

  return (
    <View style={{ flex: 1, backgroundColor: Colors.background }}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero */}
        <View style={[styles.heroBanner, { backgroundColor: typekleur.bg }]}>
          <View style={styles.heroBinnen}>
            <View style={[styles.typePil, { backgroundColor: typekleur.text }]}>
              <Text style={styles.typePilTekst}>{TYPENAAM[opdracht.type]}</Text>
            </View>
            {opdracht.urgent && (
              <View style={styles.urgentPil}>
                <Ionicons name="flash" size={12} color="#fff" />
                <Text style={styles.urgentTekst}>Urgent</Text>
              </View>
            )}
          </View>
          <Text style={[styles.heroLocatie, { color: typekleur.text }]}>{opdracht.locatie}</Text>
        </View>

        <View style={{ padding: 16, gap: 12 }}>
          <StatusFlow huidig={opdracht.status} />

          {/* Locatie */}
          <InfoKaart>
            <InfoRij icoon="location" label="Adres">
              {opdracht.adres}, {opdracht.postcode} {opdracht.stad}
            </InfoRij>
            <TouchableOpacity style={styles.navigeerKnop} onPress={navigeerNaar} activeOpacity={0.8}>
              <Ionicons name="navigate" size={16} color={Colors.textDark} />
              <Text style={styles.navigeerTekst}>Navigeer naar locatie</Text>
            </TouchableOpacity>
          </InfoKaart>

          {/* Contact */}
          <InfoKaart titel="Contact">
            <InfoRij icoon="person" label="Contactpersoon">{opdracht.contactpersoon}</InfoRij>
            <InfoRij icoon="call" label="Telefoon">{opdracht.telefoon}</InfoRij>
            <TouchableOpacity style={styles.belKnop} onPress={belContact} activeOpacity={0.8}>
              <Ionicons name="call" size={16} color={Colors.green} />
              <Text style={styles.belTekst}>Bellen</Text>
            </TouchableOpacity>
          </InfoKaart>

          {/* Notitie */}
          {!!opdracht.notitie && (
            <InfoKaart>
              <View style={styles.notitieRij}>
                <Ionicons name="document-text-outline" size={16} color={Colors.amber} />
                <Text style={styles.notitieTekst}>{opdracht.notitie}</Text>
              </View>
            </InfoKaart>
          )}

          {/* Type-specifiek */}
          {opdracht.type === 'onderhoud' && <OnderhoudInfo opdracht={opdracht} />}
          {opdracht.type === 'reparatie' && <ReparatieInfo opdracht={opdracht} />}
          {opdracht.type === 'accu' && <AccuInfo opdracht={opdracht} />}
          {(opdracht.type === 'plaatsen' || opdracht.type === 'terughalen') && <PlaatsenInfo opdracht={opdracht} />}
          {opdracht.type === 'pechhulp' && <PechhulpInfo opdracht={opdracht} />}
        </View>
      </ScrollView>

      {/* Bottom actiebalk */}
      <View style={[styles.actieBalk, { paddingBottom: insets.bottom + 12 }]}>
        {opdracht.status === 'ingepland' && !bevestigStart && (
          <TouchableOpacity style={styles.startKnop} onPress={startOpdracht} activeOpacity={0.85}>
            <Ionicons name="play-circle" size={20} color={Colors.textDark} />
            <Text style={styles.startTekst}>Start opdracht</Text>
          </TouchableOpacity>
        )}
        {opdracht.status === 'ingepland' && bevestigStart && (
          <View style={styles.bevestigWrap}>
            <Text style={styles.bevestigTekst}>{'Status wordt bijgewerkt naar "Onderweg"'}</Text>
            <View style={styles.bevestigKnoppen}>
              <TouchableOpacity
                style={styles.annuleerKnop}
                onPress={() => setBevestigStart(false)}
                activeOpacity={0.8}
              >
                <Text style={styles.annuleerTekst}>Annuleren</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.bevestigKnop}
                onPress={() => { setBevestigStart(false); updateStatus('onderweg'); }}
                activeOpacity={0.85}
              >
                <Ionicons name="play-circle" size={18} color={Colors.textDark} />
                <Text style={styles.bevestigKnopTekst}>Bevestig start</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
        {opdracht.status === 'onderweg' && (
          <TouchableOpacity
            style={styles.afwikkelenKnop}
            onPress={() => router.push(`/opdracht/${id}/afwikkelen`)}
            activeOpacity={0.85}
          >
            <Ionicons name="checkmark-circle" size={20} color={Colors.white} />
            <Text style={styles.afwikkelenTekst}>Opdracht afwikkelen</Text>
          </TouchableOpacity>
        )}
        {opdracht.status === 'uitgevoerd' && (
          <View style={styles.afgesloten}>
            <Ionicons name="checkmark-circle" size={20} color={Colors.textLight} />
            <Text style={styles.afgeslotenTekst}>Opdracht ingediend — wacht op akkoord</Text>
          </View>
        )}
      </View>
    </View>
  );
}

/* ── Status flow ──────────────────────────────────────────── */
function StatusFlow({ huidig }: { huidig: string }) {
  const stappen = ['ingepland', 'onderweg', 'uitgevoerd'];
  const labels = ['Ingepland', 'Onderweg', 'Afgerond'];
  const huidigIdx = stappen.indexOf(huidig);

  return (
    <View style={statusStyles.wrapper}>
      {stappen.map((stap, idx) => {
        const actief = idx === huidigIdx;
        const geweest = idx < huidigIdx;
        return (
          <View key={stap} style={{ flex: 1, alignItems: 'center' }}>
            <View style={[statusStyles.cirkel, geweest && statusStyles.cirkelGeweest, actief && statusStyles.cirkelActief]}>
              {geweest
                ? <Ionicons name="checkmark" size={12} color={Colors.white} />
                : <Text style={[statusStyles.cirkelTekst, actief && { color: Colors.textDark }]}>{idx + 1}</Text>}
            </View>
            <Text style={[statusStyles.label, actief && statusStyles.labelActief, geweest && statusStyles.labelGeweest]}>
              {labels[idx]}
            </Text>
            {idx < stappen.length - 1 && (
              <View style={[statusStyles.lijn, geweest && statusStyles.lijnGeweest]} />
            )}
          </View>
        );
      })}
    </View>
  );
}

/* ── Type-specifieke secties ──────────────────────────────── */
function OnderhoudInfo({ opdracht }: { opdracht: Opdracht }) {
  return (
    <InfoKaart titel={`Voertuigen (${opdracht.voertuigen.length})`}>
      {opdracht.voertuigen.map((v) => (
        <View key={v.kenteken} style={styles.voertuigRijBig}>
          <View style={[styles.voertuigKleur, { backgroundColor: v.kleur ?? '#9CA3AF' }]} />
          <View style={{ flex: 1 }}>
            <View style={styles.voertuigKentekenRij}>
              <Text style={styles.voertuigKentekenBig}>{v.kenteken}</Text>
              {v.meldcode ? <Text style={styles.meldcodeTekst}>{v.meldcode}</Text> : null}
              {v.model ? <Text style={styles.modelTekst}>{v.model}</Text> : null}
            </View>
            {v.probleem ? (
              <View style={styles.notitiePil}>
                <Ionicons name="warning-outline" size={11} color="#B45309" />
                <Text style={styles.notitiePilTekst}>{v.probleem}</Text>
              </View>
            ) : null}
            {v.opmerking ? (
              <Text style={styles.opmerkingTekst}>{v.opmerking}</Text>
            ) : null}
          </View>
        </View>
      ))}
      <Text style={styles.checklistHint}>✓ Afvinken & onderdelen registreren in het afwikkelen-scherm</Text>
    </InfoKaart>
  );
}

function ReparatieInfo({ opdracht }: { opdracht: Opdracht }) {
  return (
    <InfoKaart titel="Te repareren">
      {opdracht.voertuigen.length === 0 ? (
        <Text style={styles.neutraleTekst}>Kenteken nog niet bepaald — geef aan bij afwikkelen.</Text>
      ) : (
        opdracht.voertuigen.map((v: any) => (
          <View key={v.kenteken} style={styles.reparatieRij}>
            <View style={[styles.voertuigKleur, { backgroundColor: v.kleur }]} />
            <View style={{ flex: 1 }}>
              <Text style={styles.voertuigKenteken}>{v.kenteken}</Text>
              {v.probleem ? (
                <Text style={styles.probleemTekst}>{v.probleem}</Text>
              ) : null}
            </View>
          </View>
        ))
      )}
    </InfoKaart>
  );
}

function AccuInfo(_: { opdracht: Opdracht }) {
  return (
    <InfoKaart titel="Accu-opdracht">
      <View style={styles.accuRij}>
        <View style={styles.accuBlok}>
          <Text style={styles.accuLabel}>Huidige situatie</Text>
          <Text style={styles.accuWaarde}>8× 20Ah</Text>
        </View>
        <Ionicons name="arrow-forward" size={20} color={Colors.amber} />
        <View style={styles.accuBlok}>
          <Text style={styles.accuLabel}>Nieuwe situatie</Text>
          <Text style={[styles.accuWaarde, { color: Colors.green }]}>6× 30Ah</Text>
        </View>
      </View>
      <Text style={styles.neutraleTekst}>Oude accu&apos;s meenemen naar loods.</Text>
    </InfoKaart>
  );
}

function PlaatsenInfo({ opdracht }: { opdracht: Opdracht }) {
  return (
    <InfoKaart titel={`Voertuigen om te ${opdracht.type === 'plaatsen' ? 'plaatsen' : 'terughalen'} (${opdracht.voertuigen.length})`}>
      {opdracht.voertuigen.map((v) => (
        <View key={v.kenteken} style={styles.voertuigRijBig}>
          <View style={[styles.voertuigKleur, { backgroundColor: v.kleur ?? '#9CA3AF' }]} />
          <View style={{ flex: 1 }}>
            <View style={styles.voertuigKentekenRij}>
              <Text style={styles.voertuigKentekenBig}>{v.kenteken}</Text>
              {v.meldcode ? <Text style={styles.meldcodeTekst}>{v.meldcode}</Text> : null}
              {v.model ? <Text style={styles.modelTekst}>{v.model}</Text> : null}
            </View>
            {v.opmerking ? <Text style={styles.opmerkingTekst}>{v.opmerking}</Text> : null}
          </View>
        </View>
      ))}
    </InfoKaart>
  );
}

function PechhulpInfo({ opdracht }: { opdracht: Opdracht }) {
  return (
    <>
      {opdracht.sleutelOphalen && (
        <InfoKaart>
          <View style={styles.notitieRij}>
            <Ionicons name="key-outline" size={16} color={Colors.amber} />
            <Text style={styles.notitieTekst}>Stop 1: Sleutel ophalen bij {opdracht.locatie} voor je vertrekt.</Text>
          </View>
        </InfoKaart>
      )}
      <InfoKaart titel={`Pech-stops (${opdracht.pechStops?.length ?? 0})`}>
        {opdracht.pechStops?.map((stop, idx) => (
          <View key={stop.id} style={styles.pechStopKaart}>
            <View style={styles.pechStopHeader}>
              <View style={styles.pechStopNummer}>
                <Text style={styles.pechStopNummerTekst}>{opdracht.sleutelOphalen ? idx + 2 : idx + 1}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.pechStopAdres}>{stop.adres}</Text>
                <View style={styles.pechTypePil}>
                  <Ionicons name="warning-outline" size={11} color="#991B1B" />
                  <Text style={styles.pechTypeTekst}>{PECHNAAM[stop.pechType]}</Text>
                </View>
              </View>
            </View>
            {stop.notitie ? <Text style={styles.pechNotitie}>{stop.notitie}</Text> : null}
          </View>
        ))}
      </InfoKaart>
    </>
  );
}

/* ── Herbruikbare componenten ─────────────────────────────── */
function InfoKaart({ titel, children }: { titel?: string; children: React.ReactNode }) {
  return (
    <View style={kaartStyles.wrapper}>
      {titel && <Text style={kaartStyles.titel}>{titel}</Text>}
      {children}
    </View>
  );
}

function InfoRij({ icoon, label, children }: { icoon: string; label: string; children: React.ReactNode }) {
  return (
    <View style={kaartStyles.rij}>
      <Ionicons name={`${icoon}-outline` as any} size={15} color={Colors.textLight} style={kaartStyles.rijIcoon} />
      <View style={{ flex: 1 }}>
        <Text style={kaartStyles.rijLabel}>{label}</Text>
        <Text style={kaartStyles.rijWaarde}>{children as string}</Text>
      </View>
    </View>
  );
}

/* ── Styles ───────────────────────────────────────────────── */
const styles = StyleSheet.create({
  leeg: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  leegTekst: { fontSize: 16, color: Colors.textLight },

  heroBanner: { padding: 20, paddingTop: 16, paddingBottom: 20 },
  heroBinnen: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  typePil: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  typePilTekst: { fontSize: 12, fontWeight: '700', color: Colors.white, textTransform: 'uppercase', letterSpacing: 0.5 },
  urgentPil: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: Colors.prio1, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  urgentTekst: { fontSize: 12, fontWeight: '700', color: Colors.white },
  heroLocatie: { fontSize: 22, fontWeight: '900' },

  navigeerKnop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: Colors.amber, borderRadius: 12, paddingVertical: 12, marginTop: 12 },
  navigeerTekst: { fontSize: 14, fontWeight: '700', color: Colors.textDark },
  belKnop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderWidth: 1.5, borderColor: Colors.green, borderRadius: 12, paddingVertical: 10, marginTop: 10 },
  belTekst: { fontSize: 14, fontWeight: '600', color: Colors.green },

  notitieRij: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  notitieTekst: { flex: 1, fontSize: 14, color: Colors.textMedium, lineHeight: 20 },

  voertuigenGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  voertuigTegel: { alignItems: 'center', gap: 4, width: 72, backgroundColor: Colors.background, borderRadius: 10, padding: 8 },
  voertuigKleur: { width: 32, height: 32, borderRadius: 8 },
  voertuigKenteken: { fontSize: 9, fontWeight: '700', color: Colors.textMedium, textAlign: 'center' },

  checklistTitel: { fontSize: 12, fontWeight: '700', color: Colors.textMedium, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 },
  checklistRij: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: Colors.border },
  checklistTekst: { fontSize: 14, color: Colors.textDark },
  checklistHint: { fontSize: 11, color: Colors.textLight, marginTop: 8, fontStyle: 'italic' },

  voertuigRijBig: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: Colors.border },
  voertuigKentekenRij: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  voertuigKentekenBig: { fontSize: 14, fontWeight: '700', color: Colors.textDark },
  meldcodeTekst: { fontSize: 11, fontWeight: '700', color: Colors.green, backgroundColor: Colors.greenLight, paddingHorizontal: 6, paddingVertical: 1, borderRadius: 4 },
  modelTekst: { fontSize: 12, color: Colors.textLight },
  notitiePil: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4, backgroundColor: '#FEF3C7', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 3, alignSelf: 'flex-start' },
  notitiePilTekst: { fontSize: 11, color: '#B45309', fontWeight: '600', flex: 1 },
  opmerkingTekst: { fontSize: 12, color: Colors.textMedium, marginTop: 4, fontStyle: 'italic' },

  reparatieRij: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: Colors.border },
  probleemTekst: { fontSize: 12, color: Colors.textMedium, marginTop: 2, fontStyle: 'italic' },
  neutraleTekst: { fontSize: 13, color: Colors.textLight, marginTop: 8, fontStyle: 'italic' },

  accuRij: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', paddingVertical: 8 },
  accuBlok: { alignItems: 'center', gap: 4 },
  accuLabel: { fontSize: 11, color: Colors.textLight, textTransform: 'uppercase', letterSpacing: 0.3 },
  accuWaarde: { fontSize: 18, fontWeight: '800', color: Colors.textDark },

  pechStopKaart: { backgroundColor: Colors.background, borderRadius: 10, padding: 12, marginBottom: 8 },
  pechStopHeader: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  pechStopNummer: { width: 24, height: 24, borderRadius: 12, backgroundColor: Colors.prio1, alignItems: 'center', justifyContent: 'center' },
  pechStopNummerTekst: { fontSize: 11, fontWeight: '800', color: Colors.white },
  pechStopAdres: { fontSize: 14, fontWeight: '600', color: Colors.textDark, marginBottom: 4 },
  pechTypePil: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  pechTypeTekst: { fontSize: 11, color: '#991B1B', fontWeight: '600' },
  pechNotitie: { fontSize: 12, color: Colors.textLight, marginTop: 6, fontStyle: 'italic' },

  actieBalk: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: Colors.white, paddingHorizontal: 16, paddingTop: 12,
    borderTopWidth: 1, borderTopColor: Colors.border,
    shadowColor: '#000', shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.06, shadowRadius: 8, elevation: 6,
  },
  startKnop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: Colors.amber, borderRadius: 14, paddingVertical: 16, shadowColor: Colors.amber, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.35, shadowRadius: 8, elevation: 4 },
  startTekst: { fontSize: 16, fontWeight: '800', color: Colors.textDark },
  afwikkelenKnop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: Colors.green, borderRadius: 14, paddingVertical: 16 },
  afwikkelenTekst: { fontSize: 16, fontWeight: '800', color: Colors.white },
  afgesloten: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 16 },
  afgeslotenTekst: { fontSize: 14, color: Colors.textLight },
  bevestigWrap: { gap: 10 },
  bevestigTekst: { fontSize: 13, color: Colors.textMedium, textAlign: 'center' },
  bevestigKnoppen: { flexDirection: 'row', gap: 10 },
  annuleerKnop: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 14, borderRadius: 14, borderWidth: 1, borderColor: Colors.border },
  annuleerTekst: { fontSize: 15, fontWeight: '600', color: Colors.textMedium },
  bevestigKnop: { flex: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: Colors.amber, borderRadius: 14, paddingVertical: 14 },
  bevestigKnopTekst: { fontSize: 15, fontWeight: '800', color: Colors.textDark },
});

const statusStyles = StyleSheet.create({
  wrapper: { flexDirection: 'row', backgroundColor: Colors.white, borderRadius: 14, padding: 16, position: 'relative' },
  cirkel: { width: 24, height: 24, borderRadius: 12, backgroundColor: Colors.border, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  cirkelActief: { backgroundColor: Colors.amber },
  cirkelGeweest: { backgroundColor: Colors.green },
  cirkelTekst: { fontSize: 11, fontWeight: '700', color: Colors.textLight },
  label: { fontSize: 10, color: Colors.textLight, textAlign: 'center' },
  labelActief: { color: Colors.amber, fontWeight: '700' },
  labelGeweest: { color: Colors.green, fontWeight: '600' },
  lijn: { position: 'absolute', top: 28, right: -'50%' as unknown as number, width: '100%', height: 2, backgroundColor: Colors.border, zIndex: 0 },
  lijnGeweest: { backgroundColor: Colors.green },
});

const kaartStyles = StyleSheet.create({
  wrapper: { backgroundColor: Colors.white, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: Colors.border },
  titel: { fontSize: 12, fontWeight: '700', color: Colors.textLight, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12 },
  rij: { flexDirection: 'row', gap: 10, marginBottom: 10, alignItems: 'flex-start' },
  rijIcoon: { marginTop: 2 },
  rijLabel: { fontSize: 11, color: Colors.textLight, marginBottom: 2 },
  rijWaarde: { fontSize: 14, color: Colors.textDark, fontWeight: '500' },
});
