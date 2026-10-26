// Component loader for header, menu, and footer
async function loadComponent(elementId, componentPath) {
    const element = document.getElementById(elementId);
    if (!element) return;
    try {
        const response = await fetch(componentPath);
        element.innerHTML = await response.text();
    } catch (error) {
        console.error(`Error loading component ${componentPath}:`, error);
    }
}

// Load commit hash from a generated file or use a fallback
async function loadCommitHash() {
    const commitHashElement = document.getElementById('commit-hash');
    if (!commitHashElement) return;
    try {
        const response = await fetch('./commit-hash.txt');
        if (!response.ok) throw new Error(response.statusText);
        commitHashElement.textContent = (await response.text()).trim();
    } catch (error) {
        console.log('Could not load commit hash, using fallback');
        commitHashElement.textContent = 'dev';
    }
}

// Load all components when the page loads
async function loadAllComponents() {
    await Promise.all([
        loadComponent('header-placeholder', './components/header.html'),
        loadComponent('menu-placeholder', './components/menu.html'),
        loadComponent('footer-placeholder', './components/footer.html')
    ]);

    const year = document.getElementById('footer-year');
    if (year) year.textContent = new Date().getFullYear();

    // Load commit hash after footer is loaded
    await loadCommitHash();
}

// Highlight the menu item for the current page
function updateMenuSelection() {
    const pages = {
        'index.html': 'blog',
        'me.html': 'me',
        'game.html': 'techjourney'
    };
    const currentPage = window.location.pathname.split('/').pop() || 'index.html';
    const identifier = pages[currentPage];

    document.querySelectorAll('.menubar a').forEach(item => {
        const isCurrent = item.getAttribute('identifier') === identifier;
        item.classList.toggle('selected', isCurrent);
        if (isCurrent) {
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
