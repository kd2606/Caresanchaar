import { NextResponse } from "next/server";

const OVERPASS_URL = "https://overpass-api.de/api/interpreter";

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const lat = searchParams.get("lat");
    const lng = searchParams.get("lng");
    const radius = searchParams.get("radius") || "3000"; // Default 3km
    const type = searchParams.get("type") || "hospital";

    if (!lat || !lng) {
        return NextResponse.json({ error: "Missing latitude or longitude" }, { status: 400 });
    }

    try {
        // Query to find hospitals or clinics
        let nodeType = '["amenity"="hospital"]';
        if (type === "clinic") nodeType = '["amenity"="clinic"]';
        if (type === "pharmacy") nodeType = '["amenity"="pharmacy"]';

        const query = `
            [out:json][timeout:15];
            (
              node${nodeType}(around:${radius},${lat},${lng});
              way${nodeType}(around:${radius},${lat},${lng});
              relation${nodeType}(around:${radius},${lat},${lng});
            );
            out center 20;
        `;

        const response = await fetch(OVERPASS_URL, {
            method: "POST",
            headers: {
                "Content-Type": "text/plain",
                "User-Agent": "PulseCheckAI/1.0 (contact@pulsecheck.ai)",
            },
            body: query,
        });

        if (!response.ok) {
            throw new Error(`Overpass API responded with status: ${response.status}`);
        }

        const data = await response.json();

        // Transform the Overpass elements
        const places = data.elements.map((el: any) => {
            const lat = el.lat || el.center?.lat;
            const lon = el.lon || el.center?.lon;
            return {
                id: el.id,
                name: el.tags?.name || "Unnamed Facility",
                type: el.tags?.amenity || type,
                lat,
                lng: lon,
                address: [
                    el.tags?.['addr:street'],
                    el.tags?.['addr:city'],
                    el.tags?.['addr:housenumber']
                ].filter(Boolean).join(", ") || "Address not available",
                phone: el.tags?.phone || el.tags?.['contact:phone'] || null,
                website: el.tags?.website || el.tags?.['contact:website'] || null
            };
        });

        return NextResponse.json({ places });

    } catch (error: any) {
        console.error("Overpass API Error:", error);
        return NextResponse.json({ error: "Failed to fetch nearby facilities" }, { status: 500 });
    }
}
