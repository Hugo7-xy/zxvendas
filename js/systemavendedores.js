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
    // Se 'database' foi passado (ex: de init), usa ele. Senão, usa o 'db' global do módulo.
    if (database) {
        db = database;
    }

    // --- ADICIONE ESTA VERIFICAÇÃO ---
    if (!db) {
        console.error("preloadSellers: Referência do Firestore (db) não disponível no momento da chamada.");
        isLoading = false;
        sellersData = []; // Define como vazio para indicar erro e evitar loop
        return; // Sai da função se db não estiver pronto
    }
    // --- FIM DA VERIFICAÇÃO ---


    try {
        // Cria a query para buscar usuários que são vendedores ('role' == 'vendedor')
        const q = query(
            collection(db, "users"),
            where("role", "==", "vendedor"),
            orderBy("lastProductTimestamp", "desc"),
            orderBy("name", "asc")
        );

        const querySnapshot = await getDocs(q);

        sellersData = [];
        querySnapshot.forEach(doc => {
            sellersData.push({ id: doc.id, ...doc.data() });
        });
        console.log("Dados dos vendedores carregados e ordenados:", sellersData);

    } catch (error) {
        console.error("Erro no pré-carregamento/ordenação de vendedores:", error);
        sellersData = []; // Define como array vazio em caso de erro

         if (error.message.includes("requires an index")) {
             console.error("-> Firestore requer um índice composto para esta consulta. Crie-o no console do Firebase.");
         }

    } finally {
        isLoading = false;
    }
}

// Função de inicialização chamada pelo app.js
export function init(dependencies) {
    // Guarda a referência do Firestore se ainda não tivermos
    if(!db) db = dependencies.db;

    // Tenta pré-carregar os dados dos vendedores em segundo plano
    // Passa o 'db' explicitamente aqui
    preloadSellers(db);

    // Listener para o link de navegação "Vendedores" - Simplificado
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
 */
export async function renderSellersGallery() {
    const grid = document.getElementById('sellers-grid');
    if (!grid) {
        console.error("renderSellersGallery: Elemento #sellers-grid não encontrado!");
        return;
    }
    if (hasRendered) {
        console.log("renderSellersGallery: Já renderizado nesta visualização, saindo.");
        return;
    }

    grid.innerHTML = '<p style="text-align: center; width: 100%;">Carregando vendedores...</p>';

    // Se sellersData é um array vazio E não está carregando -> Erro anterior
     if (Array.isArray(sellersData) && sellersData.length === 0 && !isLoading) {
         let message = '<p style="text-align: center; width: 100%;">Erro ao carregar vendedores. Tente novamente mais tarde.</p>';
         message += '<p style="text-align: center; width: 100%; font-size: 0.9em; color: #8b6c43;">(Verifique o console para possíveis erros)</p>';
         grid.innerHTML = message;
         hasRendered = true;
         return;
    }

    // Se os dados ainda não foram carregados (sellersData === null) E não está carregando
    if (sellersData === null && !isLoading) {
        console.log("Renderizando Vendedores: Dados não pré-carregados. Buscando agora...");
        // Chama preloadSellers passando o 'db' que DEVE ter sido setado pelo init
        await preloadSellers(db);
        // Tenta renderizar novamente após a tentativa de carregamento
        hasRendered = false; // Permite a próxima chamada renderizar
        renderSellersGallery();
        return;
    }
    // Se ainda está carregando em segundo plano
    else if (isLoading) {
        console.log("Renderizando Vendedores: Aguardando carregamento em segundo plano...");
        setTimeout(() => {
            if (!hasRendered) {
                console.log("Renderizando Vendedores: Tentando novamente após timeout...");
                hasRendered = false;
                renderSellersGallery();
            }
        }, 500);
        return;
    }

     // Se chegou aqui, temos dados (ou um array vazio se não houver vendedores)
     if (Array.isArray(sellersData) && sellersData.length > 0) {
        grid.innerHTML = '';
        sellersData.forEach(seller => {
            const card = createSellerCard(seller, seller.id);
            grid.appendChild(card);
        });
        hasRendered = true;
        console.log("Galeria de vendedores renderizada.");
     } else if (Array.isArray(sellersData) && sellersData.length === 0) {
        // Se o array está vazio (pode ser erro no preload ou nenhum vendedor)
        // A mensagem de erro específica já foi tratada acima. Se chegou aqui sem erro, não há vendedores.
        if (grid.innerHTML.includes('Carregando')) { // Evita sobrescrever msg de erro
             grid.innerHTML = '<p style="text-align: center; width: 100%;">Nenhum vendedor verificado encontrado.</p>';
        }
        hasRendered = true;
     } else {
        // Estado inesperado
        grid.innerHTML = '<p style="text-align: center; width: 100%;">Ocorreu um problema inesperado ao exibir os vendedores.</p>';
        console.error("renderSellersGallery: Estado inesperado. sellersData:", sellersData);
        hasRendered = true;
     }
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
