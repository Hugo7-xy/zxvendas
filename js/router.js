// js/router.js
import * as produtos from './systemaprodutos.js';
import { setActiveLink } from './systemamenu.js';
import { closeFilterPanel } from './ui.js';
// Importa funções do settings para carregar dados na página
import { loadProfileData, setupSecurityPage } from './systemasettings.js';
// Importa funções de carregamento das outras páginas
import { loadChannelData } from './systemacanais.js'; // Importa função de carregar canais
import { loadReferences } from './systemareferencias.js'; // Importa função de carregar referências
// Importa a função de renderizar vendedores e a de resetar a flag
import { renderSellersGallery, resetRenderFlag as resetSellersRenderFlag } from './systemavendedores.js';

const routes = {
    '/': 'products-page',
    '/vendedores': 'sellers-page', // <-- Página de vendedores
    '/canais': 'channels-page', // <-- Página de canais
    '/referencias': 'references-page', // <-- Página de referências
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

// Verifica se o FAB de filtro deve estar visível (apenas mobile na página de produtos, sem filtro de vendedor)
export function isFilterFabVisible() {
    const isMobile = window.innerWidth <= 768;
    // O FAB só aparece na página principal de produtos E em mobile E se não houver filtro de vendedor ativo
    return (currentPageId === 'products-page' && isMobile && !currentSellerFilterId);
}


// Atualiza a visibilidade do FAB de filtro
function updateFilterFabVisibility() {
    if (!filterFab) return;
    if (isFilterFabVisible()) {
        const filterPanel = document.getElementById('filter-side-panel');
        // Mostra o FAB apenas se o painel lateral NÃO estiver aberto
        if (!filterPanel || !filterPanel.classList.contains('is-open')) {
            filterFab.style.display = 'flex';
        } else {
            filterFab.style.display = 'none'; // Esconde se o painel abrir
        }
    } else {
        filterFab.style.display = 'none'; // Esconde em outras páginas, desktop ou se houver filtro de vendedor
    }
}


// Função principal que lida com a mudança de rota
export function handleRouteChange() {
    closeFilterPanel(); // Fecha painel de filtro ao mudar de rota
    const path = window.location.pathname;
    const allPages = document.querySelectorAll('.page-content');

    // Esconde todas as páginas primeiro
    allPages.forEach(page => page.classList.add('hidden'));

    // Reseta a flag de renderização dos vendedores sempre que a rota muda
    resetSellersRenderFlag();

    // Reseta filtros e página atual
    currentPageId = null;
    currentSellerFilterId = null;
    currentSellerFilterName = null;

    // Pega referências do cabeçalho de produtos do vendedor (se ainda não pegou)
    if (!sellerProductsHeader) {
        sellerProductsHeader = document.getElementById('seller-products-header');
        backToSellersBtn = document.getElementById('back-to-sellers-btn');
        sellerProductsTitle = document.getElementById('seller-products-title');
        // Adiciona listener ao botão "Voltar" uma única vez
        if (backToSellersBtn) {
            backToSellersBtn.addEventListener('click', (e) => {
                e.preventDefault();
                navigate('/vendedores'); // Navega de volta para a lista de vendedores
            });
        }
    }

    // Verifica se é uma URL de perfil de vendedor (/vendedores/nome-do-vendedor)
    if (path.startsWith('/vendedores/')) {
        const sellerIdFromState = history.state?.sellerId;
        const sellerNameFromUrl = decodeURIComponent(path.split('/vendedores/')[1]);

        if (sellerIdFromState) {
            currentPageId = routes['/']; // Mostra a página de produtos
            currentSellerFilterId = sellerIdFromState;
            currentSellerFilterName = history.state?.sellerName || sellerNameFromUrl;

            if (sellerProductsHeader) sellerProductsHeader.classList.remove('hidden');
            if (sellerProductsTitle) sellerProductsTitle.textContent = `Contas de ${currentSellerFilterName}`;

            document.dispatchEvent(new CustomEvent('sellerSelected', { detail: { sellerId: currentSellerFilterId }}));
            produtos.fetchAndRenderProducts({ type: 'seller', value: currentSellerFilterId });

        } else {
             console.warn(`Seller ID not found for ${sellerNameFromUrl}. Showing sellers list.`);
             currentPageId = routes['/vendedores']; // Fallback para a lista de vendedores
             if (sellerProductsHeader) sellerProductsHeader.classList.add('hidden');
             renderSellersGallery(); // Tenta renderizar a lista de vendedores como fallback
        }

    } else if (routes[path]) {
        // É uma das rotas definidas no objeto 'routes'
        currentPageId = routes[path];
        if (sellerProductsHeader) sellerProductsHeader.classList.add('hidden'); // Garante que header de vendedor está escondido

        // --- AÇÕES ESPECÍFICAS POR ROTA ---
        switch (path) {
            case '/':
                produtos.fetchAndRenderProducts({ type: 'price', value: 'all' });
                break;
            case '/vendedores':
                 renderSellersGallery(); // Chama a função de carregar/renderizar vendedores
                 break;
            case '/canais':
                loadChannelData(); // Chama a função de carregar canais
                break;
            case '/referencias':
                loadReferences(); // Chama a função de carregar referências
                break;
            case '/settings/profile':
                loadProfileData(); // Chama a função do systemasettings.js
                break;
            case '/settings/security':
                setupSecurityPage(); // Chama a função do systemasettings.js
                break;
        }
        // --- FIM AÇÕES ---

    } else {
        // Rota não encontrada, redireciona para a página inicial
        currentPageId = routes['/'];
        if (sellerProductsHeader) sellerProductsHeader.classList.add('hidden');
        produtos.fetchAndRenderProducts({ type: 'price', value: 'all' });
        console.warn(`Route not found: ${path}. Showing products page.`);
        // Opcional: Descomentar para realmente mudar a URL para /
        // history.replaceState({}, '', '/');
    }

    // Mostra a página correspondente ao currentPageId
    const targetPage = document.getElementById(currentPageId);
    if (targetPage) {
        targetPage.classList.remove('hidden');
    } else {
        // Fallback para a página de produtos se a página alvo não for encontrada
        const productsPage = document.getElementById(routes['/']);
        if (productsPage) productsPage.classList.remove('hidden');
        console.error(`Page element with ID "${currentPageId}" not found.`);
    }

    // --- ATUALIZAÇÃO DO LINK ATIVO NA NAVEGAÇÃO ---
    let activeLinkPath = path;
    if (path.startsWith('/vendedores/')) {
        // Se estiver na página de um vendedor específico, marca a aba "Vendedores" como ativa
        activeLinkPath = '/vendedores';
    } else if (path.startsWith('/settings/')) {
        // Nenhuma aba da navegação principal deve ficar ativa para as páginas de configurações
        activeLinkPath = null;
    }
    setActiveLink(activeLinkPath); // Atualiza a classe 'active' nos links da nav
    // --- FIM ATUALIZAÇÃO LINK ---

    window.scrollTo(0, 0); // Rola para o topo da página
    updateFilterFabVisibility(); // Atualiza visibilidade do FAB
}

// Função para navegar programaticamente
export function navigate(path, state = {}) {
    // Só adiciona ao histórico se a URL ou o estado realmente mudarem
    if (window.location.pathname !== path || JSON.stringify(history.state || {}) !== JSON.stringify(state)) {
        history.pushState(state, '', path);
    }
    handleRouteChange(); // Chama a função para processar a nova rota
}

// Ouve o evento 'popstate' (botões voltar/avançar do navegador)
window.addEventListener('popstate', handleRouteChange);

// Ouve o carregamento inicial do DOM
document.addEventListener('DOMContentLoaded', () => {
    filterFab = document.getElementById('open-filter-btn'); // Pega referência do FAB
    handleRouteChange(); // Processa a rota inicial
    window.addEventListener('resize', updateFilterFabVisibility); // Atualiza FAB no resize
});
