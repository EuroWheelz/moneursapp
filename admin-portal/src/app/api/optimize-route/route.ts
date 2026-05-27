import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const { locations } = await req.json();

    if (!locations || !Array.isArray(locations) || locations.length < 2) {
      return NextResponse.json({ error: 'At least 2 locations required' }, { status: 400 });
    }

    const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
    if (!token || token.endsWith('.xxx')) {
      return NextResponse.json({ error: 'Mapbox token not configured' }, { status: 500 });
    }

    // 1. Ensure all locations have coordinates (Geocode if missing)
    const processedLocations = await Promise.all(locations.map(async (loc: any) => {
      if (loc.lat && loc.lng) return loc;
      
      // Fallback: Geocode address
      const query = encodeURIComponent(`${loc.adres}, ${loc.postcode} ${loc.stad}`);
      const geoUrl = `https://api.mapbox.com/geocoding/v5/mapbox.places/${query}.json?access_token=${token}&limit=1`;
      const geoRes = await fetch(geoUrl);
      const geoData = await geoRes.json();
      
      if (geoData.features && geoData.features.length > 0) {
        const [lng, lat] = geoData.features[0].center;
        return { ...loc, lat, lng };
      }
      return loc; // Return as is, might fail later if coords still missing
    }));

    // Filter out locations that still don't have coordinates
    const validLocations = processedLocations.filter(loc => loc.lat && loc.lng);
    if (validLocations.length < 2) {
      return NextResponse.json({ error: 'Not enough valid coordinates found' }, { status: 400 });
    }

    // 2. Format coordinates: lng,lat;lng,lat
    const coordsString = validLocations
      .map(loc => `${loc.lng},${loc.lat}`)
      .join(';');

    const url = `https://api.mapbox.com/optimized-trips/v1/mapbox/driving/${coordsString}?access_token=${token}&geometries=geojson&overview=full`;

    const response = await fetch(url);
    const data = await response.json();

    if (data.code !== 'Ok') {
      return NextResponse.json({ error: data.message || 'Mapbox error' }, { status: 500 });
    }

    // 3. Mapbox returns waypoints in the optimized order
    const optimizedOrder = data.waypoints
      .sort((a: any, b: any) => a.trips_index - b.trips_index || a.waypoint_index - b.waypoint_index)
      .map((wp: any) => validLocations[wp.waypoint_index].id);

    return NextResponse.json({ 
      order: optimizedOrder,
      geometry: data.trips[0].geometry 
    });

  } catch (error) {
    console.error('Optimization error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
