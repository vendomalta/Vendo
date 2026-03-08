// Malta Map Handler for VENDO
// Uses Leaflet.js to show seller location (City level) - Restricted to Malta

// Malta City Coordinates (Approximate centers)
const MALTA_CITIES = {
    // Malta Island
    'Valletta': [35.8989, 14.5146],
    'Sliema': [35.9110, 14.5029],
    'St. Julian\'s': [35.9184, 14.4897],
    'Gzira': [35.9052, 14.4953],
    'Msida': [35.8961, 14.4828],
    'Birkirkara': [35.8973, 14.4610],
    'Mosta': [35.9099, 14.4262],
    'Naxxar': [35.9294, 14.4449],
    'San Gwann': [35.9079, 14.4770],
    'Swieqi': [35.9213, 14.4795],
    'Pembroke': [35.9324, 14.4791],
    'Mellieha': [35.9567, 14.3644],
    'St. Paul\'s Bay': [35.9482, 14.4080],
    'Bugibba': [35.9525, 14.4140],
    'Qawra': [35.9566, 14.4216],
    'Mdina': [35.8858, 14.4031],
    'Rabat': [35.8814, 14.3986],
    'Attard': [35.8906, 14.4428],
    'Balzan': [35.8967, 14.4533],
    'Lija': [35.9008, 14.4475],
    'Hamrun': [35.8860, 14.4880],
    'Marsa': [35.8778, 14.4960],
    'Paola': [35.8732, 14.5085],
    'Tarxien': [35.8659, 14.5132],
    'Zejtun': [35.8561, 14.5342],
    'Marsaxlokk': [35.8415, 14.5447],
    'Birzebbuga': [35.8258, 14.5269],
    'Zurrieq': [35.8315, 14.4744],
    'Luqa': [35.8596, 14.4900],
    'Qormi': [35.8773, 14.4716],
    'Zebbug': [35.8732, 14.4410],
    'Siggiewi': [35.8542, 14.4379],
    
    // Gozo Island
    'Victoria': [36.0443, 14.2415],
    'Rabat (Gozo)': [36.0443, 14.2415],
    'Xaghra': [36.0503, 14.2661],
    'Nadur': [36.0378, 14.2944],
    'Ghajnsielem': [36.0264, 14.2882],
    'Mgarr': [36.0250, 14.2964],
    'Xewkija': [36.0319, 14.2592],
    'Sannat': [36.0233, 14.2425],
    'Munxar': [36.0300, 14.2333],
    'Fontana': [36.0358, 14.2367],
    'Gharb': [36.0608, 14.2092],
    'Ghasri': [36.0583, 14.2258],
    'San Lawrenz': [36.0550, 14.2033],
    'Kercem': [36.0417, 14.2278],
    'Zebbug (Gozo)': [36.0717, 14.2361],
    'Marsalforn': [36.0711, 14.2606],
    'Xlendi': [36.0303, 14.2175]
};

// Default center (Malta center)
const DEFAULT_CENTER = [35.9375, 14.3754];
const DEFAULT_ZOOM = 11; // View whole island
const CITY_ZOOM = 14;    // View specific city

// Map restriction bounds (South-West to North-East covering Malta + Gozo)
const MALTA_BOUNDS = [
    [35.78, 14.15], // SW
    [36.10, 14.60]  // NE
];

/**
 * Initializes the seller location map
 * @param {string} locationName - The city/region name from the listing
 */
export async function initSellerMap(locationName) {
    const container = document.getElementById('seller-map-container');
    if (!container) return;

    // Remove existing map instance
    if (container._leaflet_map) {
        container._leaflet_map.remove();
        container._leaflet_map = null;
    } else {
        // Fallback cleanup
        while (container.firstChild) {
            container.removeChild(container.firstChild);
        }
    }

    // Initialize Map with restrictions
    let map;
    try {
        map = L.map('seller-map-container', {
            center: DEFAULT_CENTER, // Initial center, will update
            zoom: DEFAULT_ZOOM,
            minZoom: 10,
            maxZoom: 16,
            maxBounds: MALTA_BOUNDS,
            maxBoundsViscosity: 1.0,
            scrollWheelZoom: false,
            dragging: !L.Browser.mobile,
            zoomControl: true,
            attributionControl: false // Hide Leaflet branding
        });

        container._leaflet_map = map;

        container._leaflet_map = map;

        // Custom Vector Map Style (No Tiles)
        map.createPane('bgPane');
        map.getPane('bgPane').style.zIndex = 0;
        
        // Sea/Background color (Darker Blue for Contrast)
        container.style.backgroundColor = '#bae6fd'; // Sky-200 equivalent

    } catch (e) {
        console.error('Map initialization failed:', e);
        container.innerHTML = `<div style="height:100%; display:flex; align-items:center; justify-content:center; background:#f8fafc; color:#64748b;">
            <p><i class="fas fa-map-marker-alt"></i> ${locationName || 'Malta'}</p>
        </div>`;
        return;
    }

    // Handle Location & Vector Layers
    let locationFound = false;
    let markerCoords = DEFAULT_CENTER;

    try {
        // Fetch real boundaries for the whole country
        const response = await fetch('js/malta-localities.json');
        if (response.ok) {
            const geoJson = await response.json();
            const normalizedLoc = locationName ? locationName.trim().toLowerCase() : '';

            // 1. Add Base Layer (All Localities)
            const vectorLayer = L.geoJSON(geoJson, {
                style: function(feature) {
                    // Check if this is the active location
                    const fname = feature.properties.name.toLowerCase();
                    const isActive = normalizedLoc && (fname === normalizedLoc || fname.includes(normalizedLoc) || normalizedLoc.includes(fname));
                    
                    if (isActive) {
                        locationFound = true;
                        markerCoords = null; // Will calculate center
                        return {
                            color: '#059669',      // Emerald 600 Border (Darker)
                            fillColor: '#10b981',  // Emerald 500 Fill
                            fillOpacity: 0.35,     // Increased opacity
                            weight: 2,
                            dashArray: '5, 5'
                        };
                    } else {
                        // Inactive / Base Style
                        return {
                            color: '#cbd5e1',      // Slate 300 Border (Visible gray)
                            fillColor: '#ffffff',  // Pure White Land
                            fillOpacity: 1,
                            weight: 1,
                            dashArray: null
                        };
                    }
                },
                onEachFeature: function(feature, layer) {
                    // Calculate center for the active one
                    const fname = feature.properties.name.toLowerCase();
                    if (normalizedLoc && (fname === normalizedLoc || fname.includes(normalizedLoc) || normalizedLoc.includes(fname))) {
                        markerCoords = layer.getBounds().getCenter();
                        // Fit bounds to the active item, but keep context
                        map.fitBounds(layer.getBounds(), { padding: [50, 50], maxZoom: 14 });
                        // Update official name
                        locationName = feature.properties.name;
                    }
                }
            }).addTo(map);

        } else {
            console.warn('Failed to load localities JSON');
        }
    } catch (err) {
        console.error('Error loading map data:', err);
    }

    // Fallback if vector match failed
    if (!locationFound && locationName) {
        // Clean locationName for fallback matching too
        let cleanName = locationName.replace(/,\s*null/gi, '').trim(); 
        const normalizedLoc = cleanName.toLowerCase();
        
        const cityKey = Object.keys(MALTA_CITIES).find(city => 
            city.toLowerCase() === normalizedLoc ||
            normalizedLoc.includes(city.toLowerCase()) || 
            city.toLowerCase().includes(normalizedLoc)
        );

        if (cityKey) {
            markerCoords = MALTA_CITIES[cityKey];
            locationFound = true;
            locationName = cityKey; 
            map.setView(markerCoords, CITY_ZOOM);
        }
    }

    // Clean location name for display (remove "valletta, null" artifact)
    const displayLocation = locationName ? locationName.replace(/,\s*null/gi, '').replace(/\bnull\b/gi, '').trim() : 'Malta';

    // Add Marker
    if (locationFound || markerCoords) { // Always show marker if we have coords
        const greenIcon = L.divIcon({
            className: 'custom-map-marker',
            html: `<div style="
                background-color: #10b981;
                width: 32px;
                height: 32px;
                border-radius: 50% 50% 0 50%;
                transform: rotate(45deg);
                border: 3px solid white;
                box-shadow: 2px 2px 6px rgba(0,0,0,0.25);
                display: flex;
                align-items: center;
                justify-content: center;
            "><i class="fas fa-map-marker-alt" style="transform: rotate(-45deg); color: white; font-size: 14px;"></i></div>`,
            iconSize: [32, 32],
            iconAnchor: [16, 32],
            popupAnchor: [0, -32]
        });

        // Ensure we have coords
        if (!markerCoords) markerCoords = DEFAULT_CENTER;

        L.marker(markerCoords, { icon: greenIcon }).addTo(map)
            .bindPopup(`<div style="text-align: center; font-family: 'Inter', sans-serif;">
                <b style="color: #0f172a; font-size: 1.05em; display:block; margin-bottom:2px;">${displayLocation}</b>
                <span style="color: #64748b; font-size: 0.85em;">Satıcı Konumu</span>
            </div>`)
            .openPopup();
    }

    setTimeout(() => map.invalidateSize(), 250);
}
