// js/systemavendedores.js
import { collection, getDocs, query, where, orderBy } from "https://www.gstatic.com/firebasejs/9.6.7/firebase-firestore.js";
import { navigate } from './router.js';

let db;
let sellersData = null; // Armazena os dados dos vendedores carregados
let isLoading = false; // Flag para evitar carregamentos múltiplos
let hasRendered = false; // Flag para renderizar a galeria apenas uma vez por exibição da página

// Função chamada pelo app.js para buscar dados em segundo plano (ou na primeira visita)
export async function preloadSellers(database) {
    // Se já temos os dados (mesmo que seja um array vazio indicando erro anterior ou sem vendedores)
    // ou já estamos carregando, não faz nada
    if (sellersData !== null || isLoading) {
        return;
    }

    isLoading = true;
    // Garante que db seja atribuído
    if (database) {
        db = database;
    }
    if (!db) {
        console.error("preloadSellers: Referência do Firestore (db) não disponível.");
        sellersData = []; // Define como vazio para indicar erro
        isLoading = false;
        return;
    }

    try {
        console.log("preloadSellers: Iniciando busca no Firestore...");
        const q = query(
            collection(db, "users"),
            where("role", "==", "vendedor"),
            orderBy("lastProductTimestamp", "desc"),
            orderBy("name", "asc")
        );

        const querySnapshot = await getDocs(q);

        const loadedSellers = []; // Array temporário
        querySnapshot.forEach(doc => {
            loadedSellers.push({ id: doc.id, ...doc.data() });
        });
        sellersData = loadedSellers; // Atribui ao final
        console.log("Dados dos vendedores carregados:", sellersData.length, "encontrados.");

    } catch (error) {
        console.error("Erro no pré-carregamento/ordenação de vendedores:", error);
        sellersData = []; // Define como array vazio em caso de erro

         if (error.message.includes("requires an index")) {
             console.error("-> Firestore requer um índice composto para esta consulta. Crie-o no console do Firebase.");
         }
    } finally {
        isLoading = false; // Marca que o carregamento terminou
        console.log("preloadSellers: Finalizado. isLoading:", isLoading, "sellersData:", sellersData);
    }
}

// Função de inicialização chamada pelo app.js
export function init(dependencies) {
    if(!db) db = dependencies.db;
    preloadSellers(db); // Inicia o pré-carregamento

    // O listener do link da nav pode ser mantido para tentar renderizar
    // caso o usuário clique antes do preload terminar, mas não é essencial
    // pois o router.js também chama renderSellersGallery.
    const navLink = document.querySelector('.nav-link[data-target="sellers-page"]');
    if (navLink) {
        navLink.addEventListener('click', (e) => {
            if (!hasRendered) {
                 renderSellersGallery();
            }
        });
    }
}

/**
 * Renderiza a galeria de vendedores na página.
 * <<< LÓGICA SIMPLIFICADA >>>
 */
export async function renderSellersGallery() {
    const grid = document.getElementById('sellers-grid');
    if (!grid) {
        console.error("renderSellersGallery: Elemento #sellers-grid não encontrado!");
        return;
    }
    // Evita re-renderizar se já foi feito nesta "instância" da página
    if (hasRendered) {
        console.log("renderSellersGallery: Skip - Já renderizado nesta visualização.");
        return;
    }

    console.log("renderSellersGallery: Iniciando. Estado atual:", { hasRendered, isLoading, sellersData });

    // --- Etapa 1: Verificar se os dados estão prontos ---
    if (sellersData === null) {
        // Dados ainda não foram carregados (nem sequer tentou ou está carregando)
        if (isLoading) {
            // Está carregando em segundo plano, espera um pouco e tenta de novo
            console.log("Renderizando Vendedores: Aguardando carregamento...");
            grid.innerHTML = '<p style="text-align: center; width: 100%;">Carregando vendedores...</p>'; // Mantém msg de carregamento
            setTimeout(() => {
                // Importante: NÃO setar hasRendered = false aqui, pois a flag é por visualização da página.
                // Apenas chama renderSellersGallery de novo. Se já tiver renderizado nesse meio tempo, ela vai sair.
                console.log("Renderizando Vendedores: Tentando novamente após timeout...");
                renderSellersGallery();
            }, 500); // Tenta de novo em 500ms
            return; // Sai desta execução
        } else {
            // Não está carregando E não tem dados, tenta carregar AGORA
            console.log("Renderizando Vendedores: Dados não carregados. Iniciando busca...");
            grid.innerHTML = '<p style="text-align: center; width: 100%;">Carregando vendedores...</p>';
            await preloadSellers(db); // Espera o carregamento
            // Após o await, sellersData deve ter sido populado (ou ser [])
            console.log("Renderizando Vendedores: Busca concluída após await. sellersData:", sellersData);
            // Continua para a Etapa 2 para renderizar com os dados recém-buscados
        }
    }

    // --- Etapa 2: Renderizar com os dados disponíveis (ou mensagem de erro/vazio) ---
    console.log("Renderizando Vendedores: Procedendo para renderização/mensagem final.");

    // Verifica se, após a espera ou busca, temos um array (pode ser vazio)
    if (Array.isArray(sellersData)) {
        if (sellersData.length > 0) {
            // Temos vendedores, renderiza os cards
            grid.innerHTML = ''; // Limpa o "Carregando..."
            sellersData.forEach(seller => {
                const card = createSellerCard(seller, seller.id);
                grid.appendChild(card);
            });
            console.log("Galeria de vendedores renderizada com sucesso.");
        } else {
            // Array está vazio. Verifica se a mensagem atual ainda é "Carregando"
            // Se for, significa que o preloadSellers terminou com erro ou sem resultados.
            if (grid.innerHTML.includes('Carregando')) {
                 let message = '<p style="text-align: center; width: 100%;">Nenhum vendedor verificado encontrado.</p>';
                 // Adiciona aviso sobre erro de índice se a busca falhou (sellersData=[] e isLoading=false)
                 message += '<p style="text-align: center; width: 100%; font-size: 0.9em; color: #8b6c43;">(Se houver erro, verifique o console)</p>';
                 grid.innerHTML = message;
                 console.log("Renderizando Vendedores: Nenhum vendedor encontrado ou erro no carregamento.");
            } else {
                // Se a mensagem não é "Carregando", algo já colocou uma msg de erro antes, não sobrescreve.
                console.log("Renderizando Vendedores: Mensagem anterior (provavelmente erro) mantida.");
            }
        }
    } else {
        // Estado inesperado (sellersData não é null nem array)
        grid.innerHTML = '<p style="text-align: center; width: 100%;">Ocorreu um problema inesperado.</p>';
        console.error("renderSellersGallery: Estado inesperado de sellersData:", sellersData);
    }

    hasRendered = true; // Marca que a tentativa de renderização (ou exibição de msg) foi feita para esta visualização.
    console.log("renderSellersGallery: Finalizado. hasRendered:", hasRendered);
}


/**
 * Cria o elemento HTML (<a>) para o card de um vendedor.
 */
function createSellerCard(seller, sellerId) {
    const imageUrl = seller.profileImageUrl || 'https://via.placeholder.com/120?text=Vendedor';
    const sellerName = seller.name || 'Vendedor Verificado';
    const encodedSellerName = encodeURIComponent((sellerName).replace(/\s+/g, '-').toLowerCase());

    const card = document.createElement('a');
    card.className = 'seller-card';
    card.href = `/vendedores/${encodedSellerName}`;
    card.setAttribute('data-seller-id', sellerId);

    card.innerHTML = `
        <div class="seller-image-wrapper">
            <img src="${imageUrl}" alt="Foto de ${sellerName}" loading="lazy">
        </div>
        <span class="seller-name">${sellerName}</span>
    `;

    card.addEventListener('click', (e) => {
       e.preventDefault();
       const path = card.getAttribute('href');
       navigate(path, { sellerId: sellerId, sellerName: sellerName });
    });

    return card;
}

/**
 * [EXPORTADO] Reseta a flag que indica se a galeria já foi renderizada.
 */
export function resetRenderFlag() {
    hasRendered = false;
    console.log("systemavendedores: resetRenderFlag() chamada.");
}
