// js/systemavendedores.js
// --- Importa db diretamente ---
import { db } from './firebase-config.js';
import { collection, getDocs, query, where, orderBy } from "https://www.gstatic.com/firebasejs/9.6.7/firebase-firestore.js";
import { navigate } from './router.js';

// --- db não é mais passado ou armazenado aqui ---
let sellersData = null;
let isLoading = false;
let hasRendered = false;

// [MODIFICAÇÃO]: Adicione 'export'
// Função para buscar os dados (não é mais chamada de 'preload')
export async function fetchSellersData() {
    // Evita múltiplas buscas simultâneas
    if (isLoading) return;
    // Se já temos os dados (mesmo que vazios), não busca de novo
    if (sellersData !== null) return;

    isLoading = true;

    // Verifica se o 'db' importado está pronto
    if (!db) {
        console.error("fetchSellersData: Referência do Firestore (db importada) não disponível.");
        sellersData = []; // Define como erro
        isLoading = false;
        return; // Retorna para renderSellersGallery lidar com o array vazio
    }

    try {
        
        const q = query(
            collection(db, "users"),
            where("role", "==", "vendedor"),
            orderBy("lastProductTimestamp", "desc"),
            orderBy("name", "asc")
        );

        const querySnapshot = await getDocs(q);
        const loadedSellers = [];
        querySnapshot.forEach(doc => {
            loadedSellers.push({ id: doc.id, ...doc.data() });
        });
        sellersData = loadedSellers; // Atribui ao final
        

    } catch (error) {
        console.error("Erro ao buscar dados dos vendedores:", error);
        sellersData = []; // Define como array vazio em caso de erro
         if (error.message.includes("requires an index")) {
             console.error("-> Firestore requer um índice composto para esta consulta. Crie-o no console do Firebase.");
         }
    } finally {
        isLoading = false;
        
    }
}

// Função de inicialização chamada pelo app.js (agora mais simples)
export function init(dependencies) {
    // Não precisa mais receber ou armazenar 'db' aqui.
    // Não chama mais preloadSellers aqui.

    // Listener do link da nav (opcional, mas pode ajudar na percepção de velocidade)
    const navLink = document.querySelector('.nav-link[data-target="sellers-page"]');
    if (navLink) {
        navLink.addEventListener('click', (e) => {
            if (!hasRendered) {
                 renderSellersGallery(); // Tenta renderizar ao clicar
            }
        });
    }
}

/**
 * Renderiza a galeria de vendedores na página.
 * <<< LÓGICA AJUSTADA PARA GARANTIR 'db' >>>
 */
export async function renderSellersGallery() {
    const grid = document.getElementById('sellers-grid');
    if (!grid) {
        console.error("renderSellersGallery: Elemento #sellers-grid não encontrado!");
        return;
    }
    if (hasRendered) {
        
        return;
    }

    

    // --- Etapa 1: Garantir que 'db' esteja pronto ---
    if (!db) {
        console.warn("renderSellersGallery: 'db' ainda não está pronto. Tentando novamente em 100ms...");
        grid.innerHTML = '<p style="text-align: center; width: 100%;">Inicializando conexão...</p>'; // Mensagem de inicialização
        setTimeout(renderSellersGallery, 100); // Tenta novamente em breve
        return; // Sai desta execução
    }

    // --- Etapa 2: Verificar/Carregar os dados ---
    if (sellersData === null) {
        if (isLoading) {
            
            grid.innerHTML = '<p style="text-align: center; width: 100%;">Carregando vendedores...</p>';
            setTimeout(renderSellersGallery, 300); // Espera um pouco mais
            return;
        } else {
            
            grid.innerHTML = '<p style="text-align: center; width: 100%;">Carregando vendedores...</p>';
            await fetchSellersData(); // Espera a busca (agora usa o 'db' verificado)
            
            // Continua para renderizar
        }
    }

    // --- Etapa 3: Renderizar com os dados disponíveis ---
    

    if (Array.isArray(sellersData)) {
        if (sellersData.length > 0) {
            grid.innerHTML = '';
            sellersData.forEach(seller => {
                const card = createSellerCard(seller, seller.id);
                grid.appendChild(card);
            });
            
        } else {
            // Se chegou aqui com array vazio, ou não há vendedores ou a busca falhou.
            let message = '<p style="text-align: center; width: 100%;">Nenhum vendedor verificado encontrado.</p>';
            // Adiciona aviso sobre erro de índice/console
            message += '<p style="text-align: center; width: 100%; font-size: 0.9em; color: #8b6c43;">(Verifique o console para possíveis erros)</p>';
            grid.innerHTML = message;
            
        }
    } else {
        // Estado inesperado
        grid.innerHTML = '<p style="text-align: center; width: 100%;">Ocorreu um problema inesperado ao carregar os vendedores.</p>';
        console.error("renderSellersGallery: Estado inesperado de sellersData:", sellersData);
    }

    hasRendered = true;
    
}


/**
 * Cria o elemento HTML (<a>) para o card de um vendedor. (Sem alterações)
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

// [NOVA FUNÇÃO]
/**
 * Busca o ID e o Nome de um vendedor com base no 'slug' (nome-do-vendedor) da URL.
 * Garante que os dados dos vendedores sejam carregados primeiro, se necessário.
 */
export async function getSellerIdAndNameBySlug(slug) {
    // 1. Garante que os dados dos vendedores estejam carregados
    if (sellersData === null) {
        // Chama a função exportada para carregar os dados
        await fetchSellersData();
    }

    // 2. Verifica se o carregamento foi bem-sucedido
    if (!Array.isArray(sellersData)) {
        console.error("getSellerIdAndNameBySlug: sellersData não é um array após fetch.");
        return null;
    }

    // 3. Define a função de "slugify" idêntica à usada em createSellerCard
    const slugify = (name) => encodeURIComponent((name || '').replace(/\s+/g, '-').toLowerCase());

    // 4. Procura o vendedor
    const seller = sellersData.find(s => slugify(s.name) === slug);

    // 5. Retorna os dados do vendedor ou null
    if (seller) {
        return { sellerId: seller.id, sellerName: seller.name };
    }
    return null;
}


export function resetRenderFlag() {
    hasRendered = false;
    
    
}
