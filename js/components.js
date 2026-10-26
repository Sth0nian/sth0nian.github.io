// Component loader for header, menu, and footer.
// Also used by /x-km-per-day/ (the Running section), so paths are absolute.
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
        const response = await fetch('/commit-hash.txt');
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
        loadComponent('header-placeholder', '/components/header.html'),
        loadComponent('menu-placeholder', '/components/menu.html'),
        loadComponent('footer-placeholder', '/components/footer.html')
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
    const path = window.location.pathname;
    const currentPage = path.split('/').pop() || 'index.html';
    const identifier = path.startsWith('/x-km-per-day') ? 'running' : pages[currentPage];

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

// Date of birth: March 1986. The exact day isn't published, so the 1st is used.
const BIRTH = { year: 1986, month: 2, day: 1 };

function birthdayIn(year) {
    return new Date(year, BIRTH.month, BIRTH.day);
}

function currentAge(now = new Date()) {
    const age = now.getFullYear() - BIRTH.year;
    return now < birthdayIn(now.getFullYear()) ? age - 1 : age;
}

// Any element marked data-age shows the current age
function fillAges() {
    document.querySelectorAll('[data-age]').forEach(el => {
        el.textContent = currentAge();
    });
}

// Initialize components
document.addEventListener('DOMContentLoaded', async function() {
    fillAges();
    await loadAllComponents();
    updateMenuSelection();
});
