'use client';
import { useState, useEffect } from 'react';
import { ScrollView, View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase, dbToOpdracht } from '@/lib/supabase';
import { monteur } from '@/lib/mock-data';
import { Colors } from '@/lib/colors';
import type { Opdracht } from '@/lib/types';

const TYPENAAM: Record<string, string> = {
  onderhoud: 'Onderhoud', reparatie: 'Reparatie', accu: 'Accu',
  plaatsen: 'Plaatsen', terughalen: 'Terughalen', evaluatie: 'Evaluatie',
  voertuigruil: 'Voertuigruil', pechhulp: 'Pechhulp',
};

const DAGLETTERS = ['Ma', 'Di', 'Wo', 'Do', 'Vr', 'Za', 'Zo'];

function weekGrenzen(): { ma: string; zo: string } {
  const nu = new Date();
  const dag = nu.getDay(); // 0=zo, 1=ma, ...
  const diffNaarMa = (dag === 0 ? -6 : 1 - dag);
  const ma = new Date(nu);
  ma.setDate(nu.getDate() + diffNaarMa);
  const zo = new Date(ma);
  zo.setDate(ma.getDate() + 6);
  return {
    ma: ma.toISOString().split('T')[0],
    zo: zo.toISOString().split('T')[0],
  };
}

function formatDagHeader(datum: string): string {
  const d = new Date(datum + 'T12:00:00');
  return d.toLocaleDateString('nl-NL', { weekday: 'long', day: 'numeric', month: 'long' });
}

function isVandaag(datum: string): boolean {
  return datum === new Date().toISOString().split('T')[0];
}

export default function OpdrachtenScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [opdrachtenPerDag, setOpdrachtenPerDag] = useState<Record<string, Opdracht[]>>({});
  const [laden, setLaden] = useState(true);
  const [geselecteerdeDatum, setGeselecteerdeDatum] = useState<string | null>(null);
  const [afgerondOpen, setAfgerondOpen] = useState<Record<string, boolean>>({});

  const { ma, zo } = weekGrenzen();

  useEffect(() => {
    laadWeek();

    const channel = supabase
      .channel('week-monteur')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'opdrachten' }, laadWeek)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'voertuigen' }, laadWeek)
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  async function laadWeek() {
    const { data } = await supabase
      .from('opdrachten')
      .select('*, voertuigen(*), pech_stops(*)')
      .eq('monteur_id', monteur.id)
      .gte('datum', ma)
      .lte('datum', zo)
      .is('deleted_at', null)
      .order('datum', { ascending: true });

    if (data) {
      const gegroepeerd: Record<string, Opdracht[]> = {};
      for (const row of data) {
        const d = row.datum as string;
        if (!gegroepeerd[d]) gegroepeerd[d] = [];
        gegroepeerd[d].push(dbToOpdracht(row));
      }
      setOpdrachtenPerDag(gegroepeerd);
    }
    setLaden(false);
  }

  const datums = Object.keys(opdrachtenPerDag).sort();
  const gefilterdeData = geselecteerdeDatum
    ? (opdrachtenPerDag[geselecteerdeDatum] ? { [geselecteerdeDatum]: opdrachtenPerDag[geselecteerdeDatum] } : {})
    : opdrachtenPerDag;

  const totalOpdrachten = datums.reduce((t, d) => t + opdrachtenPerDag[d].length, 0);
  const totalUitgevoerd = datums.reduce(
    (t, d) => t + opdrachtenPerDag[d].filter((o) => o.status === 'uitgevoerd').length,
    0,
  );
  const pct = totalOpdrachten > 0 ? Math.round((totalUitgevoerd / totalOpdrachten) * 100) : 0;

  return (
    <View style={{ flex: 1, backgroundColor: Colors.background }}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <View>
          <Text style={styles.headerTitel}>Weekoverzicht</Text>
          <Text style={styles.headerSub}>{totalUitgevoerd} van {totalOpdrachten} opdrachten afgerond</Text>
        </View>
        <View style={styles.voortgangBadge}>
          <Text style={styles.voortgangTekst}>{pct}%</Text>
        </View>
      </View>

      {/* Dag filter */}
      {datums.length > 0 && (
        <View style={styles.dagFilterRij}>
          <TouchableOpacity
            style={[styles.dagChip, !geselecteerdeDatum && styles.dagChipActief]}
            onPress={() => setGeselecteerdeDatum(null)}
          >
            <Text style={[styles.dagChipTekst, !geselecteerdeDatum && styles.dagChipTekstActief]}>Alle</Text>
          </TouchableOpacity>
          {datums.map((datum) => {
            const d = new Date(datum + 'T12:00:00');
            const letter = DAGLETTERS[d.getDay() === 0 ? 6 : d.getDay() - 1];
            const vandaag = isVandaag(datum);
            const actief = geselecteerdeDatum === datum;
            return (
              <TouchableOpacity
                key={datum}
                style={[styles.dagChip, actief && styles.dagChipActief, vandaag && !actief && styles.dagChipVandaag]}
                onPress={() => setGeselecteerdeDatum(actief ? null : datum)}
              >
                <Text style={[styles.dagChipLetterKlein, actief && styles.dagChipTekstActief, vandaag && !actief && { color: Colors.green }]}>
                  {letter}
                </Text>
                <Text style={[styles.dagChipGetal, actief && styles.dagChipTekstActief, vandaag && !actief && { color: Colors.green }]}>
                  {d.getDate()}
                </Text>
                {vandaag && <View style={[styles.vandaagDot, actief && { backgroundColor: Colors.white }]} />}
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      {laden ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color={Colors.green} />
        </View>
      ) : totalOpdrachten === 0 ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          <Ionicons name="calendar-outline" size={48} color={Colors.textLight} />
          <Text style={{ fontSize: 15, color: Colors.textLight, fontWeight: '600' }}>Geen opdrachten deze week</Text>
        </View>
      ) : (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
          showsVerticalScrollIndicator={false}
        >
          {Object.keys(gefilterdeData)
            .sort()
            .map((datum) => {
              const ops = gefilterdeData[datum];
              const aantalAfgerond = ops.filter((o) => o.status === 'uitgevoerd').length;
              const vandaag = isVandaag(datum);

              return (
                <View key={datum} style={styles.dagBlok}>
                  <View style={styles.dagHeaderRij}>
                    <View style={styles.dagHeaderLinks}>
                      {vandaag && (
                        <View style={styles.vandaagBadge}>
                          <Text style={styles.vandaagBadgeTekst}>Vandaag</Text>
                        </View>
                      )}
                      <Text style={[styles.dagTitel, vandaag && { color: Colors.green }]}>
                        {formatDagHeader(datum)}
                      </Text>
                    </View>
                    <Text style={styles.dagTeller}>{aantalAfgerond}/{ops.length}</Text>
                  </View>

                  {ops
                    .filter((o) => o.status !== 'uitgevoerd')
                    .sort((a, b) => a.routeVolgorde - b.routeVolgorde)
                    .map((opdracht) => (
                      <OpdrachtRij
                        key={opdracht.id}
                        opdracht={opdracht}
                        onPress={() => router.push(`/opdracht/${opdracht.id}`)}
                      />
                    ))}

                  {/* Afgerond dropdown per dag */}
                  {ops.filter((o) => o.status === 'uitgevoerd').length > 0 && (
                    <>
                      <TouchableOpacity
                        style={styles.afgerondKop}
                        onPress={() => setAfgerondOpen((p) => ({ ...p, [datum]: !p[datum] }))}
                        activeOpacity={0.8}
                      >
                        <Ionicons
                          name={afgerondOpen[datum] ? 'chevron-down' : 'chevron-forward'}
                          size={14}
                          color={Colors.textLight}
                        />
                        <Ionicons name="checkmark-circle" size={14} color={Colors.amber} />
                        <Text style={styles.afgerondKopTekst}>
                          Afgerond ({ops.filter((o) => o.status === 'uitgevoerd').length})
                        </Text>
                      </TouchableOpacity>
                      {afgerondOpen[datum] && ops
                        .filter((o) => o.status === 'uitgevoerd')
                        .map((opdracht) => (
                          <OpdrachtRij
                            key={opdracht.id}
                            opdracht={opdracht}
                            onPress={() => router.push(`/opdracht/${opdracht.id}`)}
                          />
                        ))}
                    </>
                  )}
                </View>
              );
            })}
        </ScrollView>
      )}
    </View>
  );
}

function OpdrachtRij({ opdracht, onPress }: { opdracht: Opdracht; onPress: () => void }) {
  const typekleur = Colors.typeKleuren[opdracht.type] ?? { bg: '#F3F4F6', text: '#374151' };
  const afgerond = opdracht.status === 'uitgevoerd';

  return (
    <TouchableOpacity
      style={[styles.rij, afgerond && styles.rijAfgerond]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <View style={[styles.statusBalk, { backgroundColor: afgerond ? Colors.textLight : Colors.green }]} />

      <View style={styles.rijInhoud}>
        <View style={styles.rijBovenRij}>
          <View style={[styles.typeBadge, { backgroundColor: typekleur.bg }]}>
            <Text style={[styles.typeBadgeTekst, { color: typekleur.text }]}>
              {TYPENAAM[opdracht.type]}
            </Text>
          </View>
          <View style={styles.rijRechts}>
            {(opdracht.urgent || opdracht.prioriteit === 1) && (
              <Ionicons name="flash" size={14} color={Colors.prio1} />
            )}
            {afgerond && <Ionicons name="checkmark-circle" size={16} color={Colors.amber} />}
            <Ionicons name="chevron-forward" size={14} color={Colors.textLight} />
          </View>
        </View>

        <Text style={[styles.locatieNaam, afgerond && { color: Colors.textLight }]}>
          {opdracht.locatie}
        </Text>

        <View style={styles.rijInfoRij}>
          <View style={styles.rijInfoItem}>
            <Ionicons name="location-outline" size={12} color={Colors.textLight} />
            <Text style={styles.rijInfoTekst} numberOfLines={1}>{opdracht.stad}</Text>
          </View>
          {opdracht.voertuigen.length > 0 && (
            <View style={styles.rijInfoItem}>
              <Ionicons name="bicycle-outline" size={12} color={Colors.textLight} />
              <Text style={styles.rijInfoTekst}>{opdracht.voertuigen.length}</Text>
            </View>
          )}
          <Text style={styles.rijId}>{opdracht.id}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  header: {
    backgroundColor: Colors.green,
    paddingHorizontal: 20,
    paddingBottom: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  headerTitel: { fontSize: 20, fontWeight: '800', color: Colors.white },
  headerSub: { fontSize: 12, color: 'rgba(255,255,255,0.6)', marginTop: 2 },
  voortgangBadge: {
    backgroundColor: Colors.amber,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  voortgangTekst: { fontSize: 16, fontWeight: '900', color: Colors.textDark },

  dagFilterRij: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: Colors.white,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  dagChip: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: Colors.background,
    minWidth: 40,
    position: 'relative',
  },
  dagChipActief: { backgroundColor: Colors.green },
  dagChipVandaag: { borderWidth: 1.5, borderColor: Colors.green, backgroundColor: Colors.greenLight },
  dagChipLetterKlein: { fontSize: 10, color: Colors.textLight, fontWeight: '600', textTransform: 'uppercase' },
  dagChipGetal: { fontSize: 15, fontWeight: '800', color: Colors.textDark },
  dagChipTekst: { fontSize: 13, fontWeight: '700', color: Colors.textMedium },
  dagChipTekstActief: { color: Colors.white },
  vandaagDot: {
    width: 4, height: 4, borderRadius: 2,
    backgroundColor: Colors.green, marginTop: 2,
  },

  dagBlok: { marginBottom: 20 },
  afgerondKop: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8, paddingHorizontal: 4, marginTop: 4 },
  afgerondKopTekst: { fontSize: 12, fontWeight: '600', color: Colors.textLight },
  dagHeaderRij: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  dagHeaderLinks: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dagTitel: { fontSize: 13, fontWeight: '700', color: Colors.textMedium, textTransform: 'capitalize' },
  dagTeller: { fontSize: 12, color: Colors.textLight, fontWeight: '600' },
  vandaagBadge: { backgroundColor: Colors.green, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  vandaagBadgeTekst: { fontSize: 10, fontWeight: '700', color: Colors.white, textTransform: 'uppercase' },

  rij: {
    flexDirection: 'row',
    backgroundColor: Colors.white,
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  rijAfgerond: { opacity: 0.6 },
  statusBalk: { width: 4 },
  rijInhoud: { flex: 1, padding: 12 },
  rijBovenRij: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  typeBadge: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6 },
  typeBadgeTekst: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.3 },
  rijRechts: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  locatieNaam: { fontSize: 14, fontWeight: '700', color: Colors.textDark, marginBottom: 4 },
  rijInfoRij: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  rijInfoItem: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  rijInfoTekst: { fontSize: 11, color: Colors.textLight },
  rijId: { fontSize: 11, color: Colors.textLight, marginLeft: 'auto' as any },
});
