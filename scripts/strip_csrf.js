// Strip all CSRF hidden inputs from EJS templates
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const viewsDir = path.join(__dirname, '..', 'views');

function walk(dir) {
    let results = [];
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) results.push(...walk(full));
        else if (entry.name.endsWith('.ejs')) results.push(full);
    }
    return results;
}

let count = 0;
for (const file of walk(viewsDir)) {
    let content = fs.readFileSync(file, 'utf8');
    // Remove hidden CSRF input lines (with any surrounding whitespace/newline)
    const cleaned = content.replace(/[ \t]*<input type="hidden" name="_csrf" value="<%=\s*csrfToken\s*%>" \/>\s*\r?\n?/g, '');
    if (cleaned !== content) {
        fs.writeFileSync(file, cleaned, 'utf8');
        console.log('Cleaned:', path.relative(viewsDir, file));
        count++;
    }
}
console.log(`\nDone. Cleaned ${count} files.`);
