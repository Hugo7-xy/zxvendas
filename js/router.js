// js/router.js
import * as produtos from './systemaprodutos.js';
import { setActiveLink } from './systemamenu.js';
import { closeFilterPanel } from './ui.js';
// NOVO: Importa funções do settings para carregar dados na página
import { loadProfileData, setupSecurityPage } from './systemasettings.js';

const routes = {
    '/': 'products-page',
    '/vendedores': 'sellers-page',
    '/canais': 'channels-page',
    '/referencias': 'references-page',
    // --- NOVAS ROTAS ---
    '/settings/profile': 'settings-profile-page', // <-- Página de perfil
    '/settings/security': 'settings-security-page' // <-- Página de segurança
    // --- FIM NOVAS ROTAS ---
};

export let currentSellerFilterId = null;
let currentSellerFilterName = null;
let filterFab = null;
let currentPageId = null;
let backToSellersBtn = null;
let sellerProductsHeader = null;
let sellerProductsTitle = null;

export function isFilterFabVisible() { /* ... (código existente sem mudanças) ... */ const isMobile = window.innerWidth <= 768; return (currentPageId === 'products-page' && isMobile); }
function updateFilterFabVisibility() { /* ... (código existente sem mudanças) ... */ if (!filterFab) return; if (isFilterFabVisible()) { const filterPanel = document.getElementById('filter-side-panel'); if (!filterPanel || !filterPanel.classList.contains('is-open')) { filterFab.style.display = 'flex'; } else { filterFab.style.display = 'none'; } } else { filterFab.style.display = 'none'; } }

export function handleRouteChange() {
    closeFilterPanel();
    const path = window.location.pathname;
    const allPages = document.querySelectorAll('.page-content');
    allPages.forEach(page => page.classList.add('hidden'));

    currentPageId = null;
    currentSellerFilterId = null;
    currentSellerFilterName = null;

    if (!sellerProductsHeader) { /* ... (código existente sem mudanças para pegar refs header/btn/title) ... */ sellerProductsHeader = document.getElementById('seller-products-header'); backToSellersBtn = document.getElementById('back-to-sellers-btn'); sellerProductsTitle = document.getElementById('seller-products-title'); if (backToSellersBtn) { backToSellersBtn.addEventListener('click', (e) => { e.preventDefault(); navigate('/vendedores'); }); } }

    if (path.startsWith('/vendedores/')) {
        // --- Lógica de perfil de vendedor (sem mudanças) ---
        const sellerIdFromState = history.state?.sellerId; const sellerNameFromUrl = decodeURIComponent(path.split('/vendedores/')[1]);
        if (sellerIdFromState) {
            currentPageId = routes['/']; currentSellerFilterId = sellerIdFromState; currentSellerFilterName = history.state?.sellerName || sellerNameFromUrl;
            if (sellerProductsHeader) sellerProductsHeader.classList.remove('hidden'); if (sellerProductsTitle) sellerProductsTitle.textContent = `Contas de ${currentSellerFilterName}`;
            document.dispatchEvent(new CustomEvent('sellerSelected', { detail: { sellerId: currentSellerFilterId } }));
            produtos.fetchAndRenderProducts({ type: 'seller', value: currentSellerFilterId });
        } else {
             currentPageId = routes['/vendedores']; if (sellerProductsHeader) sellerProductsHeader.classList.add('hidden'); console.warn(`Seller ID not found for ${sellerNameFromUrl}.`);
        }
        // --- Fim lógica vendedor ---

    } else if (routes[path]) {
        // É uma das rotas principais OU uma das novas rotas de settings
        currentPageId = routes[path];
        if (sellerProductsHeader) sellerProductsHeader.classList.add('hidden'); // Esconde header vendedor

        // --- AÇÕES ESPECÍFICAS POR PÁGINA ---
        if (path === '/') {
            produtos.fetchAndRenderProducts({ type: 'price', value: 'all' });
        }
        // NOVO: Se for a página de perfil, carrega os dados do formulário
        else if (path === '/settings/profile') {
            loadProfileData(); // Chama a função do systemasettings.js
        }
        // NOVO: Se for a página de segurança, configura o botão reset
        else if (path === '/settings/security') {
            setupSecurityPage(); // Chama a função do systemasettings.js
        }
        // Adicionar carregamento de dados para /canais, /referencias, /vendedores se necessário aqui também
        // --- FIM AÇÕES ---

    } else {
        // Rota não encontrada
        currentPageId = routes['/'];
        if (sellerProductsHeader) sellerProductsHeader.classList.add('hidden');
        produtos.fetchAndRenderProducts({ type: 'price', value: 'all' });
        console.warn(`Route not found: ${path}. Showing products page.`);
        // history.replaceState({}, '', '/'); // Descomentar para redirecionar
    }

    const targetPage = document.getElementById(currentPageId);
    if (targetPage) {
        targetPage.classList.remove('hidden');
    } else {
        const productsPage = document.getElementById(routes['/']);
        if (productsPage) productsPage.classList.remove('hidden');
        console.error(`Page element with ID "${currentPageId}" not found.`);
    }

    // --- ATUALIZAÇÃO DO LINK ATIVO ---
    let activeLinkPath = path;
    if (path.startsWith('/vendedores/')) {
        activeLinkPath = '/vendedores';
    } else if (path.startsWith('/settings/')) {
        // Nenhuma aba da nav principal fica ativa para settings
        activeLinkPath = null; // <- Nulo para não ativar nenhuma
    }
    setActiveLink(activeLinkPath); // Passa null se for settings
    // --- FIM ATUALIZAÇÃO LINK ---

    window.scrollTo(0, 0);
    updateFilterFabVisibility();
}

export function navigate(path, state = {}) { /* ... (código existente sem mudanças) ... */ if (window.location.pathname !== path || JSON.stringify(history.state) !== JSON.stringify(state)) { history.pushState(state, '', path); } handleRouteChange(); }
window.addEventListener('popstate', handleRouteChange);
document.addEventListener('DOMContentLoaded', () => { filterFab = document.getElementById('open-filter-btn'); handleRouteChange(); window.addEventListener('resize', updateFilterFabVisibility); });
