// js/systemavendedores.js
import { collection, getDocs, query, where, orderBy } from "https://www.gstatic.com/firebasejs/9.6.7/firebase-firestore.js";
import { navigate } from './router.js';

let db;
let sellersData = null; // Armazena os dados dos vendedores carregados
let isLoading = false; // Flag para evitar carregamentos múltiplos
let hasRendered = false; // Flag para renderizar a galeria apenas uma vez por exibição da página

// Função chamada pelo app.js para buscar dados em segundo plano (ou na primeira visita)
export async function preloadSellers(database) {
    // Se já temos os dados ou já estamos carregando, não faz nada
    if (sellersData || isLoading) {
        return;
    }

    isLoading = true;
    // Garante que db seja atribuído mesmo se chamado antes de init
    if (database) db = database;
    if (!db) {
        console.error("preloadSellers: Referência do Firestore (db) não disponível.");
        isLoading = false;
        sellersData = []; // Define como vazio para indicar erro
        return;
    }


    try {
        // --- MODIFICAÇÃO PARA ORDENAÇÃO ---
        // Cria a query para buscar usuários que são vendedores ('role' == 'vendedor')
        // Ordena primeiro pelo timestamp do último produto (descendente, mais recente primeiro)
        // Depois ordena pelo nome (ascendente) como critério de desempate
        const q = query(
            collection(db, "users"),
            where("role", "==", "vendedor"),
            orderBy("lastProductTimestamp", "desc"), // <--- Ordenação principal
            orderBy("name", "asc")                   // <--- Ordenação secundária (desempate)
        );
        // --- FIM DA MODIFICAÇÃO ---

        const querySnapshot = await getDocs(q); // Executa a busca

        sellersData = []; // Inicializa o array para guardar os dados
        querySnapshot.forEach(doc => {
            // Adiciona cada vendedor encontrado ao array, incluindo seu ID
            sellersData.push({ id: doc.id, ...doc.data() });
        });
        console.log("Dados dos vendedores carregados e ordenados:", sellersData); // Log para depuração

    } catch (error) {
        console.error("Erro no pré-carregamento/ordenação de vendedores:", error);
        sellersData = []; // Define como array vazio em caso de erro para evitar problemas

         // Verifica se o erro é por falta de índice e loga uma mensagem útil
         if (error.message.includes("requires an index")) {
             console.error("-> Firestore requer um índice composto para esta consulta (role == 'vendedor', orderBy lastProductTimestamp DESC, orderBy name ASC). Crie-o no console do Firebase.");
             // Poderia adicionar uma mensagem visual para o usuário aqui se necessário
         }

    } finally {
        isLoading = false; // Marca que o carregamento terminou (com sucesso ou erro)
    }
}

// Função de inicialização chamada pelo app.js
export function init(dependencies) {
    // Guarda a referência do Firestore se ainda não tivermos
    if(!db) db = dependencies.db;

    // Tenta pré-carregar os dados dos vendedores em segundo plano
    preloadSellers(db);

    // Listener para o link de navegação "Vendedores" - Simplificado
    // A navegação principal é feita pelo router.js
    // A renderização também é iniciada pelo router.js
    const navLink = document.querySelector('.nav-link[data-target="sellers-page"]');
    if (navLink) {
        navLink.addEventListener('click', (e) => {
            // Apenas garante que a renderização tente ocorrer se ainda não ocorreu.
            // O router.js fará a chamada principal de renderização.
            if (!hasRendered) {
                 renderSellersGallery();
            }
        });
    }

    // O MutationObserver foi removido, pois o router.js agora chama renderSellersGallery diretamente.
}

/**
 * Renderiza a galeria de vendedores na página.
 * Usa os dados pré-carregados (sellersData).
 * Se os dados não estiverem prontos, tenta buscá-los agora.
 * <<< EXPORTADO >>>
 */
export async function renderSellersGallery() {
    const grid = document.getElementById('sellers-grid');
    // Se não encontrar o grid ou já tiver renderizado nesta exibição da página, sai
    if (!grid) {
        console.error("renderSellersGallery: Elemento #sellers-grid não encontrado!");
        return;
    }
    if (hasRendered) {
        console.log("renderSellersGallery: Já renderizado nesta visualização, saindo.");
        return;
    }


    // Mostra mensagem de carregamento
    grid.innerHTML = '<p style="text-align: center; width: 100%;">Carregando vendedores...</p>';

    // Se sellersData é um array vazio e não estamos carregando, significa que deu erro antes
     if (Array.isArray(sellersData) && sellersData.length === 0 && !isLoading) {
         let message = '<p style="text-align: center; width: 100%;">Erro ao carregar vendedores. Tente novamente mais tarde.</p>';
         // A mensagem de erro de índice é logada no console durante o preloadSellers
         message += '<p style="text-align: center; width: 100%; font-size: 0.9em; color: #8b6c43;">(Verifique o console para possíveis erros)</p>';
         grid.innerHTML = message;
         hasRendered = true; // Marca como "renderizado" (mesmo com erro) para não tentar de novo na mesma visualização
         return;
    }


    // Se os dados ainda não foram carregados E não está carregando agora
    if (!sellersData && !isLoading) {
        console.log("Renderizando Vendedores: Dados não pré-carregados. Buscando agora...");
        await preloadSellers(db); // Espera o carregamento (passa db se tiver)
        // Chama a função novamente para tentar renderizar com os dados carregados
        // Redefine hasRendered para false ANTES de chamar recursivamente
        hasRendered = false;
        renderSellersGallery(); // Tenta renderizar de novo
        return; // Sai desta execução, a próxima chamada cuidará da renderização
    }
    // Se ainda está carregando em segundo plano, espera um pouco e tenta de novo
    else if (isLoading) {
        console.log("Renderizando Vendedores: Aguardando carregamento em segundo plano...");
        setTimeout(() => {
            if (!hasRendered) { // Tenta de novo só se ainda não renderizou
                console.log("Renderizando Vendedores: Tentando novamente após timeout...");
                hasRendered = false; // Garante que pode tentar renderizar
                renderSellersGallery();
            }
        }, 500); // Tenta de novo em 500ms
        return;
    }

     // Se chegou aqui, temos dados (ou um array vazio se não houver vendedores)
     if (Array.isArray(sellersData) && sellersData.length > 0) {
        grid.innerHTML = ''; // Limpa o "Carregando..."
        sellersData.forEach(seller => {
            const card = createSellerCard(seller, seller.id); // Cria o card do vendedor
            grid.appendChild(card); // Adiciona o card ao grid
        });
        hasRendered = true; // Marca que a renderização foi feita com sucesso
        console.log("Galeria de vendedores renderizada.");
     } else if (Array.isArray(sellersData) && sellersData.length === 0) {
        // Se o array está vazio (e não deu erro), não há vendedores
        grid.innerHTML = '<p style="text-align: center; width: 100%;">Nenhum vendedor verificado encontrado.</p>';
        hasRendered = true; // Marca como renderizado
     } else {
        // Estado inesperado
        grid.innerHTML = '<p style="text-align: center; width: 100%;">Ocorreu um problema inesperado ao exibir os vendedores.</p>';
        console.error("renderSellersGallery: Estado inesperado após carregamento. sellersData:", sellersData);
        hasRendered = true; // Marca como renderizado para evitar loop
     }
}


/**
 * Cria o elemento HTML (<a>) para o card de um vendedor.
 * Configura o link para usar o roteador ao ser clicado.
 */
function createSellerCard(seller, sellerId) {
    // Define a URL da imagem (usa placeholder se não houver)
    const imageUrl = seller.profileImageUrl || 'https://via.placeholder.com/120?text=Vendedor';
    // Define o nome (usa padrão se não houver)
    const sellerName = seller.name || 'Vendedor Verificado';
    // Cria um nome "amigável" para a URL (minúsculo, espaços trocados por '-', codificado)
    const encodedSellerName = encodeURIComponent((sellerName).replace(/\s+/g, '-').toLowerCase());

    // Cria o elemento <a> que será o card
    const card = document.createElement('a');
    card.className = 'seller-card'; // Classe para estilização
    card.href = `/vendedores/${encodedSellerName}`; // URL que aparecerá no navegador
    card.setAttribute('data-seller-id', sellerId); // Guarda o ID real nos dados do elemento

    // Define o HTML interno do card
    card.innerHTML = `
        <div class="seller-image-wrapper">
            <img src="${imageUrl}" alt="Foto de ${sellerName}" loading="lazy">
        </div>
        <span class="seller-name">${sellerName}</span>
    `;

    // Adiciona um listener de clique ao card
    card.addEventListener('click', (e) => {
       e.preventDefault(); // Impede a navegação padrão do link <a>
       const path = card.getAttribute('href'); // Pega a URL amigável
       // Chama a função navigate do roteador, passando a URL E os dados extras (ID e nome real)
       navigate(path, { sellerId: sellerId, sellerName: sellerName });
    });

    return card; // Retorna o elemento <a> criado
}

/**
 * [EXPORTADO] Reseta a flag que indica se a galeria já foi renderizada.
 * Chamado pelo router.js antes de processar uma nova rota.
 */
export function resetRenderFlag() {
    hasRendered = false;
    console.log("systemavendedores: resetRenderFlag() chamada.");
}
