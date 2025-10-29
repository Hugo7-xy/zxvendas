// js/systemacanais.js

// Variável para evitar carregamento múltiplo
let hasLoaded = false;
let db; // Embora não usemos mais o DB aqui, a estrutura init pode passar

export function init(dependencies) {
    // db = dependencies.db; // Não é mais necessário guardar

    // Ouve o clique na aba "Canais" para carregar os dados
    const navLink = document.querySelector('.nav-link[data-target="channels-page"]');
    if (navLink) {
        // Ouve o clique no link da navegação
        navLink.addEventListener('click', (e) => {
            // Se o menu.js já usa o router, a navegação ocorrerá lá.
            // Aqui, apenas garantimos que o carregamento aconteça na primeira vez.
            if (!hasLoaded) {
                loadChannelData(); // <<< Chamada interna ainda funciona
            }
            // Não prevenimos o default nem navegamos aqui,
            // deixamos o systemamenu.js/router.js cuidarem disso.
        });
    }

     // Adiciona listener para carregar na primeira vez que a página é mostrada pelo ROTEADOR
     const channelsPage = document.getElementById('channels-page');
     if (channelsPage) {
         const observer = new MutationObserver(mutations => {
             mutations.forEach(mutation => {
                 if (mutation.attributeName === 'class') {
                     const isHidden = channelsPage.classList.contains('hidden');
                     // Se a página ficou visível E ainda não carregou os dados
                     if (!isHidden && !hasLoaded) {
                         loadChannelData(); // <<< Chamada interna ainda funciona
                     }
                 }
             });
         });
         // Observa mudanças na classe (para detectar quando 'hidden' é removida)
         observer.observe(channelsPage, { attributes: true });
     }


    // Configura a lógica de clique do "acordeão"
    // É importante configurar isso no init para que o listener exista
    // mesmo antes do conteúdo ser carregado.
    setupAccordion();
}

/**
 * Busca os dados do arquivo 'public/data/channels.json' e renderiza o HTML
 * <<< ADICIONE O 'export' AQUI >>>
 */
export async function loadChannelData() {
    // Evita recarregar se já carregou ou se está em processo (caso haja múltiplos cliques rápidos)
    if (hasLoaded) return;
    hasLoaded = true; // Marca como carregado (ou tentando carregar)

    const mainChannelsContainer = document.querySelector('.main-channels');
    const accordionContainer = document.querySelector('.accordion');

    if (!mainChannelsContainer || !accordionContainer) {
        console.error("Canais: Containers HTML não encontrados!");
        return;
    }

    // Feedback visual enquanto carrega
    mainChannelsContainer.innerHTML = "<p>Carregando canais...</p>";
    accordionContainer.innerHTML = ""; // Limpa acordeão

    try {
        // Usa fetch() para ler o arquivo local
        const response = await fetch('/data/channels.json'); // Caminho corrigido
        if (!response.ok) {
            throw new Error(`Falha ao carregar channels.json (Status: ${response.status})`);
        }
        const data = await response.json();
        

        // Limpa containers antes de renderizar
        mainChannelsContainer.innerHTML = '';
        accordionContainer.innerHTML = '';

        // Renderiza os botões principais (Discord, Telegram)
        if (data.main && data.main.length > 0) {
            renderMainChannels(data.main, mainChannelsContainer);
        } else {
             mainChannelsContainer.innerHTML = "<p>Nenhum canal principal configurado.</p>";
             console.warn("Canais: Chave 'main' não encontrada ou vazia no JSON.");
        }

        // Renderiza os grupos de franquia (WhatsApp)
        if (data.franchises && data.franchises.length > 0) {
            renderFranchiseAccordion(data.franchises, accordionContainer);
        } else {
             // Não mostra nada se não houver franquias, ou pode adicionar uma mensagem
             console.warn("Canais: Chave 'franchises' não encontrada ou vazia no JSON.");
        }
    } catch (error) {
        console.error("Erro ao buscar dados dos canais:", error);
        mainChannelsContainer.innerHTML = "<p>Erro ao carregar canais principais.</p>";
        accordionContainer.innerHTML = "<p>Erro ao carregar grupos.</p>";
        hasLoaded = false; // Permite tentar carregar novamente se der erro
    }
}

/**
 * Cria os botões principais (Discord, Telegram)
 */
function renderMainChannels(mainLinks, container) {
    mainLinks.forEach(link => {
        const a = document.createElement('a');
        a.href = link.url || '#'; // Fallback para URL
        a.target = "_blank";
        a.rel = "noopener noreferrer"; // Boa prática de segurança
        a.className = `channel-button ${link.class || ''}`;
        a.innerHTML = `<i class="${link.icon || 'fas fa-link'}"></i> ${link.name || 'Link'}`; // Fallback para nome e ícone
        container.appendChild(a);
    });
}

/**
 * Cria a estrutura do acordeão para os grupos de WhatsApp
 */
function renderFranchiseAccordion(franchises, container) {
    franchises.forEach(franchise => {
        const item = document.createElement('div');
        item.className = 'accordion-item';

        const header = document.createElement('button');
        header.className = 'accordion-header';
        header.textContent = franchise.name || 'Grupo'; // Fallback

        const content = document.createElement('div');
        content.className = 'accordion-content';

        const grid = document.createElement('div');
        grid.className = 'whatsapp-grid';

        // Adiciona os links de WhatsApp de cada franquia (se existirem)
        if (franchise.links && franchise.links.length > 0) {
            franchise.links.forEach(link => {
                const a = document.createElement('a');
                a.href = link.url || '#'; // Fallback
                a.target = "_blank";
                a.rel = "noopener noreferrer";
                // Reutiliza o estilo do botão de WhatsApp dos cards
                a.className = 'whatsapp-button';
                a.innerHTML = `<i class="fab fa-whatsapp"></i> ${link.name || 'Grupo WhatsApp'}`; // Fallback
                grid.appendChild(a);
            });
        } else {
            // Mensagem se uma franquia não tiver links
            grid.innerHTML = '<p style="color: #8b6c43; font-style: italic;">Nenhum grupo nesta franquia.</p>';
        }

        content.appendChild(grid);
        item.appendChild(header);
        item.appendChild(content);
        container.appendChild(item);
    });
}

/**
 * Adiciona o listener de clique para o acordeão
 * (Usa "event delegation" para funcionar com itens criados dinamicamente)
 */
function setupAccordion() {
    const accordionContainer = document.querySelector('.accordion');
    if (!accordionContainer) return;

    accordionContainer.addEventListener('click', (e) => {
        // Verifica se o clique foi DIRETAMENTE em um 'accordion-header'
        if (e.target.matches('.accordion-header')) {
            e.preventDefault();

            const header = e.target;
            const content = header.nextElementSibling; // O .accordion-content

            // Fecha outros itens abertos (opcional, mas recomendado)
            accordionContainer.querySelectorAll('.accordion-header.active').forEach(otherHeader => {
                if (otherHeader !== header) {
                    otherHeader.classList.remove('active');
                    const otherContent = otherHeader.nextElementSibling;
                    if (otherContent) otherContent.style.maxHeight = null;
                }
            });

            // Abre ou fecha o item clicado
            header.classList.toggle('active');
            if (content) { // Verifica se content existe
                 if (content.style.maxHeight) {
                    // Se está aberto, fecha
                    content.style.maxHeight = null;
                } else {
                    // Se está fechado, abre (calcula a altura do conteúdo interno)
                    content.style.maxHeight = content.scrollHeight + "px";
                }
            }
        }
    });
}
