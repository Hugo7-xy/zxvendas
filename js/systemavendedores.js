// js/systemavendedores.js
import { collection, getDocs, query, where, orderBy } from "https://www.gstatic.com/firebasejs/9.6.7/firebase-firestore.js";
import { navigate } from './router.js';

let db;
let sellersData = null;
let isLoading = false;
let hasRendered = false;

// Função chamada pelo app.js para buscar dados em segundo plano
export async function preloadSellers(database) {
    if (sellersData || isLoading) {
        return;
    }

    isLoading = true;
    db = database;

    try {
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

    } catch (error) {
        console.error("Erro no pré-carregamento/ordenação de vendedores:", error);
        sellersData = []; // Define como array vazio em caso de erro

         if (error.message.includes("requires an index")) {
             console.error("-> Firestore requer um índice composto para esta consulta (role == 'vendedor', orderBy lastProductTimestamp DESC). Crie-o no console do Firebase.");
         }

    } finally {
        isLoading = false;
    }
}

export function init(dependencies) {
    if(!db) db = dependencies.db;

    const navLink = document.querySelector('.nav-link[data-target="sellers-page"]');
    if (navLink) {
        navLink.addEventListener('click', (e) => {
            e.preventDefault();
            const targetPath = navLink.getAttribute('href');
            navigate(targetPath);
            renderSellersGallery();
        });
    }

    const sellersPage = document.getElementById('sellers-page');
    if (sellersPage) {
        const observer = new MutationObserver(mutations => {
            mutations.forEach(mutation => {
                if (mutation.attributeName === 'class') {
                    const isHidden = sellersPage.classList.contains('hidden');
                    if (!isHidden && !hasRendered) {
                        renderSellersGallery();
                    }
                }
            });
        });
        observer.observe(sellersPage, { attributes: true });
    }
}

/**
 * Renderiza a galeria usando os dados pré-carregados (sellersData)
 * Se os dados não estiverem prontos, tenta buscá-los agora.
 */
async function renderSellersGallery() {
    const grid = document.getElementById('sellers-grid');
    if (!grid || hasRendered) return;

    grid.innerHTML = '<p>Carregando vendedores...</p>';

    if (Array.isArray(sellersData) && sellersData.length === 0 && !isLoading) {
         const message = '<p>Erro ao carregar vendedores. Tente novamente mais tarde.</p>';
         grid.innerHTML = message;
         return;
    }

    if (!sellersData && !isLoading) {
        await preloadSellers(db);
        renderSellersGallery();
        return;
    }
    else if (isLoading) {
        return;
    }

     if (Array.isArray(sellersData) && sellersData.length > 0) {
        grid.innerHTML = '';
        sellersData.forEach(seller => {
            const card = createSellerCard(seller, seller.id);
            grid.appendChild(card);
        });
        hasRendered = true;
     } else if (Array.isArray(sellersData) && sellersData.length === 0) {
        grid.innerHTML = '<p>Nenhum vendedor verificado encontrado.</p>';
        hasRendered = true;
     } else {
        grid.innerHTML = '<p>Ocorreu um problema inesperado ao exibir os vendedores.</p>';
        console.error("renderSellersGallery: Estado inesperado após carregamento.");
     }
}

/**
 * Cria o HTML do card individual do vendedor (clicável com roteador)
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
