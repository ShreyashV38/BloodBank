import fs from 'fs';
import path from 'path';
import zlib from 'zlib';

function readDocx(filePath) {
    return new Promise((resolve, reject) => {
        fs.readFile(filePath, (err, data) => {
            if (err) return reject(err);
            const AdmZip = require('adm-zip');
            const zip = new AdmZip(data);
            const docXml = zip.readAsText('word/document.xml');
            
            // Extract text from XML
            const text = docXml.replace(/<w:p[^>]*>/g, '\n')
                               .replace(/<[^>]+>/g, '')
                               .replace(/&lt;/g, '<')
                               .replace(/&gt;/g, '>')
                               .replace(/&amp;/g, '&');
            
            resolve(text);
        });
    });
}

async function run() {
    try {
        const text = await readDocx(path.join(process.cwd(), 'docs', 'Mini_Project_Report (1).docx'));
        console.log(text.substring(0, 3000));
        fs.writeFileSync('docs/extracted_report.txt', text);
    } catch(e) {
        console.error(e);
    }
}
run();
