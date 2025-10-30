// js/systemavendedores.js
// (Este é o conteúdo CORRETO para este arquivo)

import { collection, getDocs, query, where, orderBy, limit } from "https://www.gstatic.com/firebasejs/9.6.7/firebase-firestore.js";
import { showLoading, hideLoading } from './ui.js';
import { navigate } from './router.js'; // Importa o router para navegação

let db;
let hasRendered = false; // Flag para evitar renderização duplicada
let sellerSlugCache = {}; // Cache para a função getSellerInfoBySlug (chave é o slug)

/**
 * Inicializa o módulo, recebendo a dependência do Firestore.
 */
export function init(dependencies) {
    db = dependencies.db;
}

/**
 * Reseta a flag para permitir que a galeria seja renderizada novamente.
 */
export function resetRenderFlag() {
    hasRendered = false;
}

/**
 * Renderiza a galeria de vendedores na página /vendedores.
 */
export async function renderSellersGallery() {
    // Só renderiza uma vez por carregamento de página, a menos que resetRenderFlag seja chamado
    if (hasRendered) return;

    const grid = document.getElementById('sellers-grid');
    if (!grid) {
        console.error("renderSellersGallery: Elemento #sellers-grid não encontrado!");
        return;
    }

    if (!db) {
        console.warn("renderSellersGallery: 'db' ainda não está pronto. Tentando novamente em 100ms...");
        grid.innerHTML = '<p style="text-align: center; width: 100%;">Inicializando conexão...</p>';
        setTimeout(renderSellersGallery, 100);
        return;
    }

    hasRendered = true; // Marca como renderizado
    showLoading();
    grid.innerHTML = ''; // Limpa o grid

    try {
        // Busca vendedores, ordenados por nome
        const q = query(
            collection(db, "users"),
            where("role", "==", "vendedor"),
            orderBy("name", "asc")
            // orderBy("lastProductTimestamp", "desc") // Alternativa (requer índice composto)
        );

        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
            grid.innerHTML = '<p>Nenhum vendedor verificado encontrado.</p>';
            hideLoading();
            return;
        }

        querySnapshot.forEach(doc => {
            const seller = doc.data();
            const sellerId = doc.id;
            // --- MODIFICAÇÃO: Passa o slug (se existir) para createSellerCard ---
            const card = createSellerCard(seller, sellerId, seller.slug);
            // --- FIM MODIFICAÇÃO ---
            grid.appendChild(card);
        });

    } catch (error) {
        console.error("Erro ao renderizar galeria de vendedores:", error);
        grid.innerHTML = '<p>Erro ao carregar vendedores.</p>';
    } finally {
        hideLoading();
    }
}

/**
 * Cria o HTML do card do vendedor (baseado no style.css).
 * --- MODIFICAÇÃO: Recebe e usa o slug ---
 */
function createSellerCard(seller, sellerId, sellerSlug) {
    const card = document.createElement('a');
    card.className = 'seller-card';

    const sellerName = seller.name || 'Vendedor Verificado';
    // --- MODIFICAÇÃO: Usa o slug para o link, se disponível, senão fallback (codifica nome) ---
    const slugForUrl = sellerSlug || encodeURIComponent(sellerName);
    card.href = `/vendedores/${slugForUrl}`; // Define o link usando o slug
    // --- FIM MODIFICAÇÃO ---

    const photoURL = seller.profileImageUrl || '';

    card.innerHTML = `
        <div class="seller-image-wrapper">
            ${photoURL ? `<img src="${photoURL}" alt="${sellerName}">` : ''}
        </div>
        <span class="seller-name">${sellerName}</span>
    `;

    // Adiciona listener de clique para usar o router
    card.addEventListener('click', (e) => {
        e.preventDefault();
        // --- MODIFICAÇÃO: Passa o ID, Nome E Slug via 'state' ---
        navigate(card.getAttribute('href'), {
            sellerId: sellerId,
            sellerName: sellerName,
            sellerSlug: sellerSlug // <-- Passa o slug aqui
        });
        // --- FIM MODIFICAÇÃO ---
    });

    return card;
}

/**
 * Busca as informações do vendedor (ID e Nome) com base no slug vindo da URL.
 * Usado quando a página de um vendedor é carregada diretamente.
 * --- MODIFICAÇÃO: Renomeada e busca por 'slug' ---
 */
export async function getSellerInfoBySlug(slugFromUrl) {
    // Se o slug estiver no cache, retorna
    if (sellerSlugCache[slugFromUrl]) {
        return sellerSlugCache[slugFromUrl];
    }

    if (!db) {
        console.error("getSellerInfoBySlug: 'db' não está pronto.");
        return null;
    }

    try {
        // --- MODIFICAÇÃO: Busca no Firestore pelo campo 'slug' ---
        const q = query(
            collection(db, "users"),
            where("slug", "==", slugFromUrl), // <-- Busca pelo slug
            where("role", "==", "vendedor"),
            limit(1)
        );
        // --- FIM MODIFICAÇÃO ---

        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
            console.warn(`Nenhum vendedor encontrado com o slug: ${slugFromUrl}`);
            return null;
        }

        const sellerDoc = querySnapshot.docs[0];
        const sellerData = sellerDoc.data();

        const result = {
            sellerId: sellerDoc.id,
            sellerName: sellerData.name // Retorna o nome normal para exibição
        };

        sellerSlugCache[slugFromUrl] = result; // Salva no cache usando o slug como chave
        return result;

    } catch (error) {
        console.error("Erro ao buscar vendedor por slug:", error);
        return null;
    }
}
