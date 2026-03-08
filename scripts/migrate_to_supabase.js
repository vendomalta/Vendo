
/**
 * Standalone Node.js script to migrate categories to Supabase.
 * Usage: node scripts/migrate_to_supabase.js
 * 
 * This script bypasses browser security restrictions by running server-side.
 * It uses the REST API directly to avoid dependency checks.
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

// Helper for HTTP Request (Node.js < 18 compatible if needed, but modern Node has fetch)
// We'll use a wrapper around https for zero-dependency robustness
function request(url, options, data) {
    return new Promise((resolve, reject) => {
        const req = https.request(url, options, (res) => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => {
                try {
                    const response = {
                        status: res.statusCode,
                        headers: res.headers,
                        data: body ? JSON.parse(body) : null
                    };
                    if (res.statusCode >= 200 && res.statusCode < 300) {
                        resolve(response);
                    } else {
                        reject(new Error(`Request failed with status ${res.statusCode}: ${body}`));
                    }
                } catch (e) {
                    reject(e);
                }
            });
        });

        req.on('error', reject);

        if (data) {
            req.write(JSON.stringify(data));
        }
        req.end();
    });
}

async function migrate() {
    console.log('🚀 Starting migration to Supabase (Node.js)...');

    try {
        // 1. Get Credentials from js/supabase.js
        const supabasePath = path.join(__dirname, '../js/supabase.js');
        if (!fs.existsSync(supabasePath)) throw new Error('js/supabase.js not found!');

        const supabaseContent = fs.readFileSync(supabasePath, 'utf8');
        const urlMatch = supabaseContent.match(/const FALLBACK_URL = '(.*?)'/);

        // Try to find ANY key (Service Role or Anon)
        // If the file has a key starting with 'service_role', that is what we want.
        // If it sends 'anon', we might have permission issues unless we ask user.
        // Based on previous error "Forbidden...secret API key", the file LIKELY contains the secret key.
        const keyMatch = supabaseContent.match(/const FALLBACK_KEY = '(.*?)'/);

        if (!urlMatch || !keyMatch) {
            throw new Error('Could not parse URL or Key from js/supabase.js');
        }

        const SUPABASE_URL = urlMatch[1];
        let SUPABASE_KEY = keyMatch[1];

        // Check for command line argument override (Service Role Key)
        if (process.argv[2]) {
            console.log('Using provided key from command line...');
            SUPABASE_KEY = process.argv[2];
        } else {
            // Ask for key interactively
            const readline = require('readline').createInterface({
                input: process.stdin,
                output: process.stdout
            });

            SUPABASE_KEY = await new Promise(resolve => {
                readline.question('Lütfen Supabase Service Role Key (secret) anahtarınızı yapıştırıp Enter\'a basın: ', (key) => {
                    readline.close();
                    resolve(key.trim());
                });
            });

            if (!SUPABASE_KEY) {
                console.log('No key provided, falling back to supabase.js (might fail if anon key)...');
                SUPABASE_KEY = keyMatch[1];
            }
        }
        console.log(`Target URL: ${SUPABASE_URL}`);

        // 2 & 3. Read Data from migrate-standalone.html (Source of truth for static data)
        const htmlPath = path.join(__dirname, '../migrate-standalone.html');
        if (!fs.existsSync(htmlPath)) throw new Error('migrate-standalone.html not found! Please run the build script or restore the file.');

        const htmlContent = fs.readFileSync(htmlPath, 'utf8');

        // Extract Categories
        // Look for: const categories = [...]
        const catMatch = htmlContent.match(/const categories = (\[[\s\S]*?\])/);
        if (!catMatch) throw new Error('Could not find categories in HTML');
        const categories = eval(catMatch[1]);
        console.log(`Found ${categories.length} categories.`);

        // Extract Field Config
        // Robust extraction using brace counting
        let categoryFieldsConfig = {};

        // Search for variable declaration (var or const)
        let configStart = htmlContent.indexOf('var categoryFieldsConfig = {');
        if (configStart === -1) {
            configStart = htmlContent.indexOf('const categoryFieldsConfig = {');
        }

        if (configStart !== -1) {
            // Find the first opening brace
            const openBraceIndex = htmlContent.indexOf('{', configStart);
            if (openBraceIndex !== -1) {
                let openBraces = 0;
                let endIndex = -1;

                for (let i = openBraceIndex; i < htmlContent.length; i++) {
                    if (htmlContent[i] === '{') {
                        openBraces++;
                    } else if (htmlContent[i] === '}') {
                        openBraces--;
                        if (openBraces === 0) {
                            endIndex = i + 1;
                            break;
                        }
                    }
                }

                if (endIndex !== -1) {
                    const configStr = htmlContent.substring(openBraceIndex, endIndex);
                    try {
                        // Wrapping in parentheses for safe eval of object literal
                        categoryFieldsConfig = eval(`(${configStr})`);
                        console.log(`Parsed field configurations successfully.`);
                    } catch (e) {
                        console.error('Failed to eval config:', e);
                    }
                }
            }
        } else {
            console.warn('Could not find categoryFieldsConfig definition in HTML.');
        }

        // 4. Migrate
        console.log('Beginning upload...');
        let successCount = 0;
        let failCount = 0;

        const endpoints = `${SUPABASE_URL}/rest/v1/categories`;

        // Sort by level to ensure parents exist (though foreign keys might be deferred or not strict)
        // Supabase/Postgres FKs require parent to exist first.
        const sortedCategories = [...categories].sort((a, b) => (a.level || 0) - (b.level || 0));

        // Chunking? No, let's do one by one to see errors clearly
        for (const cat of sortedCategories) {
            const config = categoryFieldsConfig[cat.name] || null;

            const payload = {
                id: cat.id,
                name: cat.name,
                slug: cat.slug,
                parent_id: cat.parentId,
                icon: cat.icon,
                icon_color: cat.iconColor,
                level: cat.level,
                extra_fields_config: config
            };

            const options = {
                method: 'POST',
                headers: {
                    'apikey': SUPABASE_KEY,
                    'Authorization': `Bearer ${SUPABASE_KEY}`,
                    'Content-Type': 'application/json',
                    'Prefer': 'resolution=merge-duplicates' // Upsert
                }
            };

            try {
                // Upsert via POST with Prefer header
                // We'll filter columns? No, send all.
                await request(`${endpoints}?on_conflict=id`, options, payload);
                process.stdout.write('.'); // Progress dot
                successCount++;
            } catch (err) {
                console.error(`\n❌ Failed ${cat.name}:`, err.message);
                failCount++;
            }
        }

        console.log(`\n\nMigration complete!`);
        console.log(`✅ Success: ${successCount}`);
        console.log(`❌ Failed: ${failCount}`);

    } catch (error) {
        console.error('\nScript Error:', error);
    }
}

migrate();
