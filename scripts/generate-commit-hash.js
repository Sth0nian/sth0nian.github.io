const fs = require('fs');
const { execSync } = require('child_process');
const path = require('path');

function generateCommitHash() {
    try {
        // Get the short commit hash
        const commitHash = execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim();
        
        // Write to commit-hash.txt in the root directory
        const outputFile = path.join(__dirname, '..', 'commit-hash.txt');
        fs.writeFileSync(outputFile, commitHash);
        
        console.log(`Generated commit-hash.txt with hash: ${commitHash}`);
    } catch (error) {
        console.error('Error generating commit hash:', error.message);
        // Write a fallback
        const outputFile = path.join(__dirname, '..', 'commit-hash.txt');
        fs.writeFileSync(outputFile, 'dev');
        console.log('Generated commit-hash.txt with fallback: dev');
    }
}

generateCommitHash(); 