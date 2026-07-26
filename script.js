let vocabulary = [];
let currentPage = 0;
const ITEMS_PER_PAGE = 20;

// Mode State: 'all', 'random', or 'saved'
let currentMode = 'all'; 
let random50List = [];
let previousRandomKey = '';
let searchQuery = '';
let allRevealed = false;

// Undo Toast State
let removedStack = [];
let undoTimeout = null;

// 1. Load Saved Words from Browser LocalStorage
let savedWords = [];
try {
    savedWords = JSON.parse(localStorage.getItem('hsk5_saved_words')) || [];
} catch (e) {
    savedWords = [];
}

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
const tabSaved = document.getElementById('tab-saved');
const controlsBar = document.getElementById('controls-bar');
const undoToast = document.getElementById('undo-toast');
const undoBtn = document.getElementById('undo-btn');

// Theme Switch Logic
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

// 2. Load Vocabulary JSON
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
        batchCounter.textContent = 'Мэдээлэл ачаалахад алдаа гарлаа.';
    });

// 3. Tab Switching Handlers
tabAll.addEventListener('click', () => switchTab('all'));
tabRandom.addEventListener('click', () => switchTab('random'));
tabSaved.addEventListener('click', () => switchTab('saved'));

function switchTab(mode) {
    currentMode = mode;
    [tabAll, tabRandom, tabSaved].forEach(tab => tab.classList.remove('active'));

    if (mode === 'all') {
        tabAll.classList.add('active');
        searchInput.style.display = 'block';
        headerPageSelect.style.display = 'block';
        controlsBar.style.display = 'flex';
        shuffleBtn.style.display = 'none';
    } else if (mode === 'random') {
        tabRandom.classList.add('active');
        searchInput.style.display = 'none';
        headerPageSelect.style.display = 'none';
        controlsBar.style.display = 'none';
        shuffleBtn.style.display = 'inline-block';
        generateRandom50();
    } else if (mode === 'saved') {
        tabSaved.classList.add('active');
        searchInput.style.display = 'block';
        headerPageSelect.style.display = 'block';
        controlsBar.style.display = 'flex';
        shuffleBtn.style.display = 'none';
    }

    currentPage = 0;
    resetToggleState();
    populatePageDropdowns();
    renderGrid();
}

// Fisher-Yates Random 50 Generator
function generateRandom50() {
    if (vocabulary.length === 0) return;
    let shuffled;
    let newKey = '';
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

// 4. Save/Unsave Toggle Function with Undo Toast Trigger
function toggleSaveWord(hanzi) {
    if (!hanzi) return;

    if (savedWords.includes(hanzi)) {
        // Unstar word & add to undo stack
        savedWords = savedWords.filter(w => w !== hanzi);
        removedStack.push(hanzi);
        showUndoToast();
    } else {
        // Re-star word & remove from undo stack if present
        savedWords.push(hanzi);
        removedStack = removedStack.filter(w => w !== hanzi);
        if (removedStack.length === 0) hideUndoToast();
    }

    localStorage.setItem('hsk5_saved_words', JSON.stringify(savedWords));

    if (currentMode === 'saved') {
        const list = getFilteredVocab();
        const totalPages = Math.ceil(list.length / ITEMS_PER_PAGE) || 1;
        if (currentPage >= totalPages) {
            currentPage = Math.max(0, totalPages - 1);
        }
    }

    populatePageDropdowns();
    renderGrid();
}

// 5. Get Filtered Vocab List
function getFilteredVocab() {
    let list = vocabulary;

    if (currentMode === 'random') {
        return random50List;
    }

    if (currentMode === 'saved') {
        list = vocabulary.filter(w => savedWords.includes(w.hanzi));
    }

    if (!searchQuery) return list;

    return list.filter(word => {
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

// 6. Populate Dropdowns with Alphabetical Letter Ranges
function populatePageDropdowns() {
    if (currentMode === 'random') return;

    const list = getFilteredVocab();
    const totalPages = Math.ceil(list.length / ITEMS_PER_PAGE) || 1;
    headerPageSelect.innerHTML = '';
    footerPageSelect.innerHTML = '';

    function getFirstLetter(word) {
        const pinyinStr = word.pinyin || word.english || word.hanzi || '';
        const cleanStr = pinyinStr.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        const match = cleanStr.match(/[a-zA-Z]/);
        return match ? match[0].toUpperCase() : '';
    }

    for (let i = 0; i < totalPages; i++) {
        const startIndex = i * ITEMS_PER_PAGE;
        const endIndex = Math.min((i + 1) * ITEMS_PER_PAGE, list.length);
        const batch = list.slice(startIndex, endIndex);

        const startNum = startIndex + 1;
        const endNum = endIndex;

        let letterRange = '';
        if (batch.length > 0) {
            const startLetter = getFirstLetter(batch[0]);
            const endLetter = getFirstLetter(batch[batch.length - 1]);

            if (startLetter && endLetter) {
                if (startLetter === endLetter) {
                    letterRange = ` (${startLetter})`;
                } else {
                    letterRange = ` (${startLetter}–${endLetter})`;
                }
            }
        }

        const optionText = `${startNum}–${endNum}${letterRange}`;
        
        headerPageSelect.add(new Option(optionText, i));
        footerPageSelect.add(new Option(optionText, i));
    }
}

// 7. Render Grid
function renderGrid() {
    vocabGrid.innerHTML = '';

    const list = getFilteredVocab();
    const totalItems = list.length;

    if (totalItems === 0) {
        const emptyMsg = currentMode === 'saved' 
            ? 'Хадгалсан үг байхгүй байна. (Үг дээрх од дээр ⭐️ дарж хадгалаарай)'
            : 'Тохирох үг олдсонгүй.';
        vocabGrid.innerHTML = `<div class="no-results">${emptyMsg}</div>`;
        batchCounter.textContent = '0 үг';
        prevBtn.disabled = true;
        nextBtn.disabled = true;
        return;
    }

    let currentBatch;
    let startIndex = 0;

    if (currentMode === 'random') {
        currentBatch = list;
        batchCounter.textContent = `Санамсаргүй: ${currentBatch.length} үг`;
    } else {
        startIndex = currentPage * ITEMS_PER_PAGE;
        const endIndex = Math.min(startIndex + ITEMS_PER_PAGE, totalItems);
        currentBatch = list.slice(startIndex, endIndex);

        const titlePrefix = currentMode === 'saved' ? 'Хадгалсан' : 'Нийт';
        batchCounter.textContent = searchQuery 
            ? `Олдсон: ${totalItems} үг` 
            : `${titlePrefix}: ${startIndex + 1}–${endIndex} / ${totalItems}`;

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
        const isSaved = savedWords.includes(word.hanzi);

        card.innerHTML = `
            <div class="card-top">
                <span class="word-number">#${wordNumber}</span>
                <button class="save-star-btn ${isSaved ? 'saved' : ''}" title="Хадгалах">
                    ${isSaved ? '★' : '☆'}
                </button>
                ${pos ? `<span class="pos-tag">${pos}</span>` : '<span></span>'}
            </div>
            <div class="hanzi">${word.hanzi}</div>
            <div class="card-details">
                <p class="pinyin">${word.pinyin || ''}</p>
                <p class="english">${word.english || ''}</p>
                <p class="mongolian">${word.mongolian || ''}</p>
            </div>
        `;

        const starBtn = card.querySelector('.save-star-btn');
        starBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (navigator.vibrate) navigator.vibrate(10);
            toggleSaveWord(word.hanzi);
        });

        card.addEventListener('click', () => {
            if (navigator.vibrate) navigator.vibrate(10);
            card.classList.toggle('revealed');
        });

        vocabGrid.appendChild(card);
    });
}

// 8. Hide / Show Translations Toggle
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

// 9. Navigation Handlers
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

// ==========================================
// 10. TOAST FUNCTIONS & BULK UNDO HANDLER
// ==========================================
function showUndoToast() {
    if (!undoToast) return;
    if (undoTimeout) clearTimeout(undoTimeout);

    const toastText = undoToast.querySelector('span');
    if (toastText) {
        toastText.textContent = removedStack.length > 1 
            ? `${removedStack.length} үг хасагдлаа` 
            : 'Үг хасагдлаа';
    }

    // Dynamic button label: changes to "Undo All" if 3 or more words are queued
    if (undoBtn) {
        undoBtn.textContent = removedStack.length >= 3 
            ? 'Бүгдийг буцаах ↩️' 
            : 'Буцаах ↩️';
    }

    undoToast.classList.remove('hidden');

    // Auto-hide after 5 seconds of inactivity
    undoTimeout = setTimeout(() => {
        hideUndoToast();
    }, 5000);
}

function hideUndoToast() {
    if (!undoToast) return;
    undoToast.classList.add('hidden');
    removedStack = []; // Clear history stack when toast hides
}

// Undo Button Handler
if (undoBtn) {
    undoBtn.addEventListener('click', () => {
        if (removedStack.length === 0) return;

        if (removedStack.length >= 3) {
            // 🚀 If 3 or more words removed, restore ALL at once in one tap
            removedStack.forEach(hanzi => {
                if (!savedWords.includes(hanzi)) {
                    savedWords.push(hanzi);
                }
            });
            removedStack = []; // Clear queue completely
        } else {
            // If fewer than 3 words removed, restore one by one
            const lastHanzi = removedStack.pop();
            if (!savedWords.includes(lastHanzi)) {
                savedWords.push(lastHanzi);
            }
        }

        // Save updated array to LocalStorage
        localStorage.setItem('hsk5_saved_words', JSON.stringify(savedWords));
        
        if (navigator.vibrate) navigator.vibrate(15);
        
        // Hide toast if queue is empty, otherwise refresh count
        if (removedStack.length > 0) {
            showUndoToast();
        } else {
            hideUndoToast();
        }

        populatePageDropdowns();
        renderGrid();
    });
}
