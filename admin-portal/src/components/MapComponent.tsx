'use client';

import { useEffect, useRef } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';

interface MapComponentProps {
  locations: Array<{ id: string; lat: number; lng: number; label: string }>;
  routeGeometry?: any;
  onMarkerClick?: (id: string) => void;
}

export default function MapComponent({ locations, routeGeometry, onMarkerClick }: MapComponentProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const markers = useRef<{ [key: string]: mapboxgl.Marker }>({});

  useEffect(() => {
    if (map.current) return; // Initialize map only once

    const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
    console.log('Mapbox Token loaded:', token ? 'Yes (starts with ' + token.substring(0, 5) + ')' : 'No');
    
    if (!token || token.endsWith('.xxx')) {
      console.error('Mapbox token is missing or invalid placeholder.');
      return;
    }

    mapboxgl.accessToken = token;

    map.current = new mapboxgl.Map({
      container: mapContainer.current!,
      style: 'mapbox://styles/mapbox/streets-v12',
      center: [5.2913, 52.1326], // Netherlands center
      zoom: 7,
    });

    map.current.on('load', () => {
      // Add source and layer for the route
      map.current?.addSource('route', {
        type: 'geojson',
        data: {
          type: 'Feature',
          properties: {},
          geometry: { type: 'LineString', coordinates: [] }
        }
      });

      map.current?.addLayer({
        id: 'route',
        type: 'line',
        source: 'route',
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: { 'line-color': '#F3A713', 'line-width': 4, 'line-opacity': 0.75 }
      });

      // Force a resize check after load to ensure it fills the container
      setTimeout(() => {
        map.current?.resize();
      }, 100);
    });

    const handleResize = () => map.current?.resize();
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      map.current?.remove();
      map.current = null;
    };
  }, []);

  // Update Markers
  useEffect(() => {
    if (!map.current) return;

    // Remove old markers
    Object.values(markers.current).forEach(m => m.remove());
    markers.current = {};

    if (locations.length === 0) return;

    const bounds = new mapboxgl.LngLatBounds();

    locations.forEach((loc) => {
      if (!loc.lat || !loc.lng) return;

      const el = document.createElement('div');
      el.className = 'w-6 h-6 bg-primary text-white rounded-full border-2 border-white shadow-lg flex items-center justify-center text-[10px] font-bold cursor-pointer hover:scale-110 transition-transform';
      el.innerText = loc.label;
      el.onclick = () => onMarkerClick?.(loc.id);

      const marker = new mapboxgl.Marker(el)
        .setLngLat([loc.lng, loc.lat])
        .addTo(map.current!);

      markers.current[loc.id] = marker;
      bounds.extend([loc.lng, loc.lat]);
    });

    if (locations.length > 0) {
      map.current.fitBounds(bounds, { padding: 40, maxZoom: 14 });
    }
  }, [locations]);

  // Update Route
  useEffect(() => {
    if (!map.current || !routeGeometry) return;

    const source = map.current.getSource('route') as mapboxgl.GeoJSONSource;
    if (source) {
      source.setData({
        type: 'Feature',
        properties: {},
        geometry: routeGeometry
      });
    }
  }, [routeGeometry]);

  return (
    <div ref={mapContainer} className="w-full h-full min-h-[300px]" />
  );
}
