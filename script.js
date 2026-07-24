let vocabulary = [];
let currentPage = 0;
const ITEMS_PER_PAGE = 20;

// Mode State: 'all' or 'random'
let currentMode = 'all'; 
let random50List = [];
let previousRandomKey = ''; // Prevents identical random sets
let searchQuery = '';
let allRevealed = false;

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
const shuffleBtn = document.getElementById('shuffle-btn');
const tabAll = document.getElementById('tab-all');
const tabRandom = document.getElementById('tab-random');
const controlsBar = document.getElementById('controls-bar');

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

// 2. Load Vocabulary (Safe Loader)
fetch('vocabulary.json')
    .then(response => {
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        return response.json();
    })
    .then(data => {
        if (Array.isArray(data)) {
            vocabulary = data;
        } else if (Array.isArray(data.words)) {
            vocabulary = data.words;
        } else {
            vocabulary = Object.values(data).find(val => Array.isArray(val)) || [];
        }
        populatePageDropdowns();
        renderGrid();
    })
    .catch(error => {
        console.error('Error loading vocabulary.json:', error);
        batchCounter.textContent = 'Мэдээлэл ачаалахад алдаа гарлаа. (Check Console)';
    });

// 3. Mode Switcher (All Words vs Random 50)
tabAll.addEventListener('click', () => {
    if (currentMode === 'all') return;
    currentMode = 'all';
    tabAll.classList.add('active');
    tabRandom.classList.remove('active');
    
    // UI visibility updates
    searchInput.style.display = 'block';
    headerPageSelect.style.display = 'block';
    controlsBar.style.display = 'flex';
    shuffleBtn.style.display = 'none';

    currentPage = 0;
    resetToggleState();
    populatePageDropdowns();
    renderGrid();
});

tabRandom.addEventListener('click', () => {
    currentMode = 'random';
    tabRandom.classList.add('active');
    tabAll.classList.remove('active');

    // UI visibility updates
    searchInput.style.display = 'none';
    headerPageSelect.style.display = 'none';
    controlsBar.style.display = 'none'; // Hide bottom pagination bar in Random 50 mode
    shuffleBtn.style.display = 'inline-block';

    generateRandom50();
    resetToggleState();
    renderGrid();
});

// Fisher-Yates algorithm for guaranteed unique shuffling
function generateRandom50() {
    if (vocabulary.length === 0) return;

    let shuffled;
    let newKey = '';

    // Loop until we get a set different from the previous one
    do {
        shuffled = [...vocabulary];
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        random50List = shuffled.slice(0, Math.min(50, shuffled.length));
        newKey = random50List.slice(0, 5).map(w => w.hanzi).join('');
    } while (vocabulary.length > 50 && newKey === previousRandomKey);

    previousRandomKey = newKey;
}

shuffleBtn.addEventListener('click', () => {
    if (navigator.vibrate) navigator.vibrate(15);
    generateRandom50();
    resetToggleState();
    renderGrid();
    window.scrollTo({ top: 0, behavior: 'smooth' });
});

// 4. Get Current Active Vocab List
function getFilteredVocab() {
    if (currentMode === 'random') {
        return random50List;
    }

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

// 5. Populate Dropdowns
function populatePageDropdowns() {
    if (currentMode === 'random') return;

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

// 6. Render Grid
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

    let currentBatch;
    let startIndex = 0;

    if (currentMode === 'random') {
        currentBatch = list; // Show all 50 in random mode directly
        batchCounter.textContent = `Random: ${currentBatch.length} үг`;
    } else {
        startIndex = currentPage * ITEMS_PER_PAGE;
        const endIndex = Math.min(startIndex + ITEMS_PER_PAGE, totalItems);
        currentBatch = list.slice(startIndex, endIndex);

        batchCounter.textContent = searchQuery 
            ? `Олдсон: ${totalItems} үг` 
            : `Нийт: ${startIndex + 1}–${endIndex} / ${totalItems}`;

        headerPageSelect.value = currentPage;
        footerPageSelect.value = currentPage;
        
        prevBtn.disabled = currentPage === 0;
        nextBtn.disabled = endIndex >= totalItems;
    }

    currentBatch.forEach((word, index) => {
        const card = document.createElement('div');
        card.className = allRevealed ? 'card revealed' : 'card';

        const wordNumber = currentMode === 'random' ? index + 1 : startIndex + index + 1;
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
}

// 7. Hide / Show All Translations Toggle
toggleTranslationsBtn.addEventListener('click', () => {
    const cards = document.querySelectorAll('.card');
    const hasRevealedCards = Array.from(cards).some(card => card.classList.contains('revealed'));

    if (hasRevealedCards || allRevealed) {
        cards.forEach(card => card.classList.remove('revealed'));
        allRevealed = false;
        toggleTranslationsBtn.textContent = '👁️ Ил гаргах';
    } else {
        cards.forEach(card => card.classList.add('revealed'));
        allRevealed = true;
        toggleTranslationsBtn.textContent = '🫣 Нуух';
    }
});

function resetToggleState() {
    allRevealed = false;
    toggleTranslationsBtn.textContent = '👁️ Ил гаргах';
}

// 8. Navigation Handlers
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
