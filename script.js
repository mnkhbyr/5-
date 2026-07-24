let vocabulary = [];
let currentPage = 0;
const ITEMS_PER_PAGE = 20;

// DOM Elements
const vocabGrid = document.getElementById('vocab-grid');
const prevBtn = document.getElementById('prev-btn');
const nextBtn = document.getElementById('next-btn');
const batchCounter = document.getElementById('batch-counter');
const headerPageSelect = document.getElementById('header-page-select');
const footerPageSelect = document.getElementById('footer-page-select');
const themeToggleBtn = document.getElementById('theme-toggle');
const themeIcon = document.getElementById('theme-icon');
const searchInput = document.getElementById('search-input');
const toggleTranslationsBtn = document.getElementById('toggle-translations-btn');

let searchQuery = '';
let allRevealed = false; // Tracks global reveal/hide state for current page

// Filter vocabulary array based on search query
function getFilteredVocab() {
    if (!searchQuery) return vocabulary;
    return vocabulary.filter(word => {
        const pos = word.type || word.pos || word.category || word.partOfSpeech || '';
        return (
            (word.hanzi && word.hanzi.toLowerCase().includes(searchQuery)) ||
            (word.pinyin && word.pinyin.toLowerCase().includes(searchQuery)) ||
            (word.english && word.english.toLowerCase().includes(searchQuery)) ||
            (word.mongolian && word.mongolian.toLowerCase().includes(searchQuery)) ||
            (pos && pos.toLowerCase().includes(searchQuery))
        );
    });
}

// 1. Theme Switch Logic
const savedTheme = localStorage.getItem('hsk5_theme') || 'light';
document.documentElement.setAttribute('data-theme', savedTheme);
updateThemeIcon(savedTheme);

themeToggleBtn.addEventListener('click', () => {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('hsk5_theme', newTheme);
    updateThemeIcon(newTheme);
});

function updateThemeIcon(theme) {
    themeIcon.textContent = theme === 'dark' ? '🌙' : '☀️';
}

// 2. Load Vocabulary
fetch('vocabulary.json')
    .then(response => response.json())
    .then(data => {
        vocabulary = data;
        populatePageDropdowns();
        renderGrid();
    })
    .catch(error => {
        console.error('Error loading vocabulary.json:', error);
        batchCounter.textContent = 'Мэдээлэл ачаалахад алдаа гарлаа.';
    });

// 3. Populate Page Dropdowns
function populatePageDropdowns() {
    const list = getFilteredVocab();
    const totalPages = Math.ceil(list.length / ITEMS_PER_PAGE) || 1;
    headerPageSelect.innerHTML = '';
    footerPageSelect.innerHTML = '';

    for (let i = 0; i < totalPages; i++) {
        const start = i * ITEMS_PER_PAGE + 1;
        const end = Math.min((i + 1) * ITEMS_PER_PAGE, list.length);
        const optionText = `${start}–${end}`;
        
        headerPageSelect.add(new Option(optionText, i));
        footerPageSelect.add(new Option(optionText, i));
    }
}

// 4. Render Grid
function renderGrid() {
    vocabGrid.innerHTML = '';

    const list = getFilteredVocab();
    const totalItems = list.length;

    if (totalItems === 0) {
        vocabGrid.innerHTML = '<div class="no-results">Тохирох үг олдсонгүй.</div>';
        batchCounter.textContent = '0 үг олдлоо';
        prevBtn.disabled = true;
        nextBtn.disabled = true;
        return;
    }

    const startIndex = currentPage * ITEMS_PER_PAGE;
    const endIndex = Math.min(startIndex + ITEMS_PER_PAGE, totalItems);
    const currentBatch = list.slice(startIndex, endIndex);

    batchCounter.textContent = searchQuery 
        ? `Олдсон: ${totalItems} үг` 
        : `Нийт: ${startIndex + 1}–${endIndex} / ${totalItems}`;

    headerPageSelect.value = currentPage;
    footerPageSelect.value = currentPage;

    currentBatch.forEach((word, index) => {
        const card = document.createElement('div');
        card.className = allRevealed ? 'card revealed' : 'card';

        const wordNumber = startIndex + index + 1;
        const pos = word.type || word.pos || word.category || word.partOfSpeech || '';

        card.innerHTML = `
            <div class="card-top">
                <span class="word-number">#${wordNumber}</span>
                ${pos ? `<span class="pos-tag">${pos}</span>` : '<span></span>'}
            </div>
            <div class="hanzi">${word.hanzi}</div>
            <div class="card-details">
                <p class="pinyin">${word.pinyin || ''}</p>
                <p class="english">${word.english || ''}</p>
                <p class="mongolian">${word.mongolian || ''}</p>
            </div>
        `;

        card.addEventListener('click', () => {
            if (navigator.vibrate) navigator.vibrate(10);
            card.classList.toggle('revealed');
        });

        vocabGrid.appendChild(card);
    });

    prevBtn.disabled = currentPage === 0;
    nextBtn.disabled = endIndex >= totalItems;
}

// 5. Hide / Show All Cards Toggle
toggleTranslationsBtn.addEventListener('click', () => {
    const cards = document.querySelectorAll('.card');
    
    // Check if any cards are currently revealed
    const hasRevealedCards = Array.from(cards).some(card => card.classList.contains('revealed'));

    if (hasRevealedCards || allRevealed) {
        // Hide all cards
        cards.forEach(card => card.classList.remove('revealed'));
        allRevealed = false;
        toggleTranslationsBtn.textContent = '👁️ Ил гаргах';
    } else {
        // Reveal all cards
        cards.forEach(card => card.classList.add('revealed'));
        allRevealed = true;
        toggleTranslationsBtn.textContent = '🫣 Нуух';
    }
});

// Reset reveal state on page change
function resetToggleState() {
    allRevealed = false;
    toggleTranslationsBtn.textContent = '👁️ Ил гаргах';
}

// 6. Navigation Handlers
function changePage(newPage) {
    currentPage = parseInt(newPage, 10);
    resetToggleState();
    renderGrid();
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

headerPageSelect.addEventListener('change', (e) => changePage(e.target.value));
footerPageSelect.addEventListener('change', (e) => changePage(e.target.value));

prevBtn.addEventListener('click', () => {
    if (currentPage > 0) changePage(currentPage - 1);
});

nextBtn.addEventListener('click', () => {
    const list = getFilteredVocab();
    const totalPages = Math.ceil(list.length / ITEMS_PER_PAGE);
    if (currentPage < totalPages - 1) changePage(currentPage + 1);
});

searchInput.addEventListener('input', (e) => {
    searchQuery = e.target.value.trim().toLowerCase();
    currentPage = 0;
    resetToggleState();
    populatePageDropdowns();
    renderGrid();
});
