/**
 * Premium Malta SVG Map Component
 * Renders a specialized map for Malta with highlighted councils.
 */

const MALTA_CITIES_SLUGS = {
    'valletta': 'valletta',
    'sliema': 'sliema',
    'st. julian\'s': 'sanġiljan',
    'san gilian': 'sanġiljan',
    'san giljan': 'sanġiljan',
    'gzira': 'il-gżira',
    'msida': 'msida',
    'birkirkara': 'birkirkara',
    'mosta': 'mosta',
    'naxxar': 'naxxar',
    'san gwann': 'sanġwann',
    'swieqi': 'swieqi',
    'pembroke': 'pembroke',
    'mellieha': 'mellieħa',
    'st. paul\'s bay': 'stpauls-bay',
    'bugibba': 'stpauls-bay',
    'qawra': 'stpauls-bay',
    'mdina': 'mdina',
    'rabat': 'rabat',
    'attard': 'attard',
    'balzan': 'balzan',
    'lija': 'lija',
    'hamrun': 'ħamrun',
    'marsa': 'marsa',
    'paola': 'raħalġdid',
    'rahal gdid': 'raħalġdid',
    'tarxien': 'tarxien',
    'zejtun': 'iż-żejtun',
    'marsaxlokk': 'marsa', // Mapping to generic area if exact slug not found
    'birzebbuga': 'birżebbuġa',
    'zurrieq': 'iż-żurrieq',
    'luqa': 'luqa',
    'qormi': 'qormi',
    'zebbug': 'ħaż-żebbuġ',
    'siggiewi': 'is-siġġiewi',
    'victoria': 'rabat',
    'rabat (gozo)': 'rabat',
    'xaghra': 'ix-xagħra',
    'nadur': 'nadur',
    'ghajnsielem': 'għajnsielem',
    'mgarr': 'għajnsielem',
    'xewkija': 'xewkija',
    'sannat': 'sannat',
    'munxar': 'munxar',
    'fontana': 'fontana',
    'gharb': 'l-għarb',
    'ghasri': 'l-għasri',
    'san lawrenz': 'san-lawrenz',
    'kercem': 'ta\'kerċem',
    'zebbug (gozo)': 'iż-żebbuġ'
};

/**
 * Initializes the Malta SVG map in the given container
 * @param {string} cityName - The name of the city to highlight
 * @param {string} [containerId] - Optional container ID
 */
export async function initMaltaSVGMap(cityName, containerId) {
    const container = containerId ? document.getElementById(containerId) : (document.getElementById('seller-map-container') || document.getElementById('malta-map-svg-container') || document.getElementById('seller-map-container-desktop') || document.getElementById('malta-map-svg-mobile'));
    if (!container) return;

    // Normalize cityName
    const normalizedCity = cityName ? cityName.toLowerCase()
        .replace(/[\u0131]/g, 'i')      // ı → i
        .replace(/[\u011f]/g, 'g')      // ğ → g
        .replace(/[\u015f]/g, 's')      // ş → s
        .replace(/[\u00e7]/g, 'c')      // ç → c
        .replace(/[\u00f6]/g, 'o')      // ö → o
        .replace(/[\u00fc]/g, 'u')      // ü → u
        .replace('st. ', 'st')
        .replace('\'', '')
        .trim() : '';

    const targetSlug = MALTA_CITIES_SLUGS[normalizedCity] || normalizedCity;

    try {
        const response = await fetch('js/malta_councils.json');
        if (!response.ok) throw new Error('Could not load map data');
        const mapData = await response.json();

        renderSVG(container, mapData.paths, targetSlug, cityName);
    } catch (error) {
        console.error('SVG Map load error:', error);
        // Fallback to simple label
        container.innerHTML = `<div class="map-fallback">
            <i class="fas fa-map-marker-alt"></i>
            <p>${cityName || 'Malta'}</p>
        </div>`;
    }
}

function renderSVG(container, paths, targetSlug, originalName) {
    container.innerHTML = '';
    container.className = 'malta-svg-map-container';

    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", "40 25 920 705");
    svg.setAttribute("width", "100%");
    svg.setAttribute("height", "100%");
    
    const g = document.createElementNS("http://www.w3.org/2000/svg", "g");

    paths.forEach(pathData => {
        const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
        path.setAttribute("d", pathData.d);
        
        // Check if highlighted
        const isHighlighted = pathData.slug === targetSlug;
        
        path.setAttribute("fill", isHighlighted ? "#10b981" : "#ffffff");
        path.setAttribute("stroke", "#cbd5e1");
        path.setAttribute("stroke-width", "1.5");
        path.setAttribute("class", isHighlighted ? "map-path highlighted" : "map-path");

        if (isHighlighted) {
            // Add pulse effect via CSS
        }

        g.appendChild(path);
    });

    svg.appendChild(g);
    container.appendChild(svg);

    // Add overlay Label
    const label = document.createElement('div');
    label.className = 'map-floating-label';
    label.innerHTML = `
        <i class="fas fa-map-marker-alt"></i>
        <div class="label-text">
            <strong>${originalName || 'Malta'}</strong>
            <span>Seller Location</span>
        </div>
    `;
    container.appendChild(label);
}
