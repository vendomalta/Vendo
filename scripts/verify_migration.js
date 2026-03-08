
const fs = require('fs');
const path = require('path');
const https = require('https');

// Read config
const supabaseContent = fs.readFileSync(path.join(__dirname, '../js/supabase.js'), 'utf8');
const urlMatch = supabaseContent.match(/const FALLBACK_URL = '(.*?)'/);
const keyMatch = supabaseContent.match(/const FALLBACK_KEY = '(.*?)'/);

if (!urlMatch || !keyMatch) {
    console.error('No config found');
    process.exit(1);
}

const SUPABASE_URL = urlMatch[1];
const SUPABASE_KEY = keyMatch[1]; // Using default/anon key for verification

const categoriesUrl = `${SUPABASE_URL}/rest/v1/categories?select=*&name=eq.Residential for Sale`;

const options = {
    method: 'GET',
    headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`
    }
};

const req = https.request(categoriesUrl, options, (res) => {
    let body = '';
    res.on('data', chunk => body += chunk);
    res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
            const data = JSON.parse(body);
            if (data.length > 0) {
                const cat = data[0];
                console.log(`✅ Category '${cat.name}' Found:`);
                console.log('ID:', cat.id);
                console.log('Config Type:', typeof cat.extra_fields_config);
                const hasConfig = cat.extra_fields_config && Object.keys(cat.extra_fields_config).length > 0;
                console.log('Has Config Content:', hasConfig);
                if (hasConfig) console.log('Config Preview:', JSON.stringify(cat.extra_fields_config).substring(0, 100) + '...');
            } else {
                console.warn("⚠️ Category 'Residential for Sale' not found.");
            }
        } else {
            console.error('❌ Request failed: ' + res.statusCode + ' ' + body);
        }
    });
});
req.on('error', (e) => console.error('Error:', e));
req.end();
