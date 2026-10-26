// Component loader for the shared site header and footer.
// Also used by /x-km-per-day/ (the Running section), so paths are absolute.
async function fetchComponent(componentPath) {
    try {
        const response = await fetch(componentPath);
        return response.ok ? await response.text() : '';
    } catch (error) {
        console.error(`Error loading component ${componentPath}:`, error);
        return '';
    }
}

async function loadComponent(elementId, componentPaths) {
    const element = document.getElementById(elementId);
    if (!element) return;
    const parts = await Promise.all(componentPaths.map(fetchComponent));
    element.innerHTML = parts.join('');
}

// Load commit hash from a generated file or use a fallback
async function loadCommitHash() {
    const commitHashElement = document.getElementById('commit-hash');
    if (!commitHashElement) return;
    try {
        const response = await fetch('/commit-hash.txt');
        const hash = await response.text();
        commitHashElement.textContent = hash.trim();
    } catch (error) {
        console.log('Could not load commit hash, using fallback');
        commitHashElement.textContent = 'dev';
    }
}

// Load all components when the page loads
async function loadAllComponents() {
    await Promise.all([
        loadComponent('site-header', ['/components/header.html', '/components/menu.html']),
        loadComponent('footer-placeholder', ['/components/footer.html'])
    ]);

    // Load commit hash after footer is loaded
    await loadCommitHash();
}

// Work out which section the current page belongs to
function currentSection() {
    const path = window.location.pathname;
    if (path.startsWith('/x-km-per-day')) return 'running';
    const page = path.split('/').pop() || 'index.html';
    if (page === 'me.html') return 'me';
    if (page === 'game.html') return 'techjourney';
    return 'blog';
}

// Highlight the current section in the menu
function updateMenuSelection() {
    const section = currentSection();
    document.querySelectorAll('.site-nav a').forEach(item => {
        if (item.dataset.section === section) {
            item.setAttribute('aria-current', 'page');
        } else {
            item.removeAttribute('aria-current');
        }
    });
}

// Initialize components
document.addEventListener('DOMContentLoaded', async function() {
    await loadAllComponents();
    updateMenuSelection();
});
