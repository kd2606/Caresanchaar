const fs = require('fs');
const path = require('path');

function walkDir(dir, callback) {
    fs.readdirSync(dir).forEach(f => {
        let dirPath = path.join(dir, f);
        let isDirectory = fs.statSync(dirPath).isDirectory();
        isDirectory ? walkDir(dirPath, callback) : callback(dirPath);
    });
}

walkDir('./src', (filePath) => {
    if (filePath.endsWith('.ts') || filePath.endsWith('.tsx') || filePath.endsWith('.svg')) {
        let content = fs.readFileSync(filePath, 'utf8');
        let newContent = content.replace(/diagnoverse/gi, 'caresanchaar');
        newContent = newContent.replace(/DiagnoVerse/g, 'CareSanchaar');
        newContent = newContent.replace(/DIAGNOVERSE/g, 'CARESANCHAAR');
        
        // specifically for module strings in triage engine
        newContent = newContent.replace(/@module caresanchaar\//gi, '@module triage-engine/');
        newContent = newContent.replace(/caresanchaar\.sync/gi, 'caresanchaar.sync');
        
        // Let's preserve specific domain endings, so caresanchaar.ai -> caresanchaar.in or .com?
        // Wait, I replaced diagnoverse with caresanchaar. It will become caresanchaar.ai. The user prompt in step 2 said "caresanchaar". Let's change .ai to .com later if needed.

        if (content !== newContent) {
            fs.writeFileSync(filePath, newContent, 'utf8');
            console.log('Updated ' + filePath);
        }
    }
});
