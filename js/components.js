// Component loader for header, menu, and footer
async function loadComponent(elementId, componentPath) {
    try {
        const response = await fetch(componentPath);
        const content = await response.text();
        document.getElementById(elementId).innerHTML = content;
    } catch (error) {
        console.error(`Error loading component ${componentPath}:`, error);
    }
}

// Load commit hash from a generated file or use a fallback
async function loadCommitHash() {
    try {
        const response = await fetch('./commit-hash.txt');
        const hash = await response.text();
        const commitHashElement = document.getElementById('commit-hash');
        if (commitHashElement) {
            commitHashElement.textContent = hash.trim();
        }
    } catch (error) {
        console.log('Could not load commit hash, using fallback');
        const commitHashElement = document.getElementById('commit-hash');
        if (commitHashElement) {
            commitHashElement.textContent = 'dev';
        }
    }
}

// Load all components when the page loads
async function loadAllComponents() {
    await Promise.all([
        loadComponent('header-placeholder', './components/header.html'),
        loadComponent('menu-placeholder', './components/menu.html'),
        loadComponent('footer-placeholder', './components/footer.html')
    ]);
    
    // Load commit hash after footer is loaded
    await loadCommitHash();
}

// Update menu selection based on current page
function updateMenuSelection() {
    const currentPage = window.location.pathname.split('/').pop() || 'index.html';
    
    // Remove selected class from all menu items
    document.querySelectorAll('.menubar span, .menubar a').forEach(item => {
        item.classList.remove('selected');
        item.classList.add('unselected');
    });
    
    // Add selected class based on current page
    if (currentPage === 'index.html' || currentPage === '') {
        document.querySelector('[identifier="blog"]').classList.remove('unselected').addClass('selected');
    } else if (currentPage === 'me.html') {
        document.querySelector('[identifier="me"]').classList.remove('unselected').addClass('selected');
    } else if (currentPage === 'game.html') {
        document.querySelector('[identifier="techjourney"]').classList.remove('unselected').addClass('selected');
    }
}

// Initialize components
document.addEventListener('DOMContentLoaded', async function() {
    await loadAllComponents();
    updateMenuSelection();
}); 