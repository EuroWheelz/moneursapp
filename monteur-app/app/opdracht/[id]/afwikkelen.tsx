import { useState, useEffect } from 'react';
import {
  ScrollView, View, Text, TouchableOpacity, TextInput,
  StyleSheet, Switch, ActivityIndicator, KeyboardAvoidingView, Platform, Image, Alert,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { supabase, dbToOpdracht } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { Colors } from '@/lib/colors';
import type { Opdracht, Voertuig } from '@/lib/types';

const ADMIN_URL = process.env.EXPO_PUBLIC_ADMIN_URL ?? 'http://localhost:3000';

type Onderdeel = { id: string; naam: string; categorie: string };

type VoertuigStatus = {
  kenteken: string;
  gedaan: string;
  onderdelenIds: string[];
  swapMeegenomen: boolean;
  operationeelZetten: boolean;
};

type PechStopStatus = {
  id: string;
  gevonden: boolean | null;
  kenteken: string;
  gedaan: string;
};

type ExtraVoertuig = {
  kenteken: string;
  kleur: string;
  probleem: string;
};

type VerplaatsVerzoek = {
  neerzetten: string;
  meenemen: string;
  meenemenNaar: string;
  notitie: string;
};

export default function AfwikkelenScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { monteur } = useAuth();

  const [opdracht, setOpdracht] = useState<Opdracht | null>(null);
  const [laden, setLaden] = useState(true);
  const [onderdelen, setOnderdelen] = useState<Onderdeel[]>([]);
  const [locatieVoertuigen, setLocatieVoertuigen] = useState<{ kenteken: string; kleur: string | null; meldcode?: string; model?: string }[]>([]);

  const [voertuigStatussen, setVoertuigStatussen] = useState<VoertuigStatus[]>([]);
  const [pechStatussen, setPechStatussen] = useState<PechStopStatus[]>([]);
  const [extraVoertuigen, setExtraVoertuigen] = useState<ExtraVoertuig[]>([]);

  // Verplaats verzoeken (meerdere mogelijk)
  const [verplaatsVerzoeken, setVerplaatsVerzoeken] = useState<VerplaatsVerzoek[]>([]);

  const [algemenNotitie, setAlgemeneNotitie] = useState('');
  const [vervolgVerzoek, setVervolgVerzoek] = useState(false);
  const [vervolgBeschrijving, setVervolgBeschrijving] = useState('');
  const [ingediend, setIngediend] = useState(false);
  const [bezig, setBezig] = useState(false);
  const [bevestigIndienen, setBevestigIndienen] = useState(false);

  useEffect(() => {
    laadAlles();
  }, [id]);

  async function laadAlles() {
    // Laad opdracht
    const { data: opData } = await supabase
      .from('opdrachten')
      .select('*, voertuigen(*), pech_stops(*)')
      .eq('id', id)
      .single();

    if (opData) {
      const op = dbToOpdracht(opData);
      setOpdracht(op);
      setVoertuigStatussen(op.voertuigen.map((v) => ({
        kenteken: v.kenteken, gedaan: '', onderdelenIds: [], swapMeegenomen: false, operationeelZetten: op.type === 'reparatie',
      })));
      setPechStatussen((op.pechStops ?? []).map((ps) => ({
        id: ps.id, gevonden: null, kenteken: ps.kenteken ?? '', gedaan: '',
      })));

      // Laad locatie voertuigen via relaties tabel
      const { data: relatieData } = await supabase
        .from('relaties')
        .select('id')
        .eq('naam', op.locatie)
        .single();

      if (relatieData?.id) {
        const bestaande = new Set(op.voertuigen.map((v) => v.kenteken));
        const { data: vData } = await supabase
          .from('voertuigen')
          .select('kenteken, kleur, meldcode, model')
          .eq('relatie_id', relatieData.id)
          .eq('actief', true)
          .order('kenteken');
        setLocatieVoertuigen(
          (vData ?? []).filter((v: any) => !bestaande.has(v.kenteken))
        );
      }
    }

    // Laad onderdelen catalogus
    const { data: odData } = await supabase
      .from('onderdelen')
      .select('id, naam, categorie')
      .eq('actief', true)
      .order('categorie')
      .order('naam');
    setOnderdelen((odData ?? []) as Onderdeel[]);

    setLaden(false);
  }

  const updateVoertuig = (idx: number, veld: keyof VoertuigStatus, waarde: string | boolean | string[]) => {
    setVoertuigStatussen((prev) => {
      const n = [...prev];
      n[idx] = { ...n[idx], [veld]: waarde };
      return n;
    });
  };

  const updatePech = (idx: number, veld: keyof PechStopStatus, waarde: string | boolean | null) => {
    setPechStatussen((prev) => {
      const n = [...prev];
      n[idx] = { ...n[idx], [veld]: waarde };
      return n;
    });
  };

  async function dien() {
    setBezig(true);

    // Update opdracht status
    await supabase.from('opdrachten').update({
      status: 'uitgevoerd',
      notitie: algemenNotitie || undefined,
      vervolg_verzoek: vervolgVerzoek,
      vervolg_beschrijving: vervolgVerzoek ? vervolgBeschrijving.trim() : '',
      updated_at: new Date().toISOString(),
    }).eq('id', id);

    // Sla "gedaan" tekst op per voertuig
    const gedaanUpdates = voertuigStatussen.filter((vs) => vs.gedaan.trim());
    await Promise.all(
      gedaanUpdates.map((vs) =>
        supabase.from('voertuigen').update({ gedaan: vs.gedaan.trim() })
          .eq('opdracht_id', id).eq('kenteken', vs.kenteken)
      )
    );

    // Sla gebruikte onderdelen op
    const onderdelenInserts = voertuigStatussen.flatMap((vs) =>
      vs.onderdelenIds.map((oid) => ({
        opdracht_id: id,
        onderdeel_id: oid,
        kenteken: vs.kenteken,
        aantal: 1,
      }))
    );
    if (onderdelenInserts.length > 0) {
      await supabase.from('opdracht_onderdelen').insert(onderdelenInserts);
    }

    // Sla extra voertuigen op
    if (extraVoertuigen.length > 0) {
      await supabase.from('voertuigen').insert(
        extraVoertuigen.map((ev) => ({
          opdracht_id: id,
          kenteken: ev.kenteken,
          kleur: ev.kleur || Colors.green,
          probleem: ev.probleem,
        }))
      );
    }

    // Sla verplaats verzoeken op
    const geldigeVerzoeken = verplaatsVerzoeken.filter((v) => v.neerzetten.trim() || v.meenemen.trim());
    if (geldigeVerzoeken.length > 0) {
      await supabase.from('verplaats_verzoeken').insert(
        geldigeVerzoeken.map((v) => ({
          opdracht_id: id,
          monteur_id: monteur?.id ?? null,
          locatie: opdracht?.locatie ?? '',
          neerzet_kenteken: v.neerzetten.trim() || null,
          meeneem_kenteken: v.meenemen.trim() || null,
          meeneem_naar: v.meenemenNaar.trim() || null,
          status: 'ingediend',
          notitie: v.notitie,
        }))
      );
    }

    // Update vloot status terug naar Operationeel
    if (opdracht?.type === 'reparatie') {
      const operationeelKentekens = voertuigStatussen
        .filter((vs) => vs.operationeelZetten)
        .map((vs) => vs.kenteken);
      if (operationeelKentekens.length > 0) {
        await supabase.from('voertuigen')
          .update({ object_status: 'Operationeel' })
          .in('kenteken', operationeelKentekens)
          .is('opdracht_id', null);
      }
    } else {
      const kentekens = [
        ...(opdracht?.voertuigen ?? []).map((v) => v.kenteken),
        ...extraVoertuigen.map((ev) => ev.kenteken),
      ];
      if (kentekens.length > 0) {
        const nieuweStatus = opdracht?.type === 'terughalen' ? 'In loods' : 'Operationeel';
        await supabase.from('voertuigen')
          .update({ object_status: nieuweStatus })
          .in('kenteken', kentekens)
          .is('opdracht_id', null);
      }
    }

    setBezig(false);
    setIngediend(true);
    setTimeout(() => router.replace('/(tabs)'), 1800);
  }

  if (laden) {
    return <View style={styles.leeg}><ActivityIndicator color={Colors.green} size="large" /></View>;
  }

  if (!opdracht) {
    return <View style={styles.leeg}><Text style={styles.leegTekst}>Opdracht niet gevonden</Text></View>;
  }

  if (ingediend) {
    return (
      <View style={styles.succesPagina}>
        <View style={styles.succesCircel}>
          <Ionicons name="checkmark-circle" size={64} color={Colors.green} />
        </View>
        <Text style={styles.succesTitel}>Ingediend!</Text>
        <Text style={styles.succesSub}>De beheerder beoordeelt je opdracht en stuurt de werkbon door.</Text>
      </View>
    );
  }


  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={{ flex: 1, backgroundColor: Colors.background }}>
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 100 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.sectieKop}>{opdracht.locatie}</Text>

          {/* Voertuigen */}
          {voertuigStatussen.length > 0 && (
            <>
              <Text style={styles.subKop}>Per voertuig</Text>
              {voertuigStatussen.map((vs, idx) => (
                <VoertuigKaart
                  key={vs.kenteken}
                  voertuig={opdracht.voertuigen[idx]}
                  status={vs}
                  type={opdracht.type}
                  onderdelen={onderdelen}
                  onChange={(veld, waarde) => updateVoertuig(idx, veld, waarde)}
                />
              ))}
            </>
          )}

          {opdracht.type === 'onderhoud' && <OnderhoudChecklist />}
          {opdracht.type === 'accu' && <AccuAfwikkelen />}

          {/* Pech stops */}
          {pechStatussen.length > 0 && (
            <>
              <Text style={styles.subKop}>Pech-stops</Text>
              {pechStatussen.map((ps, idx) => {
                const stop = opdracht.pechStops?.[idx];
                if (!stop) return null;
                return (
                  <PechStopKaart
                    key={ps.id}
                    stopNummer={idx + 1}
                    adres={stop.adres}
                    status={ps}
                    onChange={(veld, waarde) => updatePech(idx, veld, waarde)}
                  />
                );
              })}
            </>
          )}

          {/* Extra voertuig melden */}
          <ExtraVoertuigSectie
            locatieVoertuigen={locatieVoertuigen}
            extraVoertuigen={extraVoertuigen}
            onToevoegen={(ev) => setExtraVoertuigen((p) => [...p, ev])}
            onVerwijder={(kenteken) => setExtraVoertuigen((p) => p.filter((e) => e.kenteken !== kenteken))}
          />

          {/* Foto toevoegen */}
          <FotoSectie
            opdrachtId={id as string}
            monteurId={monteur?.id ?? ''}
            locatie={opdracht.locatie}
            bekendeKentekens={[
              ...opdracht.voertuigen.map((v) => v.kenteken),
              ...extraVoertuigen.map((e) => e.kenteken),
              ...locatieVoertuigen.map((v) => v.kenteken),
            ]}
          />

          {/* Verplaats verzoeken */}
          <VerplaatsVerzoekSectie
            locatieVoertuigen={locatieVoertuigen}
            verzoeken={verplaatsVerzoeken}
            onToevoegen={(v) => setVerplaatsVerzoeken((p) => [...p, v])}
            onVerwijder={(idx) => setVerplaatsVerzoeken((p) => p.filter((_, i) => i !== idx))}
          />

          {/* Notitie */}
          <Text style={styles.subKop}>Notitie (optioneel)</Text>
          <TextInput
            style={styles.grootTekstveld}
            multiline
            numberOfLines={3}
            placeholder="Extra opmerkingen voor de beheerder..."
            placeholderTextColor={Colors.textLight}
            value={algemenNotitie}
            onChangeText={setAlgemeneNotitie}
            textAlignVertical="top"
          />

          {/* Vervolgopdracht */}
          <View style={styles.vervolgKaart}>
            <View style={styles.vervolgKop}>
              <View style={{ flex: 1 }}>
                <Text style={styles.vervolgTitel}>+ Vervolgopdracht aanvragen?</Text>
                <Text style={styles.vervolgSub}>Stuur een verzoek naar de beheerder</Text>
              </View>
              <Switch
                value={vervolgVerzoek}
                onValueChange={setVervolgVerzoek}
                trackColor={{ false: Colors.border, true: Colors.greenLight }}
                thumbColor={vervolgVerzoek ? Colors.green : Colors.white}
              />
            </View>
            {vervolgVerzoek && (
              <TextInput
                style={[styles.grootTekstveld, { marginTop: 12 }]}
                multiline
                numberOfLines={3}
                placeholder="Beschrijf wat er nodig is en waarom je moet terugkomen..."
                placeholderTextColor={Colors.textLight}
                value={vervolgBeschrijving}
                onChangeText={setVervolgBeschrijving}
                textAlignVertical="top"
              />
            )}
          </View>
        </ScrollView>

        {/* Actie balk */}
        <View style={[styles.actieBalk, { paddingBottom: insets.bottom + 12 }]}>
          {!bevestigIndienen ? (
            <TouchableOpacity
              style={styles.indienenKnop}
              onPress={() => setBevestigIndienen(true)}
              activeOpacity={0.85}
            >
              <Ionicons name="paper-plane" size={18} color={Colors.textDark} />
              <Text style={styles.indienenTekst}>Opdracht indienen</Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.bevestigWrap}>
              <Text style={styles.bevestigTekst}>{'Opdracht markeren als "Afgerond"?'}</Text>
              <View style={styles.bevestigKnoppen}>
                <TouchableOpacity
                  style={styles.annuleerKnop}
                  onPress={() => setBevestigIndienen(false)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.annuleerTekst}>Terug</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.bevestigKnop}
                  onPress={dien}
                  disabled={bezig}
                  activeOpacity={0.85}
                >
                  {bezig
                    ? <ActivityIndicator color={Colors.textDark} size="small" />
                    : <>
                        <Ionicons name="checkmark-circle" size={18} color={Colors.textDark} />
                        <Text style={styles.bevestigKnopTekst}>Bevestig indienen</Text>
                      </>
                  }
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

/* ── Voertuig kaart met onderdelen multi-select ───────────── */
function VoertuigKaart({ voertuig, status, type, onderdelen, onChange }: {
  voertuig: Voertuig & { probleem?: string | null };
  status: VoertuigStatus;
  type: string;
  onderdelen: Onderdeel[];
  onChange: (veld: keyof VoertuigStatus, waarde: string | boolean | string[]) => void;
}) {
  const [showOnderdelen, setShowOnderdelen] = useState(false);
  const [zoek, setZoek] = useState('');

  const geselecteerdNamen = onderdelen
    .filter((o) => status.onderdelenIds.includes(o.id))
    .map((o) => o.naam);

  const gefilterd = onderdelen.filter((o) =>
    o.naam.toLowerCase().includes(zoek.toLowerCase())
  );

  // Group by category
  const groepenMap: Record<string, Onderdeel[]> = {};
  gefilterd.forEach((o) => {
    if (!groepenMap[o.categorie]) groepenMap[o.categorie] = [];
    groepenMap[o.categorie].push(o);
  });

  const toggle = (id: string) => {
    const nieuw = status.onderdelenIds.includes(id)
      ? status.onderdelenIds.filter((x) => x !== id)
      : [...status.onderdelenIds, id];
    onChange('onderdelenIds', nieuw);
  };

  return (
    <View style={styles.voertuigKaart}>
      <View style={styles.voertuigHeader}>
        <View style={[styles.voertuigKleurVlak, { backgroundColor: (voertuig as any).kleur ?? Colors.green }]} />
        <Text style={styles.voertuigKenteken}>{voertuig.kenteken}</Text>
        {(voertuig as any).probleem ? (
          <Text style={styles.probleemTekst}>{(voertuig as any).probleem}</Text>
        ) : null}
      </View>

      <Text style={styles.veldLabel}>Wat gedaan?</Text>
      <TextInput
        style={styles.tekstveld}
        multiline
        numberOfLines={2}
        placeholder="Beschrijf wat je hebt gedaan..."
        placeholderTextColor={Colors.textLight}
        value={status.gedaan}
        onChangeText={(t) => onChange('gedaan', t)}
        textAlignVertical="top"
      />

      {/* Onderdelen multi-select */}
      <Text style={styles.veldLabel}>Onderdelen gebruikt</Text>
      {geselecteerdNamen.length > 0 && (
        <View style={styles.tagsRij}>
          {geselecteerdNamen.map((naam) => (
            <View key={naam} style={styles.tag}>
              <Text style={styles.tagTekst}>{naam}</Text>
            </View>
          ))}
        </View>
      )}
      <TouchableOpacity
        style={styles.onderdelenKnop}
        onPress={() => setShowOnderdelen(!showOnderdelen)}
        activeOpacity={0.7}
      >
        <Ionicons
          name={showOnderdelen ? 'chevron-up' : 'add-circle-outline'}
          size={16}
          color={Colors.green}
        />
        <Text style={styles.onderdelenKnopTekst}>
          {showOnderdelen ? 'Verbergen' : `Selecteer onderdelen${geselecteerdNamen.length > 0 ? ` (${geselecteerdNamen.length})` : ''}`}
        </Text>
      </TouchableOpacity>

      {showOnderdelen && (
        <View style={styles.onderdelenTray}>
          <TextInput
            style={styles.zoekVeld}
            placeholder="Zoek onderdeel..."
            placeholderTextColor={Colors.textLight}
            value={zoek}
            onChangeText={setZoek}
          />
          <ScrollView
            style={styles.onderdelenScroller}
            nestedScrollEnabled
            showsVerticalScrollIndicator
            keyboardShouldPersistTaps="handled"
          >
            {onderdelen.length === 0 ? (
              <Text style={styles.geenOnderdelen}>Geen onderdelen beschikbaar</Text>
            ) : gefilterd.length === 0 ? (
              <Text style={styles.geenOnderdelen}>Geen resultaten voor "{zoek}"</Text>
            ) : (
              Object.entries(groepenMap).map(([cat, items]) => (
                <View key={cat}>
                  <Text style={styles.categorieTekst}>{cat}</Text>
                  {items.map((o) => {
                    const gesel = status.onderdelenIds.includes(o.id);
                    return (
                      <TouchableOpacity
                        key={o.id}
                        style={[styles.onderdeelRij, gesel && styles.onderdeelRijGesel]}
                        onPress={() => toggle(o.id)}
                        activeOpacity={0.7}
                      >
                        <View style={[styles.checkbox, gesel && styles.checkboxActief]}>
                          {gesel && <Ionicons name="checkmark" size={12} color={Colors.white} />}
                        </View>
                        <Text style={[styles.onderdeelNaam, gesel && styles.onderdeelNaamGesel]}>
                          {o.naam}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              ))
            )}
          </ScrollView>
          {onderdelen.length > 0 && (
            <View style={styles.trayVoet}>
              <Text style={styles.trayVoetTekst}>
                {gefilterd.length} onderdelen · scroll om meer te zien
              </Text>
            </View>
          )}
        </View>
      )}

      {type === 'reparatie' && (
        <>
          <TouchableOpacity
            style={styles.swapRij}
            onPress={() => onChange('swapMeegenomen', !status.swapMeegenomen)}
            activeOpacity={0.8}
          >
            <View style={[styles.checkbox, status.swapMeegenomen && styles.checkboxActief]}>
              {status.swapMeegenomen && <Ionicons name="checkmark" size={12} color={Colors.white} />}
            </View>
            <Text style={styles.swapTekst}>Swap e-chopper meegenomen</Text>
          </TouchableOpacity>
          <View style={styles.operationeelRij}>
            <View style={{ flex: 1 }}>
              <Text style={styles.operationeelTekst}>Zet {status.kenteken} terug op Operationeel</Text>
              <Text style={styles.operationeelSub}>Schakel uit als het voertuig nog niet klaar is</Text>
            </View>
            <Switch
              value={status.operationeelZetten}
              onValueChange={(v) => onChange('operationeelZetten', v)}
              trackColor={{ false: Colors.border, true: Colors.greenLight }}
              thumbColor={status.operationeelZetten ? Colors.green : Colors.white}
            />
          </View>
        </>
      )}
    </View>
  );
}

/* ── Extra voertuig melden ───────────────────────────────── */
function ExtraVoertuigSectie({ locatieVoertuigen, extraVoertuigen, onToevoegen, onVerwijder }: {
  locatieVoertuigen: { kenteken: string; kleur: string | null; meldcode?: string; model?: string }[];
  extraVoertuigen: ExtraVoertuig[];
  onToevoegen: (ev: ExtraVoertuig) => void;
  onVerwijder: (kenteken: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [geselecteerd, setGeselecteerd] = useState('');
  const [handmatig, setHandmatig] = useState('');
  const [probleem, setProbleem] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);

  const kenteken = geselecteerd || handmatig.trim().toUpperCase();

  function voegToe() {
    if (!kenteken) return;
    onToevoegen({ kenteken, kleur: locatieVoertuigen.find((v) => v.kenteken === geselecteerd)?.kleur ?? '#345022', probleem });
    setGeselecteerd('');
    setHandmatig('');
    setProbleem('');
    setOpen(false);
  }

  return (
    <View style={styles.extraSectie}>
      <TouchableOpacity style={styles.extraKop} onPress={() => setOpen(!open)} activeOpacity={0.8}>
        <View style={styles.extraKopLinks}>
          <Ionicons name="bicycle-outline" size={18} color={Colors.green} />
          <Text style={styles.extraKopTekst}>Extra voertuig melden</Text>
        </View>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={16} color={Colors.textLight} />
      </TouchableOpacity>

      {/* Al toegevoegde extra voertuigen */}
      {extraVoertuigen.length > 0 && (
        <View style={styles.extraLijst}>
          {extraVoertuigen.map((ev) => (
            <View key={ev.kenteken} style={styles.extraItem}>
              <View style={[styles.voertuigKleurVlak, { backgroundColor: ev.kleur }]} />
              <View style={{ flex: 1 }}>
                <Text style={styles.voertuigKenteken}>{ev.kenteken}</Text>
                {ev.probleem ? <Text style={styles.probleemTekst}>{ev.probleem}</Text> : null}
              </View>
              <TouchableOpacity onPress={() => onVerwijder(ev.kenteken)}>
                <Ionicons name="close-circle" size={18} color={Colors.textLight} />
              </TouchableOpacity>
            </View>
          ))}
        </View>
      )}

      {open && (
        <View style={styles.extraFormulier}>
          <Text style={styles.veldLabel}>Kenteken selecteren</Text>
          {locatieVoertuigen.length > 0 ? (
            <>
              <TouchableOpacity
                style={styles.dropdownKnop}
                onPress={() => setShowDropdown(!showDropdown)}
                activeOpacity={0.8}
              >
                <Text style={[styles.dropdownTekst, !geselecteerd && styles.dropdownPlaceholder]}>
                  {geselecteerd || 'Kies kenteken van deze locatie...'}
                </Text>
                <Ionicons name="chevron-down" size={14} color={Colors.textLight} />
              </TouchableOpacity>
              {showDropdown && (
                <View style={styles.dropdownLijst}>
                  {locatieVoertuigen.map((v) => (
                    <TouchableOpacity
                      key={v.kenteken}
                      style={styles.dropdownItem}
                      onPress={() => { setGeselecteerd(v.kenteken); setHandmatig(''); setShowDropdown(false); }}
                    >
                      <View style={[styles.voertuigKleurVlak, { backgroundColor: v.kleur ?? Colors.green }]} />
                      <Text style={styles.dropdownItemTekst}>{v.kenteken}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
              <Text style={styles.ofTekst}>— of handmatig invoeren —</Text>
            </>
          ) : null}
          <TextInput
            style={styles.tekstveld}
            placeholder="Handmatig kenteken (bijv. EW-0005-A)"
            placeholderTextColor={Colors.textLight}
            value={handmatig}
            onChangeText={(t) => { setHandmatig(t); setGeselecteerd(''); }}
            autoCapitalize="characters"
          />
          <Text style={styles.veldLabel}>Wat is het probleem?</Text>
          <TextInput
            style={styles.tekstveld}
            multiline
            numberOfLines={2}
            placeholder="Beschrijf het probleem..."
            placeholderTextColor={Colors.textLight}
            value={probleem}
            onChangeText={setProbleem}
            textAlignVertical="top"
          />
          <TouchableOpacity
            style={[styles.toevoegenKnop, !kenteken && { opacity: 0.4 }]}
            onPress={voegToe}
            disabled={!kenteken}
            activeOpacity={0.8}
          >
            <Ionicons name="add-circle" size={16} color={Colors.white} />
            <Text style={styles.toevoegenKnopTekst}>Voertuig toevoegen aan melding</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

/* ── Foto sectie ─────────────────────────────────────────── */
type FotoItem = {
  uri: string;
  base64: string;
  mediaType: string;
  analysing: boolean;
  gedetecteerd: string[];
  afwijkingen: string[];
  fout?: string;
  fotoKey: string;
};

function FotoSectie({ opdrachtId, monteurId, locatie, bekendeKentekens }: {
  opdrachtId: string;
  monteurId: string;
  locatie: string;
  bekendeKentekens: string[];
}) {
  const [fotos, setFotos] = useState<FotoItem[]>([]);

  async function kiesFoto(vanCamera: boolean) {
    let result;
    if (vanCamera) {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) {
        Alert.alert('Toestemming nodig', 'Sta cameratoegang toe in de instellingen.');
        return;
      }
      result = await ImagePicker.launchCameraAsync({
        base64: true, quality: 0.4, mediaTypes: ImagePicker.MediaTypeOptions.Images,
        exif: false,
      });
    } else {
      result = await ImagePicker.launchImageLibraryAsync({
        base64: true, quality: 0.4, mediaTypes: ImagePicker.MediaTypeOptions.Images,
        exif: false,
      });
    }
    if (result.canceled || !result.assets?.[0]) return;

    const asset = result.assets[0];

    // Haal puur base64 op — expo-image-picker retourneert op web soms:
    // 1. asset.base64 met "data:image/...;base64," prefix
    // 2. asset.base64 leeg maar asset.uri is een data-URI
    let rawBase64 = asset.base64 ?? '';
    if (rawBase64.includes(',')) rawBase64 = rawBase64.split(',')[1];
    if (!rawBase64 && asset.uri?.startsWith('data:') && asset.uri.includes('base64,')) {
      rawBase64 = asset.uri.split('base64,')[1] ?? '';
    }
    const base64 = rawBase64;
    const mediaType = asset.mimeType ?? 'image/jpeg';

    // Gebruik een stabiele key ipv array-index om state-race te voorkomen
    const fotoKey = `${Date.now()}-${Math.random()}`;
    const nieuweFoto: FotoItem = {
      uri: asset.uri, base64, mediaType, analysing: true, gedetecteerd: [], afwijkingen: [], fotoKey,
    };

    setFotos((prev) => [...prev, nieuweFoto]);

    try {
      if (!base64) throw new Error('Foto bevat geen base64 data — probeer opnieuw');

      // Upload naar Supabase Storage
      let fotoUrl: string | undefined;
      try {
        const bestandsNaam = `fotos/${opdrachtId}/${Date.now()}.jpg`;
        const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
        const { data: uploadData } = await supabase.storage
          .from('fotos')
          .upload(bestandsNaam, bytes, { contentType: mediaType, upsert: true });
        if (uploadData?.path) {
          const { data: urlData } = supabase.storage.from('fotos').getPublicUrl(uploadData.path);
          fotoUrl = urlData?.publicUrl;
        }
      } catch { /* upload mislukt → doorgaan zonder URL */ }

      // AI kenteken detectie
      const res = await fetch(`${ADMIN_URL}/api/kenteken-detectie`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          base64, mediaType, locatie, bekende_kentekens: bekendeKentekens,
          opdracht_id: opdrachtId, monteur_id: monteurId, foto_url: fotoUrl,
        }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? `Server fout ${res.status}`);

      setFotos((prev) => prev.map((f) =>
        f.fotoKey === fotoKey
          ? { ...f, analysing: false, gedetecteerd: json.gedetecteerd ?? [], afwijkingen: json.afwijkingen ?? [] }
          : f
      ));
    } catch (err: any) {
      setFotos((prev) => prev.map((f) =>
        f.fotoKey === fotoKey ? { ...f, analysing: false, fout: err?.message ?? 'Analyse mislukt' } : f
      ));
    }
  }

  return (
    <View style={styles.fotoSectie}>
      <Text style={styles.subKop}>Foto's toevoegen</Text>

      {fotos.map((foto, i) => (
        <View key={i} style={styles.fotoItem}>
          <Image source={{ uri: foto.uri }} style={styles.fotoThumb} />
          <View style={{ flex: 1 }}>
            {foto.analysing ? (
              <View style={styles.fotoAnalyse}>
                <ActivityIndicator size="small" color={Colors.green} />
                <Text style={styles.fotoAnalyseTekst}>Kentekens detecteren...</Text>
              </View>
            ) : foto.fout ? (
              <Text style={styles.fotoFout} selectable>{foto.fout}</Text>
            ) : (
              <>
                {foto.gedetecteerd.length === 0 ? (
                  <Text style={styles.fotoGeenKenteken}>Geen kentekens herkend</Text>
                ) : (
                  <View style={styles.tagsRij}>
                    {foto.gedetecteerd.map((k) => (
                      <View key={k} style={[styles.tag, foto.afwijkingen.includes(k) && styles.tagAfwijking]}>
                        <Text style={[styles.tagTekst, foto.afwijkingen.includes(k) && styles.tagAfwijkingTekst]}>{k}</Text>
                      </View>
                    ))}
                  </View>
                )}
                {foto.afwijkingen.length > 0 && (
                  <View style={styles.afwijkingWarn}>
                    <Ionicons name="warning" size={13} color="#92400E" />
                    <Text style={styles.afwijkingTekst}>
                      {foto.afwijkingen.length} onbekend kenteken{foto.afwijkingen.length > 1 ? 's' : ''} — admin ontvangt melding
                    </Text>
                  </View>
                )}
                {foto.afwijkingen.length === 0 && foto.gedetecteerd.length > 0 && (
                  <Text style={styles.fotoOk}>Alles klopt</Text>
                )}
              </>
            )}
          </View>
          <TouchableOpacity onPress={() => setFotos((p) => p.filter((f) => f.fotoKey !== foto.fotoKey))}>
            <Ionicons name="close-circle" size={18} color={Colors.textLight} />
          </TouchableOpacity>
        </View>
      ))}

      <View style={styles.fotoBtns}>
        <TouchableOpacity style={styles.fotoKnop} onPress={() => kiesFoto(true)} activeOpacity={0.8}>
          <Ionicons name="camera-outline" size={18} color={Colors.green} />
          <Text style={styles.fotoKnopTekst}>Camera</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.fotoKnop} onPress={() => kiesFoto(false)} activeOpacity={0.8}>
          <Ionicons name="images-outline" size={18} color={Colors.green} />
          <Text style={styles.fotoKnopTekst}>Galerij</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

/* ── Verplaats verzoek sectie (meerdere) ──────────────────── */
function VerplaatsVerzoekSectie({ locatieVoertuigen, verzoeken, onToevoegen, onVerwijder }: {
  locatieVoertuigen: { kenteken: string; kleur: string | null; meldcode?: string; model?: string }[];
  verzoeken: VerplaatsVerzoek[];
  onToevoegen: (v: VerplaatsVerzoek) => void;
  onVerwijder: (idx: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const [neerzetten, setNeerzetten] = useState('');
  const [meenemen, setMeenemen] = useState('');
  const [meenemenNaar, setMeenemenNaar] = useState('');
  const [notitie, setNotitie] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);

  function voegToe() {
    if (!neerzetten.trim() && !meenemen.trim()) return;
    onToevoegen({ neerzetten: neerzetten.trim(), meenemen: meenemen.trim(), meenemenNaar: meenemenNaar.trim(), notitie });
    setNeerzetten(''); setMeenemen(''); setMeenemenNaar(''); setNotitie('');
    setOpen(false);
  }

  return (
    <View style={styles.verplaatsKaart}>
      <TouchableOpacity style={styles.extraKop} onPress={() => setOpen(!open)} activeOpacity={0.8}>
        <View style={styles.extraKopLinks}>
          <Ionicons name="swap-horizontal-outline" size={18} color={Colors.green} />
          <Text style={styles.extraKopTekst}>Voertuig(en) verplaatsen</Text>
          {verzoeken.length > 0 && (
            <View style={styles.verplaatsTeller}>
              <Text style={styles.verplaatsTellerTekst}>{verzoeken.length}</Text>
            </View>
          )}
        </View>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={16} color={Colors.textLight} />
      </TouchableOpacity>

      {/* Toegevoegde verzoeken */}
      {verzoeken.length > 0 && (
        <View style={{ paddingHorizontal: 14, paddingBottom: 8 }}>
          {verzoeken.map((v, i) => (
            <View key={i} style={styles.verzoekItem}>
              <View style={{ flex: 1, gap: 3 }}>
                {v.neerzetten ? (
                  <View style={styles.verzoekRij}>
                    <Text style={styles.verzoekLabel}>Neer</Text>
                    <Text style={styles.verzoekKenteken}>{v.neerzetten}</Text>
                  </View>
                ) : null}
                {v.meenemen ? (
                  <View style={styles.verzoekRij}>
                    <Text style={styles.verzoekLabel}>Mee</Text>
                    <Text style={styles.verzoekKenteken}>{v.meenemen}</Text>
                    {v.meenemenNaar ? <Text style={styles.verzoekNaar}>→ {v.meenemenNaar}</Text> : null}
                  </View>
                ) : null}
              </View>
              <TouchableOpacity onPress={() => onVerwijder(i)}>
                <Ionicons name="close-circle" size={18} color={Colors.textLight} />
              </TouchableOpacity>
            </View>
          ))}
        </View>
      )}

      {open && (
        <View style={styles.extraFormulier}>
          {/* Neerzetten */}
          <Text style={styles.veldLabel}>Kenteken neerzetten</Text>
          <TextInput
            style={styles.tekstveld}
            placeholder="Bijv. EW-0003-A"
            placeholderTextColor={Colors.textLight}
            value={neerzetten}
            onChangeText={setNeerzetten}
            autoCapitalize="characters"
          />

          {/* Meenemen */}
          <Text style={styles.veldLabel}>Kenteken meenemen (optioneel)</Text>
          {locatieVoertuigen.length > 0 ? (
            <>
              <TouchableOpacity
                style={styles.dropdownKnop}
                onPress={() => setShowDropdown(!showDropdown)}
                activeOpacity={0.8}
              >
                <Text style={[styles.dropdownTekst, !meenemen && styles.dropdownPlaceholder]}>
                  {meenemen || 'Kies kenteken van locatie...'}
                </Text>
                <Ionicons name="chevron-down" size={14} color={Colors.textLight} />
              </TouchableOpacity>
              {showDropdown && (
                <View style={styles.dropdownLijst}>
                  <TouchableOpacity style={styles.dropdownItem} onPress={() => { setMeenemen(''); setShowDropdown(false); }}>
                    <Text style={[styles.dropdownItemTekst, { color: Colors.textLight }]}>— Geen —</Text>
                  </TouchableOpacity>
                  {locatieVoertuigen.map((v) => (
                    <TouchableOpacity key={v.kenteken} style={styles.dropdownItem}
                      onPress={() => { setMeenemen(v.kenteken); setShowDropdown(false); }}>
                      <View style={[styles.kentekenKleur, { backgroundColor: v.kleur ?? Colors.green }]} />
                      <Text style={styles.dropdownItemTekst}>{v.kenteken}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
              <Text style={styles.ofTekst}>— of handmatig —</Text>
            </>
          ) : null}
          <TextInput
            style={styles.tekstveld}
            placeholder="Handmatig: bijv. EW-0004-B"
            placeholderTextColor={Colors.textLight}
            value={locatieVoertuigen.length > 0 && meenemen && locatieVoertuigen.some((v) => v.kenteken === meenemen) ? '' : meenemen}
            onChangeText={(t) => setMeenemen(t)}
            autoCapitalize="characters"
          />

          {meenemen.trim() !== '' && (
            <>
              <Text style={styles.veldLabel}>Meenemen naar locatie</Text>
              <TextInput
                style={styles.tekstveld}
                placeholder="Naam bestemmingslocatie..."
                placeholderTextColor={Colors.textLight}
                value={meenemenNaar}
                onChangeText={setMeenemenNaar}
              />
            </>
          )}

          <Text style={styles.veldLabel}>Notitie (optioneel)</Text>
          <TextInput
            style={styles.tekstveld}
            multiline numberOfLines={2}
            placeholder="Extra toelichting..."
            placeholderTextColor={Colors.textLight}
            value={notitie}
            onChangeText={setNotitie}
            textAlignVertical="top"
          />

          <View style={styles.verzoekInfo}>
            <Ionicons name="information-circle-outline" size={15} color={Colors.amber} />
            <Text style={styles.verzoekInfoTekst}>
              Dit is een verzoek. De beheerder keurt het goed of af — er wordt nog niets verplaatst.
            </Text>
          </View>

          <TouchableOpacity
            style={[styles.toevoegenKnop, (!neerzetten.trim() && !meenemen.trim()) && { opacity: 0.4 }]}
            onPress={voegToe}
            disabled={!neerzetten.trim() && !meenemen.trim()}
            activeOpacity={0.8}
          >
            <Ionicons name="add-circle" size={16} color={Colors.white} />
            <Text style={styles.toevoegenKnopTekst}>Verzoek toevoegen</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

/* ── Onderhoud checklist ─────────────────────────────────── */
function OnderhoudChecklist() {
  const items = [
    'Remmen voor & achter gecontroleerd', 'Bandenspanning gecheckt',
    'Ketting gespannen & gesmeerd', 'Verlichting voor/achter werkt',
    'Accu volledig opgeladen', 'Frame & bevestigingen nagekeken',
    'Zadelhoogte correct', 'Stuur recht',
  ];
  const [afgevinkt, setAfgevinkt] = useState<Record<string, boolean>>({});
  const toggle = (item: string) => setAfgevinkt((p) => ({ ...p, [item]: !p[item] }));
  const count = Object.values(afgevinkt).filter(Boolean).length;
  return (
    <View style={styles.checklistKaart}>
      <View style={styles.checklistKopRij}>
        <Text style={styles.subKop}>Onderhoud checklist</Text>
        <Text style={styles.checklistTeller}>{count}/{items.length}</Text>
      </View>
      {items.map((item) => (
        <TouchableOpacity key={item} style={styles.checklistItem} onPress={() => toggle(item)} activeOpacity={0.7}>
          <View style={[styles.checkbox, afgevinkt[item] && styles.checkboxActief]}>
            {afgevinkt[item] && <Ionicons name="checkmark" size={12} color={Colors.white} />}
          </View>
          <Text style={[styles.checklistTekst, afgevinkt[item] && styles.checklistTekstAfgevinkt]}>{item}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

/* ── Accu voor/na ────────────────────────────────────────── */
function AccuAfwikkelen() {
  const [voor, setVoor] = useState('8× 20Ah');
  const [na, setNa] = useState('6× 30Ah');
  return (
    <View style={styles.accuKaart}>
      <Text style={styles.subKop}>Accu voor/na</Text>
      <View style={styles.accuRij}>
        <View style={{ flex: 1 }}>
          <Text style={styles.veldLabel}>Situatie voor</Text>
          <TextInput style={styles.tekstveld} value={voor} onChangeText={setVoor} placeholderTextColor={Colors.textLight} />
        </View>
        <Ionicons name="arrow-forward" size={20} color={Colors.amber} style={{ marginTop: 28 }} />
        <View style={{ flex: 1 }}>
          <Text style={styles.veldLabel}>Situatie na</Text>
          <TextInput style={[styles.tekstveld, { borderColor: Colors.green }]} value={na} onChangeText={setNa} placeholderTextColor={Colors.textLight} />
        </View>
      </View>
    </View>
  );
}

/* ── Pech stop kaart ─────────────────────────────────────── */
function PechStopKaart({ stopNummer, adres, status, onChange }: {
  stopNummer: number; adres: string; status: PechStopStatus;
  onChange: (veld: keyof PechStopStatus, waarde: string | boolean | null) => void;
}) {
  return (
    <View style={styles.pechKaart}>
      <View style={styles.pechHeader}>
        <View style={styles.pechNummer}><Text style={styles.pechNummerTekst}>{stopNummer}</Text></View>
        <Text style={styles.pechAdres}>{adres}</Text>
      </View>
      <Text style={styles.veldLabel}>Voertuig gevonden?</Text>
      <View style={styles.gevondenRij}>
        <TouchableOpacity style={[styles.gevondenKnop, status.gevonden === true && styles.gevondenKnopJa]}
          onPress={() => onChange('gevonden', true)} activeOpacity={0.8}>
          <Ionicons name="checkmark-circle-outline" size={16} color={status.gevonden === true ? Colors.white : Colors.green} />
          <Text style={[styles.gevondenTekst, status.gevonden === true && { color: Colors.white }]}>Gevonden</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.gevondenKnop, status.gevonden === false && styles.gevondenKnopNee]}
          onPress={() => onChange('gevonden', false)} activeOpacity={0.8}>
          <Ionicons name="close-circle-outline" size={16} color={status.gevonden === false ? Colors.white : Colors.prio1} />
          <Text style={[styles.gevondenTekst, status.gevonden === false && { color: Colors.white }]}>Niet gevonden</Text>
        </TouchableOpacity>
      </View>
      {status.gevonden === true && (
        <>
          <Text style={styles.veldLabel}>Kenteken</Text>
          <TextInput style={styles.tekstveld} placeholder="Bijv. EW-0003-A" placeholderTextColor={Colors.textLight}
            value={status.kenteken} onChangeText={(t) => onChange('kenteken', t)} autoCapitalize="characters" />
          <Text style={styles.veldLabel}>Actie ondernomen</Text>
          <TextInput style={styles.tekstveld} multiline numberOfLines={2}
            placeholder="Bijv. accu gewisseld, terug naar locatie gebracht..." placeholderTextColor={Colors.textLight}
            value={status.gedaan} onChangeText={(t) => onChange('gedaan', t)} textAlignVertical="top" />
        </>
      )}
      {status.gevonden === false && (
        <View style={styles.nietGevondenInfo}>
          <Ionicons name="warning-outline" size={16} color="#92400E" />
          <Text style={styles.nietGevondenTekst}>
            Voertuig wordt na indiening verplaatst naar &ldquo;Kwijt/gestolen&rdquo;. Datum en locatie worden gelogd.
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  leeg: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  leegTekst: { fontSize: 15, color: Colors.textLight },
  succesPagina: { flex: 1, backgroundColor: Colors.background, alignItems: 'center', justifyContent: 'center', padding: 40 },
  succesCircel: { width: 100, height: 100, borderRadius: 50, backgroundColor: Colors.greenLight, alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  succesTitel: { fontSize: 26, fontWeight: '900', color: Colors.textDark, marginBottom: 8 },
  succesSub: { fontSize: 15, color: Colors.textMedium, textAlign: 'center', lineHeight: 22 },

  sectieKop: { fontSize: 18, fontWeight: '800', color: Colors.textDark, marginBottom: 4 },
  subKop: { fontSize: 12, fontWeight: '700', color: Colors.textLight, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10, marginTop: 6 },
  veldLabel: { fontSize: 12, fontWeight: '600', color: Colors.textMedium, marginBottom: 5, textTransform: 'uppercase', letterSpacing: 0.3 },

  kmKaart: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: Colors.white, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, marginBottom: 14, borderWidth: 1, borderColor: Colors.border },
  kmInput: { flex: 1, fontSize: 22, fontWeight: '800', color: Colors.textDark },
  kmLabel: { fontSize: 16, fontWeight: '600', color: Colors.textLight },

  voertuigKaart: { backgroundColor: Colors.white, borderRadius: 14, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: Colors.border },
  voertuigHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12, flexWrap: 'wrap' },
  voertuigKleurVlak: { width: 22, height: 22, borderRadius: 6, flexShrink: 0 },
  voertuigKenteken: { fontSize: 14, fontWeight: '700', color: Colors.textDark },
  probleemTekst: { fontSize: 12, color: Colors.prio1, fontStyle: 'italic', flex: 1 },

  tekstveld: { borderWidth: 1.5, borderColor: Colors.border, borderRadius: 10, padding: 10, fontSize: 14, color: Colors.textDark, backgroundColor: Colors.background, marginBottom: 10 },
  grootTekstveld: { borderWidth: 1.5, borderColor: Colors.border, borderRadius: 12, padding: 12, fontSize: 14, color: Colors.textDark, backgroundColor: Colors.white, minHeight: 80, marginBottom: 14 },

  // Onderdelen multi-select
  tagsRij: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8 },
  tag: { backgroundColor: Colors.greenLight, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  tagTekst: { fontSize: 12, fontWeight: '600', color: Colors.green },
  onderdelenKnop: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8, paddingHorizontal: 4, marginBottom: 4 },
  onderdelenKnopTekst: { fontSize: 14, color: Colors.green, fontWeight: '600' },
  onderdelenTray: { backgroundColor: Colors.background, borderRadius: 12, marginBottom: 10, borderWidth: 1, borderColor: Colors.border, overflow: 'hidden' },
  onderdelenScroller: { maxHeight: 220, paddingHorizontal: 10, paddingTop: 6 },
  zoekVeld: { borderWidth: 1, borderColor: Colors.border, borderRadius: 8, padding: 8, fontSize: 13, color: Colors.textDark, margin: 10, marginBottom: 4 },
  geenOnderdelen: { fontSize: 13, color: Colors.textLight, textAlign: 'center', padding: 12 },
  categorieTekst: { fontSize: 10, fontWeight: '700', color: Colors.textLight, textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 8, marginBottom: 4, paddingHorizontal: 4 },
  onderdeelRij: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 9, paddingHorizontal: 4, borderBottomWidth: 1, borderBottomColor: Colors.border },
  onderdeelRijGesel: { backgroundColor: Colors.greenLight + '40' },
  onderdeelNaam: { fontSize: 14, color: Colors.textDark, flex: 1 },
  onderdeelNaamGesel: { color: Colors.green, fontWeight: '600' },
  trayVoet: { borderTopWidth: 1, borderTopColor: Colors.border, paddingVertical: 6, paddingHorizontal: 10, backgroundColor: Colors.white },
  trayVoetTekst: { fontSize: 10, color: Colors.textLight, textAlign: 'center' },

  swapRij: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 4 },
  swapTekst: { fontSize: 14, color: Colors.textDark },
  operationeelRij: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: Colors.border },
  operationeelTekst: { fontSize: 14, fontWeight: '600', color: Colors.textDark },
  operationeelSub: { fontSize: 11, color: Colors.textLight, marginTop: 2 },
  checkbox: { width: 20, height: 20, borderRadius: 6, borderWidth: 2, borderColor: Colors.border, alignItems: 'center', justifyContent: 'center' },
  checkboxActief: { backgroundColor: Colors.green, borderColor: Colors.green },

  // Extra voertuig
  extraSectie: { backgroundColor: Colors.white, borderRadius: 14, marginBottom: 14, borderWidth: 1, borderColor: Colors.border, overflow: 'hidden' },
  extraKop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 14 },
  extraKopLinks: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  extraKopTekst: { fontSize: 14, fontWeight: '700', color: Colors.green },
  extraLijst: { paddingHorizontal: 14, paddingBottom: 8 },
  extraItem: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, borderTopWidth: 1, borderTopColor: Colors.border },
  extraFormulier: { padding: 14, borderTopWidth: 1, borderTopColor: Colors.border, backgroundColor: Colors.background },
  dropdownKnop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1.5, borderColor: Colors.border, borderRadius: 10, padding: 10, backgroundColor: Colors.white, marginBottom: 8 },
  dropdownTekst: { fontSize: 14, color: Colors.textDark, flex: 1 },
  dropdownPlaceholder: { color: Colors.textLight },
  dropdownLijst: { backgroundColor: Colors.white, borderRadius: 10, borderWidth: 1, borderColor: Colors.border, marginBottom: 8 },
  dropdownItem: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10, borderBottomWidth: 1, borderBottomColor: Colors.border },
  dropdownItemTekst: { fontSize: 14, fontWeight: '600', color: Colors.textDark, fontVariant: ['tabular-nums'] },
  ofTekst: { fontSize: 12, color: Colors.textLight, textAlign: 'center', marginBottom: 8 },
  toevoegenKnop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: Colors.green, borderRadius: 10, paddingVertical: 12, marginTop: 4 },
  toevoegenKnopTekst: { fontSize: 14, fontWeight: '700', color: Colors.white },

  // Foto sectie
  fotoSectie: { marginBottom: 14 },
  fotoBtns: { flexDirection: 'row', gap: 10, marginTop: 6 },
  fotoKnop: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderWidth: 1.5, borderColor: Colors.green, borderRadius: 12, paddingVertical: 12, backgroundColor: Colors.white },
  fotoKnopTekst: { fontSize: 14, fontWeight: '700', color: Colors.green },
  fotoItem: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, backgroundColor: Colors.white, borderRadius: 12, padding: 10, marginBottom: 8, borderWidth: 1, borderColor: Colors.border },
  fotoThumb: { width: 60, height: 60, borderRadius: 8 },
  fotoAnalyse: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  fotoAnalyseTekst: { fontSize: 12, color: Colors.textLight },
  fotoFout: { fontSize: 12, color: Colors.prio1 },
  fotoGeenKenteken: { fontSize: 12, color: Colors.textLight, fontStyle: 'italic' },
  fotoOk: { fontSize: 12, color: Colors.green, fontWeight: '600' },
  tagAfwijking: { backgroundColor: '#FEF3D6' },
  tagAfwijkingTekst: { color: '#92400E' },
  afwijkingWarn: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  afwijkingTekst: { fontSize: 11, color: '#92400E', flex: 1, lineHeight: 16 },

  // Verplaats verzoek
  verplaatsKaart: { backgroundColor: Colors.white, borderRadius: 14, marginBottom: 14, borderWidth: 1, borderColor: Colors.border, overflow: 'hidden' },
  verplaatsTeller: { backgroundColor: Colors.green, borderRadius: 10, paddingHorizontal: 7, paddingVertical: 2 },
  verplaatsTellerTekst: { fontSize: 11, fontWeight: '800', color: Colors.white },
  verzoekItem: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, borderTopWidth: 1, borderTopColor: Colors.border },
  verzoekRij: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  verzoekLabel: { fontSize: 10, fontWeight: '700', color: Colors.textLight, textTransform: 'uppercase', width: 28 },
  verzoekKenteken: { fontSize: 13, fontWeight: '700', color: Colors.textDark, fontVariant: ['tabular-nums'] },
  verzoekNaar: { fontSize: 12, color: Colors.textMedium },
  kentekenGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 4 },
  kentekenChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20, borderWidth: 1.5, borderColor: Colors.border, backgroundColor: Colors.background },
  kentekenChipActief: { borderColor: Colors.green, backgroundColor: Colors.greenLight },
  kentekenKleur: { width: 12, height: 12, borderRadius: 3 },
  kentekenChipTekst: { fontSize: 12, fontWeight: '700', color: Colors.textMedium },
  kentekenChipTekstActief: { color: Colors.green },
  verzoekInfo: { flexDirection: 'row', gap: 8, alignItems: 'flex-start', backgroundColor: '#FEF3D6', borderRadius: 10, padding: 10, marginTop: 4, marginBottom: 10 },
  verzoekInfoTekst: { flex: 1, fontSize: 12, color: '#92400E', lineHeight: 18 },

  checklistKaart: { backgroundColor: Colors.white, borderRadius: 14, padding: 14, marginBottom: 14, borderWidth: 1, borderColor: Colors.border },
  checklistKopRij: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  checklistTeller: { fontSize: 14, fontWeight: '700', color: Colors.green },
  checklistItem: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: Colors.border },
  checklistTekst: { fontSize: 14, color: Colors.textDark, flex: 1 },
  checklistTekstAfgevinkt: { color: Colors.textLight, textDecorationLine: 'line-through' },

  accuKaart: { backgroundColor: Colors.white, borderRadius: 14, padding: 14, marginBottom: 14, borderWidth: 1, borderColor: Colors.border },
  accuRij: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },

  vervolgKaart: { backgroundColor: Colors.white, borderRadius: 14, padding: 14, marginBottom: 14, borderWidth: 1, borderColor: Colors.greenLight },
  vervolgKop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  vervolgTitel: { fontSize: 14, fontWeight: '700', color: Colors.green },
  vervolgSub: { fontSize: 12, color: Colors.textLight, marginTop: 2 },

  pechKaart: { backgroundColor: Colors.white, borderRadius: 14, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: Colors.border },
  pechHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  pechNummer: { width: 24, height: 24, borderRadius: 12, backgroundColor: Colors.prio1, alignItems: 'center', justifyContent: 'center' },
  pechNummerTekst: { fontSize: 12, fontWeight: '800', color: Colors.white },
  pechAdres: { fontSize: 14, fontWeight: '600', color: Colors.textDark, flex: 1 },
  gevondenRij: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  gevondenKnop: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderWidth: 1.5, borderColor: Colors.border, borderRadius: 10, paddingVertical: 10 },
  gevondenKnopJa: { backgroundColor: Colors.green, borderColor: Colors.green },
  gevondenKnopNee: { backgroundColor: Colors.prio1, borderColor: Colors.prio1 },
  gevondenTekst: { fontSize: 13, fontWeight: '600', color: Colors.textMedium },
  nietGevondenInfo: { flexDirection: 'row', gap: 8, alignItems: 'flex-start', backgroundColor: '#FEF3D6', borderRadius: 10, padding: 10 },
  nietGevondenTekst: { flex: 1, fontSize: 12, color: '#92400E', lineHeight: 18 },

  actieBalk: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: Colors.white, paddingHorizontal: 16, paddingTop: 12, borderTopWidth: 1, borderTopColor: Colors.border },
  indienenKnop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: Colors.amber, borderRadius: 14, paddingVertical: 16, shadowColor: Colors.amber, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.35, shadowRadius: 8, elevation: 4 },
  indienenTekst: { fontSize: 16, fontWeight: '800', color: Colors.textDark },
  bevestigWrap: { gap: 8 },
  bevestigTekst: { fontSize: 13, color: Colors.textMedium, textAlign: 'center' },
  bevestigKnoppen: { flexDirection: 'row', gap: 10 },
  annuleerKnop: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 14, borderRadius: 14, borderWidth: 1, borderColor: Colors.border },
  annuleerTekst: { fontSize: 15, fontWeight: '600', color: Colors.textMedium },
  bevestigKnop: { flex: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: Colors.amber, borderRadius: 14, paddingVertical: 14 },
  bevestigKnopTekst: { fontSize: 15, fontWeight: '800', color: Colors.textDark },
});
