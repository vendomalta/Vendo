const fs = require('fs');
const path = require('path');

function extractAndTest(filePath, startMarker, endMarker, isArray) {
    console.log(`\n--- Testing ${path.basename(filePath)} ---`);
    const content = fs.readFileSync(filePath, 'utf8');

    // Simple extraction strategy similar to robust script
    const startIdx = content.indexOf(startMarker);
    if (startIdx === -1) {
        console.error('Start marker not found');
        return;
    }

    const sub = content.substring(startIdx + startMarker.length);
    let openChar = isArray ? '[' : '{';
    let closeChar = isArray ? ']' : '}';
    let depth = 0;
    let endIndex = -1;
    let foundStart = false;

    for (let i = 0; i < sub.length; i++) {
        if (sub[i] === openChar) {
            depth++;
            foundStart = true;
        } else if (sub[i] === closeChar) {
            depth--;
            if (foundStart && depth === 0) {
                endIndex = i + 1;
                break;
            }
        }
    }

    if (endIndex === -1) {
        console.error('End of block not found');
        return;
    }

    const rawData = sub.substring(0, endIndex);
    const firstCharIdx = rawData.indexOf(openChar);
    const codeToEval = rawData.substring(firstCharIdx);

    console.log(`Extracted ${codeToEval.length} chars.`);
    console.log('Sample start:', codeToEval.substring(0, 50).replace(/\n/g, '\\n'));
    console.log('Sample end:', codeToEval.substring(codeToEval.length - 50).replace(/\n/g, '\\n'));

    try {
        eval('(' + codeToEval + ')');
        console.log('✅ EVAL SUCCESS: Valid JS Object/Array');
    } catch (e) {
        console.error('❌ EVAL FAILED:', e.message);
        // Dump the area around the error if possible? hard to know index from eval error
    }
}

const jsDir = path.join(__dirname, '../js');
extractAndTest(path.join(jsDir, 'category-data.js'), 'const categories =', ';', true);
extractAndTest(path.join(jsDir, 'ilan-ver-form.js'), 'const categoryFieldsConfig =', ';', false);
