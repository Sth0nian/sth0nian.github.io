const fs = require('fs');
const path = require('path');

// Function to parse date from filename (format: YYYY-MM-DD-HH-MM.md)
function parseDateFromFilename(filename) {
    const match = filename.match(/(\d{4})-(\d{2})-(\d{2})-(\d{2})-(\d{2})\.md$/);
    if (match) {
        const [, year, month, day, hour, minute] = match;
        return `${year}-${month}-${day} ${hour}:${minute}`;
    }
    return null;
}

// Function to parse markdown file and extract article data
function parseMarkdownFile(filePath) {
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');
    
    // Extract title from first line (remove # and trim)
    const titleLine = lines[0];
    const title = titleLine.replace(/^#\s*/, '').trim();
    
    // Extract tags from second line
    const tagsLine = lines[1];
    const tags = tagsLine.split(',').map(tag => tag.trim()).filter(tag => tag.length > 0);
    
    // Extract body (everything after the first two lines)
    const bodyLines = lines.slice(2).join('\n').trim();
    
    // Split body into paragraphs (split by double newlines)
    const body = bodyLines.split(/\n\s*\n/).map(paragraph => 
        paragraph.trim().replace(/\n/g, ' ')
    ).filter(paragraph => paragraph.length > 0);
    
    return {
        title: `<h1>${title}</h1>`,
        tags,
        body
    };
}

// Main function to generate articles.js
function generateArticles() {
    const articlesDir = path.join(__dirname, '..', 'articles');
    const outputFile = path.join(__dirname, '..', 'articles.js');
    
    // Get all .md files in the articles directory
    const files = fs.readdirSync(articlesDir)
        .filter(file => file.endsWith('.md'))
        .sort((a, b) => {
            // Sort by date (newest first) - convert to Date objects for proper comparison
            const dateA = new Date(parseDateFromFilename(a));
            const dateB = new Date(parseDateFromFilename(b));
            return dateB - dateA;
        });
    
    const articles = [];
    
    for (const file of files) {
        const filePath = path.join(articlesDir, file);
        const date = parseDateFromFilename(file);
        
        if (!date) {
            console.warn(`Warning: Could not parse date from filename: ${file}`);
            continue;
        }
        
        try {
            const articleData = parseMarkdownFile(filePath);
            articles.push({
                title: articleData.title,
                tags: articleData.tags,
                date: date,
                body: articleData.body
            });
        } catch (error) {
            console.error(`Error processing file ${file}:`, error.message);
        }
    }
    
    // Generate the JavaScript content
    const jsContent = `let articles = ${JSON.stringify(articles, null, 4)};`;
    
    // Write to articles.js
    fs.writeFileSync(outputFile, jsContent);
    
    console.log(`Generated articles.js with ${articles.length} articles`);
}

// Run the script
generateArticles(); 