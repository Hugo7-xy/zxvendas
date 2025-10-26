// js/router.js
import * as produtos from './systemaprodutos.js';
import { setActiveLink } from './systemamenu.js';
import { closeFilterPanel } from './ui.js';

const routes = {
    '/': 'products-page',
    '/vendedores': 'sellers-page',
    '/canais': 'channels-page',
    '/referencias': 'references-page'
};

export let currentSellerFilterId = null;
let currentSellerFilterName = null;
let filterFab = null; // Referência para o botão flutuante
let currentPageId = null; // Guarda o ID da página atual
let backToSellersBtn = null; // <- NOVA: Referência para o botão voltar
let sellerProductsHeader = null; // <- NOVA: Referência para o header
let sellerProductsTitle = null; // <- NOVA: Referência para o título

/**
 * [EXPORTADO] Verifica se o botão flutuante de filtro deve estar visível.
 * Usado pelo ui.js para decidir se mostra o botão ao fechar o painel.
 * @returns {boolean} True se o botão deve estar visível, false caso contrário.
 */
export function isFilterFabVisible() {
    const isMobile = window.innerWidth <= 768;
    return (currentPageId === 'products-page' && isMobile);
}

/**
 * Atualiza a visibilidade do botão flutuante de filtro com base na página e tamanho da tela.
 */
function updateFilterFabVisibility() {
    if (!filterFab) return; // Sai se o botão não foi encontrado no DOM

    // Usa a função exportada para verificar as condições
    if (isFilterFabVisible()) {
        // Garante que só mostra se o painel de filtro estiver fechado
        const filterPanel = document.getElementById('filter-side-panel');
        if (!filterPanel || !filterPanel.classList.contains('is-open')) {
             filterFab.style.display = 'flex'; // Mostra o botão
        } else {
             filterFab.style.display = 'none'; // Mantém escondido se o painel já estiver aberto
        }
    } else {
        filterFab.style.display = 'none'; // Esconde o botão em outras páginas ou no desktop
    }
}

/**
 * Função principal que lê a URL atual, mostra a página correta e atualiza a UI.
 */
export function handleRouteChange() {
    closeFilterPanel(); // Fecha painel de filtro (esquerdo) se estiver aberto
    // Poderia fechar o painel de usuário também se desejado: closeUserPanel();
    const path = window.location.pathname;
    const allPages = document.querySelectorAll('.page-content');

    // Esconde todas as páginas
    allPages.forEach(page => page.classList.add('hidden'));

    // Reseta variáveis de estado da rota
    currentPageId = null;
    currentSellerFilterId = null;
    currentSellerFilterName = null;

    // --- NOVO: Pega referências dos elementos do cabeçalho do vendedor ---
    if (!sellerProductsHeader) { // Pega apenas uma vez
        sellerProductsHeader = document.getElementById('seller-products-header');
        backToSellersBtn = document.getElementById('back-to-sellers-btn');
        sellerProductsTitle = document.getElementById('seller-products-title');

        // Adiciona listener de clique ao botão voltar (apenas uma vez)
        if (backToSellersBtn) {
            backToSellersBtn.addEventListener('click', (e) => {
                e.preventDefault();
                navigate('/vendedores');
            });
        }
    }
    // --- Fim NOVO ---


    // Lógica para determinar qual página mostrar
    if (path.startsWith('/vendedores/')) {
        // É uma URL de perfil de vendedor
        const sellerIdFromState = history.state?.sellerId;
        const sellerNameFromUrl = decodeURIComponent(path.split('/vendedores/')[1]);

        if (sellerIdFromState) {
            currentPageId = routes['/']; // Mostra a página de PRODUTOS
            currentSellerFilterId = sellerIdFromState;
            currentSellerFilterName = history.state?.sellerName || sellerNameFromUrl; // Pega o nome do state se disponível

             // --- NOVO: Mostra o cabeçalho e define o título ---
             if (sellerProductsHeader) sellerProductsHeader.classList.remove('hidden');
             if (sellerProductsTitle) sellerProductsTitle.textContent = `Contas de ${currentSellerFilterName}`; // Define o título
             // --- Fim NOVO ---

            // Dispara evento para limpar filtros da sidebar PRIMEIRO
            document.dispatchEvent(new CustomEvent('sellerSelected', { detail: { sellerId: currentSellerFilterId } }));
            // DEPOIS aciona o filtro de produtos para este vendedor
            produtos.fetchAndRenderProducts({ type: 'seller', value: currentSellerFilterId });

        } else {
            // Se acessou a URL diretamente (sem state), mostra a lista de vendedores
            console.warn(`Seller ID not found in state for ${sellerNameFromUrl}. Showing all sellers.`);
            currentPageId = routes['/vendedores'];
             // --- NOVO: Esconde o cabeçalho ---
             if (sellerProductsHeader) sellerProductsHeader.classList.add('hidden');
             // --- Fim NOVO ---
            // Poderia tentar buscar o ID pelo nome aqui se necessário
        }

    } else if (routes[path]) {
        // É uma das rotas principais definidas em 'routes'
        currentPageId = routes[path];
         // --- NOVO: Esconde o cabeçalho ---
         if (sellerProductsHeader) sellerProductsHeader.classList.add('hidden');
         // --- Fim NOVO ---
        // Se for a página de produtos (rota '/'), garante que mostre TODOS os produtos
        if (path === '/') {
            produtos.fetchAndRenderProducts({ type: 'price', value: 'all' });
        }
    } else {
        // Rota não encontrada, redireciona/mostra produtos como padrão
        currentPageId = routes['/'];
         // --- NOVO: Esconde o cabeçalho ---
         if (sellerProductsHeader) sellerProductsHeader.classList.add('hidden');
         // --- Fim NOVO ---
        produtos.fetchAndRenderProducts({ type: 'price', value: 'all' });
        console.warn(`Route not found: ${path}. Showing products page.`);
        // Para um redirecionamento real: history.replaceState({}, '', '/');
    }

    // Mostra a página de conteúdo correta
    const targetPage = document.getElementById(currentPageId);
    if (targetPage) {
        targetPage.classList.remove('hidden');
    } else {
        // Fallback: Se o ID da página não for encontrado, mostra a página de produtos
        const productsPage = document.getElementById(routes['/']);
        if (productsPage) productsPage.classList.remove('hidden');
        console.error(`Page element with ID "${currentPageId}" not found.`);
    }

    // Atualiza qual link está ativo na navegação principal
    setActiveLink(path.startsWith('/vendedores/') ? '/vendedores' : path);

    // Rola a janela para o topo
    window.scrollTo(0, 0);

    // Atualiza a visibilidade do botão flutuante de filtro
    updateFilterFabVisibility();
}

/**
 * Função para navegar para uma nova URL programaticamente (usada pelos links do site).
 * Atualiza a URL na barra do navegador e chama handleRouteChange para atualizar o conteúdo.
 * @param {string} path - O novo caminho da URL (ex: "/vendedores").
 * @param {object} [state={}] - Dados opcionais para associar à entrada do histórico (ex: { sellerId: '...' }).
 */
export function navigate(path, state = {}) {
    // Evita adicionar entradas duplicadas no histórico se a URL e o estado já forem os mesmos
    if (window.location.pathname !== path || JSON.stringify(history.state) !== JSON.stringify(state)) {
         history.pushState(state, '', path);
    }
    // Chama a função que lê a URL (agora atualizada) e mostra a página correta
    handleRouteChange();
}

// Ouve os eventos de Voltar/Avançar do navegador
window.addEventListener('popstate', handleRouteChange);

// Lida com a rota inicial quando a página carrega E pega referência do FAB
document.addEventListener('DOMContentLoaded', () => {
    // Pega a referência do botão flutuante
    filterFab = document.getElementById('open-filter-btn');
    // Chama handleRouteChange para processar a URL inicial
    handleRouteChange();

    // Ouve o redimensionamento da janela para mostrar/esconder o FAB corretamente
    window.addEventListener('resize', updateFilterFabVisibility);
});
