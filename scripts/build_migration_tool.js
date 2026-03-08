const fs = require('fs');
const path = require('path');

async function build() {
    console.log('Building standalone migration tool...');

    // 1. Get Supabase Config
    const supabaseContent = fs.readFileSync(path.join(__dirname, '../js/supabase.js'), 'utf8');
    const urlMatch = supabaseContent.match(/const FALLBACK_URL = '(.*?)'/);
    const keyMatch = supabaseContent.match(/const FALLBACK_KEY = '(.*?)'/);

    if (!urlMatch || !keyMatch) {
        throw new Error('Could not find Supabase credentials');
    }

    const SUPABASE_URL = urlMatch[1];
    const SUPABASE_KEY = keyMatch[1];

    // 2. Get Categories
    const catContent = fs.readFileSync(path.join(__dirname, '../js/category-data.js'), 'utf8');
    // Extract array content: export const categories = [...];
    const catStart = catContent.indexOf('export const categories = [');
    const catEnd = catContent.indexOf('];', catStart);
    if (catEnd === -1) throw new Error('Could not find end of categories array');
    const categoriesJson = catContent.substring(catStart + 26, catEnd + 2); // 'categories = [...]'

    // 3. Get Field Config
    const formContent = fs.readFileSync(path.join(__dirname, '../js/ilan-ver-form.js'), 'utf8');
    const configStart = formContent.indexOf('const categoryFieldsConfig = {');
    // Find the end by looking for the function that follows (heuristic)
    // or by counting braces (safer)

    let configStr = '';
    if (configStart !== -1) {
        let openBraces = 0;
        let foundStart = false;
        let endIndex = -1;

        for (let i = configStart; i < formContent.length; i++) {
            if (formContent[i] === '{') {
                openBraces++;
                foundStart = true;
            } else if (formContent[i] === '}') {
                openBraces--;
            }

            if (foundStart && openBraces === 0) {
                endIndex = i + 1;
                break;
            }
        }

        if (endIndex !== -1) {
            configStr = formContent.substring(configStart, endIndex);
            // remove 'const ' to make it a global var assignment or valid JS
            configStr = configStr.replace('const categoryFieldsConfig', 'var categoryFieldsConfig');
        } else {
            console.error('Could not find end of categoryFieldsConfig');
        }
    }

    // 4. Create HTML
    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Standalone Migration Tool</title>
    <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
    <style>
        body { font-family: sans-serif; padding: 20px; max-width: 800px; margin: 0 auto; }
        .log { background: #333; color: #fff; padding: 10px; height: 300px; overflow-y: auto; font-family: monospace; }
        .success { color: #4ade80; }
        .error { color: #f87171; }
    </style>
</head>
<body>
    <h1>Migration Tool (Standalone)</h1>
    <button onclick="startMigration()" style="padding:10px 20px; font-size:16px; cursor:pointer;">Start Migration</button>
    <div id="status" style="margin:10px 0; font-weight:bold;"></div>
    <div class="log" id="log"></div>

    <script>
        window.onerror = function(msg, url, line, col, error) {
            const status = document.getElementById('status');
            if(status) status.textContent = 'ERROR';
            alert('Script Error: ' + msg + '\nLine: ' + line);
            return false;
        };

        // DATA
        const categories = ${categoriesJson}
        
        // CONFIG
        ${configStr}

        // SUPABASE
        const SUPABASE_URL = '${SUPABASE_URL}';
        const SUPABASE_KEY = '${SUPABASE_KEY}';
        const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

        function log(msg, type='') {
            const el = document.getElementById('log');
            const div = document.createElement('div');
            div.textContent = msg;
            if(type) div.className = type;
            el.appendChild(div);
            el.scrollTop = el.scrollHeight;
        }

        async function startMigration() {
            const btn = document.querySelector('button');
            btn.disabled = true;
            document.getElementById('status').textContent = 'Running...';
            
            try {
                // Auth check
                const { data: { user } } = await supabase.auth.getUser();
                if (!user) {
                    log('ERROR: You must be logged in. Please log in to the app in another tab first, or wait...', 'error');
                     // Try to see if session is persisted in localstorage from the app?
                     // Cross-tab auth might need same domain. If opening file://, it has no domain.
                     // IMPORTANT: file:// origin cannot share localStorage with localhost or domain.
                     // We might need to ask user to login HERE.
                }

                if (!user) {
                     const email = prompt('Enter Admin Email:');
                     const password = prompt('Enter Admin Password:');
                     if(email && password) {
                        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
                        if(error) throw error;
                        log('Logged in as ' + data.user.email, 'success');
                     } else {
                        throw new Error('Login required');
                     }
                }

                log('Starting migration for ' + categories.length + ' categories...');
                
                const sortedCategories = [...categories].sort((a, b) => (a.level || 0) - (b.level || 0));

                for (const cat of sortedCategories) {
                    let config = null;
                    // match config by ID or name if needed, but the object uses keys like 'Real Estate' etc.
                    // The 'id' in categories array is numeric e.g. 1, 101.
                    // The keys in categoryFieldsConfig are names e.g. 'Real Estate', 'Residential for Sale'.
                    
                    // Try to find matching config
                    // categoryFieldsConfig is keyed by English Name mostly
                    if (categoryFieldsConfig[cat.name]) {
                        config = categoryFieldsConfig[cat.name];
                    }
                    
                    const dbCat = {
                        id: cat.id,
                        name: cat.name,
                        slug: cat.slug,
                        parent_id: cat.parentId,
                        icon: cat.icon,
                        icon_color: cat.iconColor,
                        level: cat.level,
                        extra_fields_config: config
                    };

                    log('Migrating: ' + cat.name + '...', 'info');
                    
                    const { error } = await supabase.from('categories').upsert(dbCat);
                    if (error) {
                        log('FAILED: ' + cat.name + ' - ' + error.message, 'error');
                    } else {
                        log('SUCCESS: ' + cat.name, 'success');
                    }
                }
                
                document.getElementById('status').textContent = 'DONE';
                alert('Migration Complete!');

            } catch (e) {
                log('CRITICAL ERROR: ' + e.message, 'error');
            } finally {
                btn.disabled = false;
            }
        }
    </script>
</body>
</html>
    `;

    fs.writeFileSync(path.join(__dirname, '../migrate-standalone.html'), html);
    console.log('Created migrate-standalone.html');
}

build().catch(console.error);
