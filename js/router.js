// js/router.js
import * as produtos from './systemaprodutos.js';
import { setActiveLink } from './systemamenu.js';
import { closeFilterPanel } from './ui.js';
// Importa funções do settings para carregar dados na página
import { loadProfileData, setupSecurityPage } from './systemasettings.js';
// Importa funções de carregamento das outras páginas
import { loadChannelData } from './systemacanais.js'; // Importa função de carregar canais
import { loadReferences } from './systemareferencias.js'; // Importa função de carregar referências
// --- MODIFICAÇÃO: Importa a função renomeada 'getSellerInfoBySlug' ---
import { renderSellersGallery, resetRenderFlag as resetSellersRenderFlag, getSellerInfoBySlug } from './systemavendedores.js';
// --- FIM MODIFICAÇÃO ---

const routes = {
    '/': 'products-page',
    '/vendedores': 'sellers-page',
    '/canais': 'channels-page',
    '/referencias': 'references-page',
    '/settings/profile': 'settings-profile-page',
    '/settings/security': 'settings-security-page'
};

export let currentSellerFilterId = null;
let currentSellerFilterName = null;
let filterFab = null;
let currentPageId = null;
let backToSellersBtn = null;
let sellerProductsHeader = null;
let sellerProductsTitle = null;

// Verifica se o FAB de filtro deve estar visível
export function isFilterFabVisible() {
    const isMobile = window.innerWidth <= 768;
    return (currentPageId === 'products-page' && isMobile && !currentSellerFilterId);
}


// Atualiza a visibilidade do FAB de filtro
function updateFilterFabVisibility() {
    // ... (código existente sem alterações) ...
    if (!filterFab) return;
    if (isFilterFabVisible()) {
        const filterPanel = document.getElementById('filter-side-panel');
        if (!filterPanel || !filterPanel.classList.contains('is-open')) {
            filterFab.style.display = 'flex';
        } else {
            filterFab.style.display = 'none';
        }
    } else {
        filterFab.style.display = 'none';
    }
}

// A função principal agora é 'async'
export async function handleRouteChange() {
    closeFilterPanel();
    const path = window.location.pathname;
    const allPages = document.querySelectorAll('.page-content');

    allPages.forEach(page => page.classList.add('hidden'));
    resetSellersRenderFlag();
    currentPageId = null;
    currentSellerFilterId = null;
    currentSellerFilterName = null;

    if (!sellerProductsHeader) {
        sellerProductsHeader = document.getElementById('seller-products-header');
        backToSellersBtn = document.getElementById('back-to-sellers-btn');
        sellerProductsTitle = document.getElementById('seller-products-title');
        if (backToSellersBtn) {
            backToSellersBtn.addEventListener('click', (e) => {
                e.preventDefault();
                navigate('/vendedores');
            });
        }
    }

    if (path.startsWith('/vendedores/')) {
        // --- MODIFICAÇÃO: Lógica baseada em slug ---
        const sellerIdFromState = history.state?.sellerId;
        const sellerSlugFromState = history.state?.sellerSlug; // Pega o slug do state
        const slugFromUrl = decodeURIComponent(path.split('/vendedores/')[1]); // Pega slug da URL

        let sellerInfo = null;
        let slugToSearch = null;

        // Prioriza informações do state (navegação interna)
        if (sellerIdFromState && sellerSlugFromState) {
            sellerInfo = {
                sellerId: sellerIdFromState,
                sellerName: history.state?.sellerName || 'Vendedor'
            };
            slugToSearch = sellerSlugFromState; // Guarda o slug para consistência
        } else {
            // Se não veio do state, usa o slug da URL para buscar
            slugToSearch = slugFromUrl;
            try {
                // Chama a função buscando pelo SLUG
                sellerInfo = await getSellerInfoBySlug(slugToSearch);
            } catch (e) {
                console.error("Router: Erro ao buscar Vendedor pelo slug:", e);
                sellerInfo = null;
            }
        }

        // Verifica se temos as informações do vendedor
        if (sellerInfo && sellerInfo.sellerId) {
            currentPageId = routes['/']; // Mostra a página de produtos
            currentSellerFilterId = sellerInfo.sellerId;
            currentSellerFilterName = sellerInfo.sellerName; // Nome para exibição

            if (sellerProductsHeader) sellerProductsHeader.classList.remove('hidden');
            if (sellerProductsTitle) sellerProductsTitle.textContent = `Contas de ${currentSellerFilterName}`;

            document.dispatchEvent(new CustomEvent('sellerSelected', { detail: { sellerId: currentSellerFilterId }}));
            produtos.fetchAndRenderProducts({ type: 'seller', value: currentSellerFilterId });

            // Opcional: Se a URL não bate com o slug correto (caso tenha vindo do state com slug antigo), corrige a URL
            if (slugToSearch && slugFromUrl !== slugToSearch) {
                history.replaceState(history.state, '', `/vendedores/${slugToSearch}`);
            }

        } else {
             // Fallback se não encontrou o vendedor
             console.warn(`Vendedor não encontrado para o slug ${slugToSearch || slugFromUrl}. Mostrando lista de vendedores.`);
             currentPageId = routes['/vendedores']; // Fallback para a lista de vendedores
             if (sellerProductsHeader) sellerProductsHeader.classList.add('hidden');
             renderSellersGallery(); // Tenta renderizar a lista de vendedores
             // Opcional: Redireciona a URL para /vendedores para evitar confusão
             history.replaceState({}, '', '/vendedores');
        }
        // --- FIM MODIFICAÇÃO ---

    } else if (routes[path]) {
        // ... (resto da lógica para outras rotas existente, sem alterações) ...
        currentPageId = routes[path];
        if (sellerProductsHeader) sellerProductsHeader.classList.add('hidden');

        switch (path) {
            case '/':
                produtos.fetchAndRenderProducts({ type: 'price', value: 'all' });
                break;
            case '/vendedores':
                 renderSellersGallery();
                 break;
            case '/canais':
                loadChannelData();
                break;
            case '/referencias':
                loadReferences();
                break;
            case '/settings/profile':
                loadProfileData();
                break;
            case '/settings/security':
                setupSecurityPage();
                break;
        }

    } else {
        // ... (código existente sem alterações) ...
        currentPageId = routes['/'];
        if (sellerProductsHeader) sellerProductsHeader.classList.add('hidden');
        produtos.fetchAndRenderProducts({ type: 'price', value: 'all' });
        console.warn(`Route not found: ${path}. Showing products page.`);
        // history.replaceState({}, '', '/');
    }

    // ... (resto da função handleRouteChange existente, sem alterações) ...
    const targetPage = document.getElementById(currentPageId);
    if (targetPage) {
        targetPage.classList.remove('hidden');
    } else {
        const productsPage = document.getElementById(routes['/']);
        if (productsPage) productsPage.classList.remove('hidden');
        console.error(`Page element with ID "${currentPageId}" not found.`);
    }

    let activeLinkPath = path;
    if (path.startsWith('/vendedores/')) {
        activeLinkPath = '/vendedores';
    } else if (path.startsWith('/settings/')) {
        activeLinkPath = null;
    }
    setActiveLink(activeLinkPath);

    window.scrollTo(0, 0);
    updateFilterFabVisibility();
}

// Função para navegar programaticamente
export function navigate(path, state = {}) {
    // ... (código existente sem alterações) ...
    if (window.location.pathname !== path || JSON.stringify(history.state || {}) !== JSON.stringify(state)) {
        history.pushState(state, '', path);
    }
    handleRouteChange();
}

// Ouve o evento 'popstate'
window.addEventListener('popstate', () => handleRouteChange());

// Ouve o carregamento inicial do DOM
document.addEventListener('DOMContentLoaded', () => {
    filterFab = document.getElementById('open-filter-btn');
    handleRouteChange();
    window.addEventListener('resize', updateFilterFabVisibility);
});
