// js/systemavendedores.js
// (Este é o conteúdo CORRIGIDO)

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

// --- FUNÇÃO HELPER ADICIONADA ---
/**
 * Gera um slug padronizado a partir de um nome.
 * (Cópia da função do backend functions/index.js)
 * @param {string} name O nome a ser convertido.
 * @return {string} O slug gerado.
 */
function createSlug(name) {
  if (!name) return "";
  return name
      .toLowerCase() // Converte para minúsculas
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // Remove acentos
      .replace(/[^a-z0-9\s-]/g, "") // Remove caracteres não alfanuméricos
      .trim() // Remove espaços no início/fim
      .replace(/\s+/g, "-") // Substitui espaços por hífens
      .replace(/-+/g, "-"); // Remove hífens duplicados
}
// --- FIM DA FUNÇÃO HELPER ---


/**
 * Renderiza a galeria de vendedores na página /vendedores.
 */
export async function renderSellersGallery() {
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

    hasRendered = true;
    showLoading();
    grid.innerHTML = '';

    try {
        const q = query(
            collection(db, "users"),
            where("role", "==", "vendedor"),
            orderBy("name", "asc")
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
            // Passa o slug (se existir) para createSellerCard
            const card = createSellerCard(seller, sellerId, seller.slug);
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
function createSellerCard(seller, sellerId, sellerSlug) {
    const card = document.createElement('a');
    card.className = 'seller-card';

    const sellerName = seller.name || 'Vendedor Verificado';

    // --- INÍCIO DA CORREÇÃO ---
    // 1. Se o 'sellerSlug' veio do banco (vendedor novo), usa ele.
    // 2. Se NÃO VEIO (vendedor antigo), GERA O SLUG AQUI no frontend
    //    usando a *mesma* lógica do backend.
    const slugForUrl = sellerSlug || createSlug(sellerName);
    
    // 3. Define o link (href) com o slug correto (ex: /vendedores/hugo7m-vendas)
    card.href = `/vendedores/${slugForUrl}`;
    // --- FIM DA CORREÇÃO ---

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
        
        // --- INÍCIO DA CORREÇÃO (STATE) ---
        // 4. Passa o slug CORRETO ('slugForUrl') para o state do roteador
        navigate(card.getAttribute('href'), {
            sellerId: sellerId,
            sellerName: sellerName,
            sellerSlug: slugForUrl // <-- Passa o slug que acabamos de definir
        });
        // --- FIM DA CORREÇÃO (STATE) ---
    });

    return card;
}

/**
 * Busca as informações do vendedor (ID e Nome) com base no slug vindo da URL.
 * (Esta função está correta e não precisa de mudanças)
 */
export async function getSellerInfoBySlug(slugFromUrl) {
    if (sellerSlugCache[slugFromUrl]) {
        return sellerSlugCache[slugFromUrl];
    }

    if (!db) {
        console.error("getSellerInfoBySlug: 'db' não está pronto.");
        return null;
    }

    try {
        const q = query(
            collection(db, "users"),
            where("slug", "==", slugFromUrl), // <-- Busca pelo slug
            where("role", "==", "vendedor"),
            limit(1)
        );

        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
            console.warn(`Nenhum vendedor encontrado com o slug: ${slugFromUrl}`);
            return null;
        }

        const sellerDoc = querySnapshot.docs[0];
        const sellerData = sellerDoc.data();

        const result = {
            sellerId: sellerDoc.id,
            sellerName: sellerData.name
        };

        sellerSlugCache[slugFromUrl] = result;
        return result;

    } catch (error) {
        console.error("Erro ao buscar vendedor por slug:", error);
        return null;
    }
}
