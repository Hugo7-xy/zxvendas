// js/ui.js
// Importa a função de verificação do router
import { isFilterFabVisible } from './router.js';

// --- Funções Auxiliares de UI (Modais, Toast, Loading) ---
export function showLoading() { /* ... (código existente) ... */ const overlay = document.getElementById('loading-overlay'); if (overlay) overlay.classList.remove('hidden'); }
export function hideLoading() { /* ... (código existente) ... */ const overlay = document.getElementById('loading-overlay'); if (overlay) overlay.classList.add('hidden'); }
export function showToast(message, type = 'info') { /* ... (código existente) ... */ const container = document.getElementById('toast-container'); if (!container) return; const toast = document.createElement('div'); toast.className = `toast toast-${type}`; toast.textContent = message; container.appendChild(toast); setTimeout(() => { toast.remove(); }, 3500); }
export function showModal(modalId) { /* ... (código existente) ... */ const modal = document.getElementById(modalId); if (modal) modal.classList.remove('hidden'); }
export function hideModal(modalId) { /* ... (código existente) ... */ const modal = document.getElementById(modalId); if (modal) modal.classList.add('hidden'); }

// --- Lógica para os Painéis Laterais ---
let userPanel = null; let filterPanel = null; let panelOverlay = null;
let openUserBtn = null; let closeUserBtn = null; let openFilterBtn = null; let closeFilterBtn = null;
function initUserPanelListeners() { /* ... (código existente) ... */ userPanel = document.getElementById('user-side-panel'); panelOverlay = document.getElementById('panel-overlay'); openUserBtn = document.getElementById('open-menu-btn'); closeUserBtn = document.getElementById('close-menu-btn'); if (userPanel && panelOverlay && openUserBtn && closeUserBtn) { openUserBtn.addEventListener('click', openUserPanel); closeUserBtn.addEventListener('click', closeUserPanel); panelOverlay.addEventListener('click', closeAllPanels); } else { console.warn("Elementos do painel de usuário não encontrados."); } }
function openUserPanel() { /* ... (código existente) ... */ closeFilterPanel(); if (userPanel && panelOverlay) { userPanel.classList.add('is-open'); panelOverlay.classList.remove('hidden'); } }
function closeUserPanel() { /* ... (código existente) ... */ if (userPanel && panelOverlay) { userPanel.classList.remove('is-open'); if (!filterPanel || !filterPanel.classList.contains('is-open')) { panelOverlay.classList.add('hidden'); } } }
function initFilterPanelListeners() { /* ... (código existente) ... */ filterPanel = document.getElementById('filter-side-panel'); panelOverlay = document.getElementById('panel-overlay'); openFilterBtn = document.getElementById('open-filter-btn'); closeFilterBtn = document.getElementById('close-filter-btn'); if (filterPanel && panelOverlay && openFilterBtn && closeFilterBtn) { openFilterBtn.addEventListener('click', () => { if (filterPanel.classList.contains('is-open')) { closeFilterPanel(); } else { openFilterPanel(); } }); closeFilterBtn.addEventListener('click', closeFilterPanel); } else { console.warn("Elementos do painel de filtro não encontrados."); } }
function openFilterPanel() { /* ... (código existente) ... */ closeUserPanel(); if (filterPanel && panelOverlay) { filterPanel.classList.add('is-open'); panelOverlay.classList.remove('hidden'); if(openFilterBtn) openFilterBtn.style.display = 'none'; } }
export function closeFilterPanel() { /* ... (código existente) ... */ if (filterPanel && panelOverlay) { filterPanel.classList.remove('is-open'); if (!userPanel || !userPanel.classList.contains('is-open')) { panelOverlay.classList.add('hidden'); } if(openFilterBtn && typeof isFilterFabVisible === 'function' && isFilterFabVisible()) { openFilterBtn.style.display = 'flex'; } else if (openFilterBtn) { openFilterBtn.style.display = 'none'; } } }
function closeAllPanels() { /* ... (código existente) ... */ closeUserPanel(); closeFilterPanel(); }

// --- [NOVO] Lógica do Modal de Confirmação ---

let confirmModal = null;
let confirmTitle = null;
let confirmMessage = null;
let confirmYesBtn = null;
let confirmNoBtn = null;
let currentOnConfirmCallback = null; // Guarda a função a ser chamada no 'Sim'

// Pega referências aos elementos do modal uma vez
function initConfirmationModal() {
    confirmModal = document.getElementById('confirm-modal');
    confirmTitle = document.getElementById('confirm-title');
    confirmMessage = document.getElementById('confirm-message');
    confirmYesBtn = document.getElementById('confirm-yes-btn');
    confirmNoBtn = document.getElementById('confirm-no-btn');

    if (confirmModal && confirmYesBtn && confirmNoBtn) {
        confirmYesBtn.addEventListener('click', handleConfirmYes);
        confirmNoBtn.addEventListener('click', handleConfirmNo);
    } else {
        console.warn("Elementos do modal de confirmação não encontrados.");
    }
}

// Função para EXIBIR o modal de confirmação
export function showConfirmationModal(title, message, onConfirmCallback) {
    if (!confirmModal || !confirmTitle || !confirmMessage) {
        console.error("Modal de confirmação não inicializado corretamente.");
        return;
    }
    confirmTitle.textContent = title;
    confirmMessage.textContent = message;
    currentOnConfirmCallback = onConfirmCallback; // Guarda a ação
    showModal('confirm-modal'); // Reutiliza a função showModal
}

// Função chamada ao clicar em 'Sim'
function handleConfirmYes() {
    if (typeof currentOnConfirmCallback === 'function') {
        currentOnConfirmCallback(); // Executa a ação guardada
    }
    hideModal('confirm-modal'); // Esconde o modal
    currentOnConfirmCallback = null; // Limpa a ação
}

// Função chamada ao clicar em 'Não'/'Cancelar'
function handleConfirmNo() {
    hideModal('confirm-modal'); // Apenas esconde o modal
    currentOnConfirmCallback = null; // Limpa a ação
}

// --- Inicialização Geral da UI ---
export function initModalClosers() {
    // Fecha Modais normais (exceto o de confirmação, que tem botões próprios)
    document.querySelectorAll('.modal-overlay:not(#confirm-modal)').forEach(overlay => {
        const closeBtn = overlay.querySelector('[class*="close-btn"]');
        if (closeBtn) { closeBtn.addEventListener('click', () => { overlay.classList.add('hidden'); }); }
        overlay.addEventListener('click', (e) => { if (e.target === overlay) { overlay.classList.add('hidden'); } });
    });

    // Inicializa listeners para AMBOS os painéis laterais
    initUserPanelListeners();
    initFilterPanelListeners();
    // [NOVO] Inicializa listeners do modal de confirmação
    initConfirmationModal();
}
