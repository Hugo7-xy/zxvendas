// js/systemafiltro.js
import { showModal, hideModal, closeFilterPanel } from './ui.js';

let priceFilterLinks = [];
// let itemFilterButtons = []; // Não guardamos mais todos os botões de item
let currentActivePriceFilter = null;
let categorizedItems = {}; // Guarda os itens por categoria
let currentSelectedItems = new Set(); // Guarda os itens selecionados globalmente no modal
let itemButtonElements = {}; // Guarda referências aos elementos botão dos itens (chave: nome do item, valor: elemento)
let currentApplyCallback = null; // Guarda o callback para seleção de vendedor
let currentModalMode = 'filter'; // 'filter' ou 'selection'

export function init(dependencies) {

    setupPriceFilters();
    loadAndSetupItemFiltersAndTabs(); // Carrega JSON e cria abas/itens iniciais
    setupFilterModalOpeners();
    setupFilterModalActions(); // Lógica de limpar/aplicar
    setupSellerListener(); // Adiciona listener para 'sellerSelected' separado
}

/** Configura filtros de preço **/
function setupPriceFilters() {
    priceFilterLinks = document.querySelectorAll('.supplier-filter a[data-filter-type="price"]');
    if (priceFilterLinks.length === 0) return;

    currentActivePriceFilter = priceFilterLinks[0]; // "Todas as Contas"
    currentActivePriceFilter.classList.add('active');

    priceFilterLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const filterValue = link.getAttribute('data-filter-value');
            setActivePriceFilter(link); // Atualiza visualmente e limpa itens selecionados
            document.dispatchEvent(new CustomEvent('filterChanged', {
                detail: {
                    type: 'price',
                    value: parsePriceRange(filterValue)
                }
            }));
            closeFilterPanel(); // Fecha painel mobile
        });
    });
}

/**
 * Busca o JSON ESTRUTURADO, cria as ABAS e popula a primeira
 */
async function loadAndSetupItemFiltersAndTabs() {
    const tabMenu = document.getElementById('item-filter-tab-menu');
    const itemGrid = document.getElementById('item-filter-modal-grid');
    if (!tabMenu || !itemGrid) {
         console.error("Elementos do modal de filtro (menu ou grid) não encontrados.");
         return;
    }

    tabMenu.innerHTML = ''; // Limpa menu de abas
    itemGrid.innerHTML = '<p>Carregando itens...</p>'; // Limpa grid

    try {
        const response = await fetch('/data/item.json'); // Caminho corrigido
        if (!response.ok) throw new Error('Falha ao carregar item.json');

        categorizedItems = await response.json(); // Guarda os dados categorizados
        itemButtonElements = {}; // Limpa referências antigas
        const categories = Object.keys(categorizedItems);

        if (categories.length === 0) {
            tabMenu.innerHTML = '<p style="font-size:0.8em; color:#8b6c43;">Nenhuma categoria</p>';
            itemGrid.innerHTML = '<p>Nenhum item encontrado.</p>';
            return;
        }

        // Cria os botões de aba
        categories.forEach((categoryKey, index) => {
            const categoryData = categorizedItems[categoryKey];
            const categoryName = categoryKey.charAt(0).toUpperCase() + categoryKey.slice(1); // Nome formatado
            const tabButton = document.createElement('button');
            tabButton.className = 'filter-tab-button';
            tabButton.setAttribute('data-category', categoryKey);
            tabButton.title = categoryName; // Tooltip com nome
            // Usa uma tag <img> agora, com fallback
            tabButton.innerHTML = `<img src="${categoryData.icon || '/images/icons/default_icon.png'}" alt="${categoryName}" class="filter-tab-icon">`;


            tabButton.addEventListener('click', (e) => {
                e.preventDefault();
                // Remove 'active' de todas as abas
                tabMenu.querySelectorAll('.filter-tab-button').forEach(btn => btn.classList.remove('active'));
                // Adiciona 'active' na clicada
                tabButton.classList.add('active');
                // Define a categoria ativa (atualiza subtítulo e grid)
                setActiveCategory(categoryKey, categoryName);
            });

            tabMenu.appendChild(tabButton);

            // Ativa a primeira aba por padrão
            if (index === 0) {
                tabButton.classList.add('active');
                // Define a categoria ativa inicial
                setActiveCategory(categoryKey, categoryName);
            }
        });

    } catch (error) {
        console.error("Erro ao carregar/processar filtros de item:", error);
        itemGrid.innerHTML = '<p>Erro ao carregar itens.</p>';
    }
}

/**
 * Atualiza o subtítulo e chama displayItemsForCategory
 */
function setActiveCategory(categoryKey, categoryName) {
    const subtitleElement = document.getElementById('item-filter-category-subtitle');
    if (subtitleElement) {
        subtitleElement.textContent = categoryName; // Atualiza o texto do H4
    }
    displayItemsForCategory(categoryKey); // Mostra os itens da categoria
}


/**
 * Limpa a grid e exibe os botões de item para a categoria selecionada
 */
function displayItemsForCategory(categoryKey) {
    const itemGrid = document.getElementById('item-filter-modal-grid');
    if (!itemGrid || !categorizedItems[categoryKey]) return;

    itemGrid.innerHTML = ''; // Limpa a grid atual
    // Não limpa itemButtonElements aqui, guarda todos

    const items = categorizedItems[categoryKey].items;

    if (!items || items.length === 0) {
        itemGrid.innerHTML = '<p style="color: #8b6c43; font-style: italic;">Nenhum item nesta categoria.</p>';
        return;
    }

    items.forEach(itemData => {
        // --- INÍCIO DA MODIFICAÇÃO ---
        const isObject = typeof itemData === 'object' && itemData !== null && itemData.name;
        const itemName = isObject ? itemData.name : itemData; // Pega o nome
        const itemIcon = isObject ? itemData.icon : null; // Pega o ícone se existir
        // --- FIM DA MODIFICAÇÃO ---

        // Reutiliza botão existente se já foi criado antes, senão cria um novo
        let button = itemButtonElements[itemName]; // Usa itemName como chave
        if (!button) {
            button = document.createElement('button');
            button.className = 'item-filter-button'; // Mantenha a classe ou ajuste o CSS
            button.setAttribute('data-filter-type', 'item');
            button.setAttribute('data-filter-value', itemName); // Usa itemName

            // --- INÍCIO DA MODIFICAÇÃO ---
            // Adiciona imagem e texto ao botão
            let buttonContent = '';
            if (itemIcon) {
                // Adicione estilos CSS para a classe 'item-filter-icon' se necessário
                buttonContent += `<img src="${itemIcon}" alt="${itemName}" class="item-filter-icon" style="width: 20px; height: 20px; margin-right: 5px; vertical-align: middle;">`;
            }
            buttonContent += `<span>${itemName}</span>`; // O nome do item
            button.innerHTML = buttonContent;
            // --- FIM DA MODIFICAÇÃO ---


            // Listener para TOGGLE e atualizar o Set global
            button.addEventListener('click', (e) => {
                e.preventDefault();
                button.classList.toggle('active');
                if (button.classList.contains('active')) {
                    currentSelectedItems.add(itemName); // Adiciona ao Set
                } else {
                    currentSelectedItems.delete(itemName); // Remove do Set
                }
            });
            itemButtonElements[itemName] = button; // Guarda a referência
        }

         // Garante que o estado 'active' está correto baseado no Set global
         if (currentSelectedItems.has(itemName)) {
            button.classList.add('active');
         } else {
             button.classList.remove('active');
         }

        itemGrid.appendChild(button);
    });
}

/** Configura botões que abrem o modal **/
function setupFilterModalOpeners() {
    const btnDesktop = document.getElementById('open-item-filter-sidebar-desktop');
    const btnMobile = document.getElementById('open-item-filter-sidebar-mobile');

    const openModalForFilter = () => {
        currentModalMode = 'filter'; // Define o modo
        currentApplyCallback = null; // Limpa callback de seleção
        updateModalSelectionFromGlobalSet(); // Atualiza UI do modal
        // Opcional: Mudar texto do botão Aplicar de volta para "Aplicar Filtro"
        // const applyBtn = document.getElementById('apply-item-filter-btn');
        // if(applyBtn) applyBtn.innerHTML = '<i class="fas fa-check"></i> Aplicar Filtro';
        showModal('item-filter-modal');
    };

    if (btnDesktop) {
        btnDesktop.addEventListener('click', openModalForFilter);
    } else { console.warn("Botão de filtro desktop não encontrado"); }
    if (btnMobile) {
        btnMobile.addEventListener('click', openModalForFilter);
    } else { console.warn("Botão de filtro mobile não encontrado"); }
}

/**
 * Garante que os botões no modal reflitam o Set global ao abrir
 */
function updateModalSelectionFromGlobalSet(){
    Object.keys(itemButtonElements).forEach(itemKey => {
         const buttonElement = itemButtonElements[itemKey];
         if (buttonElement && typeof buttonElement.classList === 'object') {
              if (currentSelectedItems.has(itemKey)) {
                   buttonElement.classList.add('active');
              } else {
                   buttonElement.classList.remove('active');
              }
         }
    });
    // Força a reexibição da aba ativa para garantir que os botões corretos estejam visíveis
     const activeTab = document.querySelector('#item-filter-tab-menu .filter-tab-button.active');
     if (activeTab) {
         const categoryKey = activeTab.dataset.category;
         // Não precisa clicar, apenas chamar displayItemsForCategory
         if(categoryKey) displayItemsForCategory(categoryKey);
     } else {
          // Se nenhuma aba estiver ativa (improvável), ativa a primeira
          const firstTab = document.querySelector('#item-filter-tab-menu .filter-tab-button');
          if (firstTab) firstTab.click();
     }
}


/**
 * Configura botões "Limpar" e "Aplicar" no modal
 */
function setupFilterModalActions() {
    const clearBtn = document.getElementById('clear-item-filter-btn');
    const applyBtn = document.getElementById('apply-item-filter-btn');

    // Botão Limpar
    if(clearBtn) {
        clearBtn.addEventListener('click', () => {
            currentSelectedItems.clear();
            document.getElementById('item-filter-modal').querySelectorAll('.item-filter-button.active').forEach(btn => btn.classList.remove('active'));
            // Se estava no modo 'selection', chama o callback com array vazio
             if (currentModalMode === 'selection' && typeof currentApplyCallback === 'function') {
                 currentApplyCallback([]);
             } else if (currentModalMode === 'filter') {
                  // Se estava no modo 'filter', clica em "Todas as Contas"
                  if(priceFilterLinks[0]) { priceFilterLinks[0].click(); } // Isso fecha o painel
                  else { closeFilterPanel(); }
             }
            hideModal('item-filter-modal');
        });
    }

    // Botão Aplicar
    if (applyBtn) {
        applyBtn.addEventListener('click', () => {
            const selectedItems = Array.from(currentSelectedItems);

            if (currentModalMode === 'selection' && typeof currentApplyCallback === 'function') {
                // Modo SELEÇÃO (para vendedor): Chama o callback
                currentApplyCallback(selectedItems);
            } else if (currentModalMode === 'filter') {
                // Modo FILTRO (para cliente): Dispara evento
                if (selectedItems.length === 0) {
                    if(priceFilterLinks[0]) priceFilterLinks[0].click(); // Age como Limpar
                     else { closeFilterPanel(); }
                } else {
                     if (currentActivePriceFilter) { currentActivePriceFilter.classList.remove('active'); currentActivePriceFilter = null; }
                     if (priceFilterLinks[0]) { priceFilterLinks[0].classList.remove('active'); }
                    document.dispatchEvent(new CustomEvent('filterChanged', { detail: { type: 'items', value: selectedItems } }));
                    closeFilterPanel();
                }
            }
            hideModal('item-filter-modal');
        });
    }
}


/**
 * Gerencia filtro de preço ativo e limpa itens selecionados
 */
function setActivePriceFilter(clickedLink) {
    if (currentActivePriceFilter) { currentActivePriceFilter.classList.remove('active'); }
    currentActivePriceFilter = clickedLink; currentActivePriceFilter.classList.add('active');
    currentSelectedItems.clear(); // Limpa Set global
    // Deseleciona visualmente todos os botões no modal
    document.getElementById('item-filter-modal').querySelectorAll('.item-filter-button.active').forEach(btn => btn.classList.remove('active'));
}

/** Converte valor do data-attribute de preço **/
function parsePriceRange(value) { return value === 'all' ? 'all' : (value === '800+' ? { min: 800, max: Infinity } : (value.includes('-') && !isNaN(parseFloat(value.split('-')[0])) && !isNaN(parseFloat(value.split('-')[1])) ? { min: parseFloat(value.split('-')[0]), max: parseFloat(value.split('-')[1]) } : (console.warn(`Valor de filtro de preço inválido: ${value}. Retornando 'all'.`), 'all'))); }
/** Listener separado para 'sellerSelected' **/
function setupSellerListener(){
     document.addEventListener('sellerSelected', (e) => {
        if (currentActivePriceFilter) { currentActivePriceFilter.classList.remove('active'); currentActivePriceFilter = null; }
        currentSelectedItems.clear();
        document.getElementById('item-filter-modal').querySelectorAll('.item-filter-button.active').forEach(btn => btn.classList.remove('active'));
        if (priceFilterLinks[0]) { priceFilterLinks[0].classList.add('active'); currentActivePriceFilter = priceFilterLinks[0]; }
    });
}

/**
 * [EXPORTADO] Abre o modal de filtro para SELEÇÃO (usado pelo systemavendedor)
 */
export function openItemFilterModalForSelection(initialSelectedItems = [], onApplyCallback) {
     currentModalMode = 'selection'; // Define o modo
     currentApplyCallback = onApplyCallback; // Guarda o callback
     currentSelectedItems = new Set(initialSelectedItems); // Define seleção inicial
     updateModalSelectionFromGlobalSet(); // Atualiza UI do modal

     // Opcional: Mudar texto do botão Aplicar
     const applyBtn = document.getElementById('apply-item-filter-btn');
     if (applyBtn) applyBtn.innerHTML = '<i class="fas fa-check"></i> Confirmar Seleção';

     showModal('item-filter-modal');
}

/**
 * [EXPORTADO] Limpa a seleção visual no modal de filtro (chamado ao abrir add/edit)
 */
export function clearItemSelections() {
     currentSelectedItems.clear();
     // Deseleciona todos os botões conhecidos
     Object.values(itemButtonElements).forEach(btn => {
         if (btn && typeof btn.classList === 'object') { btn.classList.remove('active'); }
     });
     // Garante deselecionar qualquer outro que possa estar ativo
     document.getElementById('item-filter-modal')?.querySelectorAll('.item-filter-button.active').forEach(btn => btn.classList.remove('active'));
}
