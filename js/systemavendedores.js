// js/systemavendedores.js
import { collection, getDocs, query, where, orderBy } from "https://www.gstatic.com/firebasejs/9.6.7/firebase-firestore.js";
import { navigate } from './router.js';

let db;
let sellersData = null; // [NOVO] Armazena os dados pré-carregados
let isLoading = false; // [NOVO] Flag para evitar buscas múltiplas
let hasRendered = false; // Flag para renderizar apenas uma vez

// [NOVA FUNÇÃO] Chamada pelo app.js para buscar dados em segundo plano
export async function preloadSellers(database) {
    if (sellersData || isLoading) return; // Já carregou ou está carregando

    console.log("Pré-carregando vendedores...");
    isLoading = true;
    db = database; // Guarda a referência do DB

    try {
        const q = query(
            collection(db, "users"),
            where("role", "==", "vendedor"),
            orderBy("name", "asc")
        );
        const querySnapshot = await getDocs(q);
        sellersData = []; // Inicializa como array vazio
        querySnapshot.forEach(doc => {
            sellersData.push({ id: doc.id, ...doc.data() });
        });
        console.log(`Pré-carregados ${sellersData.length} vendedores.`);
    } catch (error) {
        console.error("Erro no pré-carregamento de vendedores:", error);
        sellersData = null; // Marca como falha para tentar de novo se necessário
    } finally {
        isLoading = false;
    }
}


export function init(dependencies) {
    console.log("Sistema da Galeria de Vendedores inicializado.");
    // Guarda a referência do DB caso preload não tenha sido chamado ainda
    if(!db) db = dependencies.db; 

    const navLink = document.querySelector('.nav-link[data-target="sellers-page"]');
    if (navLink) {
        navLink.addEventListener('click', (e) => {
            e.preventDefault();
            const targetPath = navLink.getAttribute('href');
            // [MODIFICADO] Apenas navega e tenta renderizar
            navigate(targetPath);
            renderSellersGallery(); // Tenta renderizar com dados pré-carregados
        });
    }

    // Listener para renderizar quando a página é mostrada pelo ROTEADOR
    const sellersPage = document.getElementById('sellers-page');
    if (sellersPage) {
        const observer = new MutationObserver(mutations => {
            mutations.forEach(mutation => {
                if (mutation.attributeName === 'class') {
                    const isHidden = sellersPage.classList.contains('hidden');
                    if (!isHidden && !hasRendered) {
                        renderSellersGallery(); // Renderiza quando a página fica visível
                    }
                }
            });
        });
        observer.observe(sellersPage, { attributes: true });
    }
}

/**
 * [MODIFICADO] Renderiza a galeria usando os dados pré-carregados (sellersData)
 * Se os dados não estiverem prontos, tenta buscá-los agora.
 */
async function renderSellersGallery() {
    const grid = document.getElementById('sellers-grid');
    if (!grid || hasRendered) return; // Sai se não achar o grid ou já tiver renderizado

    grid.innerHTML = '<p>Carregando vendedores...</p>';

    // Se os dados ainda não foram carregados (ex: acesso direto à URL)
    if (!sellersData && !isLoading) {
        console.log("Dados não pré-carregados, buscando agora...");
        await preloadSellers(db); // Tenta carregar agora
    }
    // Se ainda está carregando, espera um pouco e tenta de novo (simples fallback)
    else if (isLoading) {
        console.log("Aguardando pré-carregamento...");
        setTimeout(renderSellersGallery, 500); // Tenta de novo em 0.5s
        return;
    }

    // Se falhou ao carregar ou não há vendedores
    if (!sellersData) {
        grid.innerHTML = '<p>Erro ao carregar vendedores. Tente novamente.</p>';
        return;
    }
    if (sellersData.length === 0) {
        grid.innerHTML = '<p>Nenhum vendedor verificado encontrado.</p>';
        return;
    }

    // Renderiza os cards
    grid.innerHTML = ''; // Limpa o "carregando"
    sellersData.forEach(seller => {
        const card = createSellerCard(seller, seller.id);
        grid.appendChild(card);
    });
    hasRendered = true; // Marca como renderizado
}

/**
 * Cria o HTML do card individual do vendedor (clicável com roteador)
 * (Sem mudanças internas)
 */
function createSellerCard(seller, sellerId) {
    const imageUrl = seller.profileImageUrl || 'https://via.placeholder.com/120?text=Vendedor';
    const sellerName = seller.name || 'Vendedor Verificado';
    const encodedSellerName = encodeURIComponent((sellerName || 'vendedor').replace(/\s+/g, '-').toLowerCase());

    const card = document.createElement('a');
    card.className = 'seller-card';
    card.href = `/vendedores/${encodedSellerName}`;
    card.setAttribute('data-seller-id', sellerId);

    card.innerHTML = `
        <div class="seller-image-wrapper"><img src="${imageUrl}" alt="Foto de ${sellerName}" loading="lazy"></div>
        <span class="seller-name">${sellerName}</span>
    `;

    card.addEventListener('click', (e) => {
       e.preventDefault();
       const path = card.getAttribute('href');
       navigate(path, { sellerId: sellerId, sellerName: sellerName });
    });

    return card;
}
