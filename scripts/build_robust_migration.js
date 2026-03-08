const fs = require('fs');
const path = require('path');

// Helper to sanitize JS content by evaluating it to an object and then stringifying
function sanitizeJsData(rawContent, startMarker, endMarker, isArray = true) {
    try {
        const startIdx = rawContent.indexOf(startMarker);
        if (startIdx === -1) throw new Error(`Marker not found: ${startMarker}`);

        let sub = rawContent.substring(startIdx + startMarker.length);

        // Find end
        // heuristic: if array, matching brackets. if object, matching braces.
        // Or simpler: rely on the fact that the variable decl ends with ; or is at end of file.
        // The passed rawContent might be just the file content.

        // For 'categories = [', we want to find the matching '];'
        // For 'categoryFieldsConfig = {', we want to find the matching '};' or end of block.

        let openChar = isArray ? '[' : '{';
        let closeChar = isArray ? ']' : '}';

        let depth = 0;
        let foundStart = false;
        let endIndex = -1;

        // We start scanning from the beginning of the substring (which should start with [ or { or spaces)
        // Actually, startMarker might not include the opening brace/bracket if we passed "const foo = "

        for (let i = 0; i < sub.length; i++) {
            const char = sub[i];
            if (char === openChar) {
                depth++;
                foundStart = true;
            } else if (char === closeChar) {
                depth--;
                if (foundStart && depth === 0) {
                    endIndex = i + 1; // Include the closing brace
                    break;
                }
            }
        }

        if (endIndex === -1) throw new Error(`Could not find end of data block for ${startMarker}`);

        const jsonLikeString = sub.substring(0, endIndex);
        // Trim beginning until openChar to ensure eval works if there are spaces
        const firstCharIdx = jsonLikeString.indexOf(openChar);
        const codeToEval = jsonLikeString.substring(firstCharIdx);

        // EVALUATE
        // We use 'eval' to parse the JS structure (handling comments, single quotes, etc.)
        // This is safe-ish here because we control the source files and are running in build environment.
        const data = eval('(' + codeToEval + ')');

        return JSON.stringify(data, null, 2); // Pretty print JSON
    } catch (e) {
        console.error(`Sanitization failed for ${startMarker}:`, e.message);
        throw e;
    }
}

async function build() {
    console.log('Building robust migration tool...');

    const jsDir = path.join(__dirname, '../js');

    // 1. Get Supabase Config
    const supabaseContent = fs.readFileSync(path.join(jsDir, 'supabase.js'), 'utf8');
    const urlMatch = supabaseContent.match(/const FALLBACK_URL = '(.*?)'/);
    const keyMatch = supabaseContent.match(/const FALLBACK_KEY = '(.*?)'/);

    if (!urlMatch || !keyMatch) throw new Error('Supabase credentials missing');
    const SUPABASE_URL = urlMatch[1];
    const SUPABASE_KEY = keyMatch[1];

    // 2. Get Categories (Clean JSON)
    const catContent = fs.readFileSync(path.join(jsDir, 'category-data.js'), 'utf8');
    // Look for: "export const categories = ["
    // We pass "categories =" as marker and ensure we find [
    const categoriesJson = sanitizeJsData(catContent, 'const categories =', ';', true);

    // 3. Get Field Config (Clean JSON)
    const formContent = fs.readFileSync(path.join(jsDir, 'ilan-ver-form.js'), 'utf8');
    // Look for: "const categoryFieldsConfig = {"
    const configJson = sanitizeJsData(formContent, 'const categoryFieldsConfig =', ';', false);

    // 4. Create HTML
    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Standalone Migration Tool (Robust)</title>
    <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; padding: 20px; max-width: 800px; margin: 0 auto; background: #f9f9f9; }
        h1 { color: #333; }
        .log { background: #1e1e1e; color: #eee; padding: 15px; height: 400px; overflow-y: auto; font-family: "Consolas", "Monaco", monospace; border-radius: 6px; border: 1px solid #ccc; font-size: 13px; line-height: 1.4; }
        .log div { margin-bottom: 4px; }
        .success { color: #4ade80; }
        .error { color: #ef4444; }
        .info { color: #60a5fa; }
        button { background: #2563eb; color: white; border: none; padding: 12px 24px; font-size: 16px; font-weight: bold; border-radius: 6px; cursor: pointer; transition: background 0.2s; }
        button:hover { background: #1d4ed8; }
        button:disabled { background: #93c5fd; cursor: not-allowed; }
        #status { margin: 15px 0; font-weight: bold; min-height: 20px; }
    </style>
</head>
<body>
    <h1>Migration Tool (Robusto)</h1>
    <div style="margin-bottom: 20px;">
        <p>This tool will migrate categories and field configurations to Supabase.</p>
        <button onclick="startMigration()">Start Migration</button>
        <div id="status">Ready</div>
    </div>
    <div class="log" id="log"></div>

    <script>
        // Global error handler
        window.onerror = function(msg, url, line, col, error) {
            const el = document.getElementById('log');
            if(el) {
                const div = document.createElement('div');
                div.textContent = 'CRITICAL SCRIPT ERROR: ' + msg + ' (Line ' + line + ')';
                div.style.color = 'red';
                div.style.fontWeight = 'bold';
                el.appendChild(div);
            }
            alert('JavaScript Error:\\n' + msg + '\\nLine: ' + line);
            return false;
        };

        // INJECTED DATA (Pure JSON)
        const categories = ${categoriesJson};
        const categoryFieldsConfig = ${configJson};

        // SUPABASE CONFIG
        const SUPABASE_URL = '${SUPABASE_URL}';
        const SUPABASE_KEY = '${SUPABASE_KEY}';
        
        let supabaseClient;
        try {
            supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
        } catch(e) {
            console.error('Supabase init failed', e);
            document.getElementById('log').innerHTML += '<div class="error">Failed to initialize Supabase client. Check console.</div>';
        }

        function log(msg, type='info') {
            const el = document.getElementById('log');
            const div = document.createElement('div');
            div.textContent = \`[\${new Date().toLocaleTimeString()}] \${msg}\`;
            div.className = type;
            el.appendChild(div);
            el.scrollTop = el.scrollHeight;
        }

        async function startMigration() {
            const btn = document.querySelector('button');
            const status = document.getElementById('status');
            
            if (!supabaseClient) {
                alert('Supabase client not initialized.');
                return;
            }

            btn.disabled = true;
            status.textContent = 'Authenticating...';
            
            try {
                // Auth check
                // Since this is a migration tool, we need high privileges.
                // If the user provides a Service Role Key, we use that.
                
                let serviceKey = prompt('Please enter your Supabase SERVICE_ROLE KEY (secret) to authorize migration.\\n\\n(Find this in Supabase Dashboard -> Project Settings -> API)');
                
                if (serviceKey) {
                    // Re-initialize with Service Key (Admin rights, bypasses RLS)
                    supabaseClient = window.supabase.createClient(SUPABASE_URL, serviceKey);
                    log('Authorized with Service Role Key (Admin Mode)', 'success');
                } else {
                    // Fallback to existing session (if any) or existing client
                    const { data: { user } } = await supabaseClient.auth.getUser();
                    if (user) {
                         log('Logged in as ' + user.email, 'success');
                    } else {
                         throw new Error('Authorization failed. Please provide the Service Role Key.');
                    }
                }

                status.textContent = 'Migrating...';
                log('Starting migration for ' + categories.length + ' categories...');
                
                // Sort by level to ensure parents exist before children
                const sortedCategories = [...categories].sort((a, b) => (a.level || 0) - (b.level || 0));

                let successCount = 0;
                let failCount = 0;

                for (const cat of sortedCategories) {
                    let config = categoryFieldsConfig[cat.name] || null;
                    
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

                    try {
                        const { error } = await supabaseClient.from('categories').upsert(dbCat);
                        if (error) throw error;
                        log('Saved: ' + cat.name, 'success');
                        successCount++;
                    } catch (err) {
                        log('FAILED: ' + cat.name + ' - ' + err.message, 'error');
                        failCount++;
                    }
                }
                
                status.textContent = 'Completed';
                log('Migration finished. Success: ' + successCount + ', Failed: ' + failCount, successCount > 0 ? 'success' : 'error');
                alert('Migration process finished!');

            } catch (e) {
                status.textContent = 'Error';
                log('PROCESS FAILED: ' + e.message, 'error');
                alert('Error: ' + e.message);
            } finally {
                btn.disabled = false;
            }
        }
    </script>
</body>
</html>
    `;

    fs.writeFileSync(path.join(__dirname, '../migrate-standalone.html'), html);
    console.log('Created migrate-standalone.html successfully.');
}

build().catch(err => {
    console.error('Build script failed:', err);
    process.exit(1);
});
