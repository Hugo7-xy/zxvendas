// js/systemavendedores.js
// (Este é o conteúdo CORRETO para este arquivo)

import { collection, getDocs, query, where, orderBy, limit } from "https://www.gstatic.com/firebasejs/9.6.7/firebase-firestore.js";
import { showLoading, hideLoading } from './ui.js';
import { navigate } from './router.js'; // Importa o router para navegação

let db;
let hasRendered = false; // Flag para evitar renderização duplicada
let sellerNameCache = {}; // Cache para a função getSellerIdAndNameBySlug

/**
 * Inicializa o módulo, recebendo a dependência do Firestore.
 */
export function init(dependencies) {
    db = dependencies.db;
}

/**
 * [FUNÇÃO CORRIGIDA]
 * Reseta a flag para permitir que a galeria seja renderizada novamente.
 * Isso corrige o erro de build.
 */
export function resetRenderFlag() {
    hasRendered = false;
}

/**
 * [FUNÇÃO FALTANTE]
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
            const card = createSellerCard(seller, sellerId);
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
 */
function createSellerCard(seller, sellerId) {
    const card = document.createElement('a');
    card.className = 'seller-card';
    
    const sellerName = seller.name || 'Vendedor Verificado';
    // Codifica o nome para ser usado na URL
    const slug = encodeURIComponent(sellerName); 
    card.href = `/vendedores/${slug}`; // Define o link

    const photoURL = seller.profileImageUrl || '';
    
    // O CSS usa um ::before para o ícone, então só precisamos da imagem
    card.innerHTML = `
        <div class="seller-image-wrapper">
            ${photoURL ? `<img src="${photoURL}" alt="${sellerName}">` : ''}
        </div>
        <span class="seller-name">${sellerName}</span>
    `;
    
    // Adiciona listener de clique para usar o router
    card.addEventListener('click', (e) => {
        e.preventDefault();
        // Passa o ID e o Nome via 'state' para o router
        navigate(card.getAttribute('href'), { 
            sellerId: sellerId, 
            sellerName: sellerName 
        });
    });

    return card;
}

/**
 * [FUNÇÃO FALTANTE]
 * Busca o ID do vendedor com base no nome (slug) vindo da URL.
 * Usado quando a página de um vendedor é carregada diretamente.
 */
export async function getSellerIdAndNameBySlug(nameFromSlug) {
    // Se o nome estiver no cache, retorna
    if (sellerNameCache[nameFromSlug]) {
        return sellerNameCache[nameFromSlug];
    }

    if (!db) {
        console.error("getSellerIdAndNameBySlug: 'db' não está pronto.");
        return null;
    }

    try {
        // Busca no Firestore pelo nome exato (que veio da URL)
        const q = query(
            collection(db, "users"), 
            where("name", "==", nameFromSlug), 
            where("role", "==", "vendedor"), 
            limit(1)
        );
        
        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
            console.warn(`Nenhum vendedor encontrado com o nome: ${nameFromSlug}`);
            return null;
        }

        const sellerDoc = querySnapshot.docs[0];
        const sellerData = sellerDoc.data();
        
        const result = { 
            sellerId: sellerDoc.id, 
            sellerName: sellerData.name 
        };
        
        sellerNameCache[nameFromSlug] = result; // Salva no cache
        return result;
        
    } catch (error) {
        console.error("Erro ao buscar vendedor por slug (nome):", error);
        return null;
    }
}
