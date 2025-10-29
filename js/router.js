// js/router.js
import * as produtos from './systemaprodutos.js';
import { setActiveLink } from './systemamenu.js';
import { closeFilterPanel } from './ui.js';
import { loadProfileData, setupSecurityPage } from './systemasettings.js';
import { loadChannelData } from './systemacanais.js';
import { loadReferences } from './systemareferencias.js';
// MODIFICADO: Importa findSellerByIdOrUrlName
import { renderSellersGallery, resetRenderFlag as resetSellersRenderFlag, findSellerByIdOrUrlName } from './systemavendedores.js';

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

export function isFilterFabVisible() {
    const isMobile = window.innerWidth <= 768;
    return (currentPageId === 'products-page' && isMobile && !currentSellerFilterId);
}

function updateFilterFabVisibility() {
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

// Função principal (MODIFICADA para ser async e usar fallback)
export async function handleRouteChange() { // Tornar async
    closeFilterPanel();
    const path = window.location.pathname;
    const allPages = document.querySelectorAll('.page-content');
    allPages.forEach(page => page.classList.add('hidden'));
    resetSellersRenderFlag();

    // Reseta filtros temporários para esta execução
    let tempSellerId = null;
    let tempSellerName = null;
    let isSellerPageRoute = false; // Flag para saber se estamos processando uma rota de vendedor

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

    // Verifica se é uma URL de perfil de vendedor (LÓGICA DE FALLBACK ADICIONADA)
    if (path.startsWith('/vendedores/')) {
        isSellerPageRoute = true; // Marca que estamos numa rota de vendedor
        let sellerIdFromState = history.state?.sellerId;
        let sellerNameFromState = history.state?.sellerName;
        // Pega o nome da URL e decodifica (ex: 'hugo7m-vendas')
        const sellerNameFromUrl = decodeURIComponent(path.split('/vendedores/')[1]);

        // Tenta pegar do estado primeiro
        if (sellerIdFromState && sellerNameFromState) {
            console.log("Router: Usando dados do history.state");
            tempSellerId = sellerIdFromState;
            tempSellerName = sellerNameFromState;
        } else {
            // Se o estado falhar, tenta buscar pelo nome da URL
            console.warn(`Router: history.state ausente ou incompleto. Buscando vendedor por nome da URL: ${sellerNameFromUrl}`);
            // Usa a nova função importada de systemavendedores.js
            const foundSeller = await findSellerByIdOrUrlName(sellerNameFromUrl);
            if (foundSeller) {
                console.log("Router: Vendedor encontrado pela URL:", foundSeller.name);
                tempSellerId = foundSeller.id;
                tempSellerName = foundSeller.name;
                // Opcional: Atualizar o state para futuras navegações (back/forward)
                history.replaceState({ sellerId: tempSellerId, sellerName: tempSellerName }, '', path);
            } else {
                 console.error(`Router: Vendedor não encontrado nem pelo state nem pelo nome da URL: ${sellerNameFromUrl}.`);
            }
        }

        // Se conseguimos um ID e Nome (do estado OU da busca por nome)
        if (tempSellerId && tempSellerName) {
            currentPageId = routes['/']; // Mostra a página de produtos
            currentSellerFilterId = tempSellerId; // Define o filtro global
            currentSellerFilterName = tempSellerName;

            if (sellerProductsHeader) sellerProductsHeader.classList.remove('hidden');
            if (sellerProductsTitle) sellerProductsTitle.textContent = `Contas de ${currentSellerName}`;

            document.dispatchEvent(new CustomEvent('sellerSelected', { detail: { sellerId: currentSellerFilterId }}));
            produtos.fetchAndRenderProducts({ type: 'seller', value: currentSellerFilterId });

        } else {
             // Fallback DEFINITIVO se NENHUM método funcionou
             console.error(`Router: Falha crítica ao identificar vendedor para ${path}. Redirecionando para /vendedores.`);
             currentPageId = routes['/vendedores']; // Fallback para a lista
             if (sellerProductsHeader) sellerProductsHeader.classList.add('hidden');
             renderSellersGallery(); // Tenta renderizar a lista
             currentSellerFilterId = null; // Garante que o filtro global está limpo
             currentSellerFilterName = null;
             // Opcional: Mudar a URL para /vendedores para evitar confusão
             // history.replaceState({}, '', '/vendedores');
        }

    } else if (routes[path]) {
        // Rota normal (definida no objeto 'routes')
        currentPageId = routes[path];
        if (sellerProductsHeader) sellerProductsHeader.classList.add('hidden'); // Esconde header
        currentSellerFilterId = null; // Limpa filtro global se não for página de vendedor
        currentSellerFilterName = null;

        // --- AÇÕES ESPECÍFICAS POR ROTA (sem mudanças) ---
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
        // Rota não encontrada (sem mudanças)
        currentPageId = routes['/'];
        if (sellerProductsHeader) sellerProductsHeader.classList.add('hidden');
        currentSellerFilterId = null;
        currentSellerFilterName = null;
        produtos.fetchAndRenderProducts({ type: 'price', value: 'all' });
        console.warn(`Route not found: ${path}. Showing products page.`);
    }

    // Mostra a página correta (sem mudanças)
    const targetPage = document.getElementById(currentPageId);
    if (targetPage) {
        targetPage.classList.remove('hidden');
    } else {
        const productsPage = document.getElementById(routes['/']);
        if (productsPage) productsPage.classList.remove('hidden');
        console.error(`Page element with ID "${currentPageId}" not found.`);
    }

    // --- ATUALIZAÇÃO DO LINK ATIVO NA NAVEGAÇÃO ---
    let activeLinkPath = path;
    if (isSellerPageRoute && tempSellerId) { // Se for página de vendedor E conseguimos identificar o vendedor
        activeLinkPath = '/vendedores'; // Mantém a aba Vendedores ativa
    } else if (path.startsWith('/settings/')) {
        activeLinkPath = null; // Nenhuma aba ativa para Configurações
    }
    setActiveLink(activeLinkPath); // Atualiza a classe 'active' nos links da nav

    window.scrollTo(0, 0);
    updateFilterFabVisibility();
}

// Função para navegar programaticamente (sem mudanças)
export function navigate(path, state = {}) {
    if (window.location.pathname !== path || JSON.stringify(history.state || {}) !== JSON.stringify(state)) {
        history.pushState(state, '', path);
    }
    handleRouteChange(); // Chama a função para processar a nova rota
}

// Ouve o evento 'popstate' (sem mudanças)
window.addEventListener('popstate', handleRouteChange);

// Ouve o carregamento inicial do DOM (sem mudanças)
document.addEventListener('DOMContentLoaded', () => {
    filterFab = document.getElementById('open-filter-btn');
    handleRouteChange(); // Processa a rota inicial
    window.addEventListener('resize', updateFilterFabVisibility);
});
