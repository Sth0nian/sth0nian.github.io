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
    
    // Wait a bit for DOM to be ready
    setTimeout(() => {
        // Remove selected class from all menu items
        document.querySelectorAll('.menubar span, .menubar a').forEach(item => {
            item.classList.remove('selected');
            item.classList.add('unselected');
        });
        
        // Add selected class based on current page
        if (currentPage === 'index.html' || currentPage === '') {
            const blogElement = document.querySelector('[identifier="blog"]');
            if (blogElement) {
                blogElement.classList.remove('unselected').addClass('selected');
            }
        } else if (currentPage === 'me.html') {
            const meElement = document.querySelector('[identifier="me"]');
            if (meElement) {
                meElement.classList.remove('unselected').addClass('selected');
            }
        } else if (currentPage === 'game.html') {
            const techElement = document.querySelector('[identifier="techjourney"]');
            if (techElement) {
                techElement.classList.remove('unselected').addClass('selected');
            }
        }
    }, 100);
}

// Initialize components
document.addEventListener('DOMContentLoaded', async function() {
    await loadAllComponents();
    updateMenuSelection();
}); 