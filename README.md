# Personal Blog

This is a personal blog that automatically generates articles from markdown files.

## How it works

1. **Article Structure**: Each article is a markdown file in the `articles/` folder with the naming format `YYYY-MM-DD-HH-MM.md`

2. **Article Format**: Each markdown file should follow this structure:
   - **Line 1**: Title (starts with `#`)
   - **Line 2**: Comma-separated tags
   - **Line 3+**: Article body (paragraphs separated by blank lines)

3. **Automatic Generation**: When you push changes to the `articles/` folder, a GitHub Action automatically:
   - Parses all markdown files
   - Extracts title, tags, date (from filename), and body
   - Generates the `articles.js` file
   - Commits the changes back to the repository

## Example Article Format

```markdown
# Article Title
tag1, tag2, tag3

First paragraph of the article.

Second paragraph of the article.

Third paragraph with more content.
```

## File Structure

- `articles/` - Contains markdown files for each article
- `articles.js` - Automatically generated JavaScript file with article data
- `.github/workflows/generate-articles.yml` - GitHub Action workflow
- `scripts/generate-articles.js` - Node.js script that processes markdown files

## Adding a New Article

1. Create a new markdown file in the `articles/` folder with the format `YYYY-MM-DD-HH-MM.md`
2. Write your article following the format above
3. Commit and push to GitHub
4. The GitHub Action will automatically generate the updated `articles.js` file

## Local Development

To test the article generation locally:

```bash
node scripts/generate-articles.js
```

This will regenerate the `articles.js` file from your markdown files. 