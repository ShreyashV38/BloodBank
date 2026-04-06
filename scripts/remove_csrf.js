import fs from 'fs';
import path from 'path';

function walkAndReplace(dir) {
    const list = fs.readdirSync(dir);
    list.forEach(file => {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);
        if (stat && stat.isDirectory()) {
            walkAndReplace(filePath);
        } else if (filePath.endsWith('.ejs')) {
            let content = fs.readFileSync(filePath, 'utf8');
            const originalLength = content.length;
            // Regex to remove the csrf hidden input tag
            content = content.replace(/<input type="hidden" name="_csrf" value=".*?" \/>\r?\n?/g, '');
            if (content.length !== originalLength) {
                fs.writeFileSync(filePath, content);
                console.log(`Removed CSRF from: ${filePath}`);
            }
        }
    });
}

walkAndReplace('./views');
console.log('Done removing CSRF fields.');
