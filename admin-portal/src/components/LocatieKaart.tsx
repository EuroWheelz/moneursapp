'use client';

import { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { DbRelatie } from '@/lib/supabase';

function maakIcon(geselecteerd: boolean, kleur: string) {
  const s = geselecteerd ? 42 : 32;
  const rand = geselecteerd ? '#1A1A1A' : kleur;
  return L.divIcon({
    className: '',
    iconSize: [s, s],
    iconAnchor: [s / 2, s],
    popupAnchor: [0, -s - 2],
    html: `<div style="width:${s}px;height:${s}px;background:${kleur};border-radius:50% 50% 50% 0;transform:rotate(-45deg);border:3px solid ${rand};box-shadow:0 2px 8px rgba(0,0,0,.3)"></div>`,
  });
}

const KLEUR_CONSIGNATIE = '#F3A713';
const KLEUR_KLANT = '#3B82F6';
const KLEUR_INACTIEF = '#9CA3AF';

function getIcon(r: DbRelatie, geselecteerd: boolean) {
  if (r.status !== 'actief') return maakIcon(geselecteerd, KLEUR_INACTIEF);
  const kleur = r.type === 'klant' ? KLEUR_KLANT : KLEUR_CONSIGNATIE;
  return maakIcon(geselecteerd, kleur);
}

function VliegNaar({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap();
  useEffect(() => {
    map.flyTo([lat, lng], 14, { duration: 1.1 });
  }, [lat, lng]);
  return null;
}

interface Props {
  relaties: DbRelatie[];
  actieveId: string | null;
  onSelecteer: (id: string) => void;
}

export default function LocatieKaart({ relaties, actieveId, onSelecteer }: Props) {
  const actieve = relaties.find((r) => r.id === actieveId && r.lat != null && r.lng != null);

  return (
    <MapContainer
      center={[52.3, 5.3]}
      zoom={7}
      style={{ width: '100%', height: '100%' }}
      className="z-0"
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      {actieve && <VliegNaar lat={actieve.lat!} lng={actieve.lng!} />}

      {relaties
        .filter((r) => r.lat != null && r.lng != null)
        .map((r) => (
          <Marker
            key={r.id}
            position={[r.lat!, r.lng!]}
            icon={getIcon(r, r.id === actieveId)}
            eventHandlers={{ click: () => onSelecteer(r.id) }}
          >
            <Popup>
              <div style={{ minWidth: 210, fontFamily: 'inherit' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                  <span style={{
                    width: 8, height: 8, borderRadius: '50%',
                    background: r.status === 'actief' ? (r.type === 'klant' ? KLEUR_KLANT : KLEUR_CONSIGNATIE) : KLEUR_INACTIEF,
                    display: 'inline-block', flexShrink: 0,
                  }} />
                  <strong style={{ fontSize: 13, color: '#111827', lineHeight: 1.3 }}>{r.naam}</strong>
                  <span style={{
                    fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px',
                    padding: '1px 5px', borderRadius: 4,
                    background: r.type === 'klant' ? '#EFF6FF' : '#FFFBEB',
                    color: r.type === 'klant' ? '#1D4ED8' : '#92400E',
                    marginLeft: 'auto', flexShrink: 0,
                  }}>{r.type}</span>
                </div>
                {r.crediteurnummer && (
                  <p style={{ fontSize: 11, color: '#9ca3af', margin: '0 0 3px' }}>{r.crediteurnummer}</p>
                )}
                <p style={{ fontSize: 12, color: '#374151', margin: '0 0 3px' }}>
                  {r.adres}, {r.postcode} {r.plaats}
                </p>
                {r.telefoon && (
                  <p style={{ fontSize: 11, color: '#6b7280', margin: 0 }}>{r.telefoon}</p>
                )}
                <div style={{ display: 'flex', gap: 12, marginTop: 8, fontSize: 11, color: '#6b7280' }}>
                  <span>🚴 {r.echopers} e-choppers</span>
                  <span>🔋 {r.accus} accu&apos;s</span>
                </div>
                <a
                  href={`/relaties/${r.id}`}
                  style={{
                    display: 'block', marginTop: 10, padding: '5px 0',
                    textAlign: 'center', fontSize: 12, fontWeight: 700,
                    color: '#F3A713', textDecoration: 'none',
                    borderTop: '1px solid #f3f4f6',
                  }}
                >
                  Relatie openen →
                </a>
              </div>
            </Popup>
          </Marker>
        ))}
    </MapContainer>
  );
}
