// js/systemavendedores.js
// (Este é o conteúdo CORRIGIDO com o await para o DB)

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

    // Lógica de retry se o DB não estiver pronto
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
    const slugForUrl = sellerSlug || createSlug(sellerName);
    
    card.href = `/vendedores/${slugForUrl}`;

    const photoURL = seller.profileImageUrl || '';

    card.innerHTML = `
        <div class="seller-image-wrapper">
            ${photoURL ? `<img src="${photoURL}" alt="${sellerName}">` : ''}
        </div>
        <span class="seller-name">${sellerName}</span>
    `;

    card.addEventListener('click', (e) => {
        e.preventDefault();
        navigate(card.getAttribute('href'), {
            sellerId: sellerId,
            sellerName: sellerName,
            sellerSlug: slugForUrl 
        });
    });

    return card;
}

/**
 * Busca as informações do vendedor (ID e Nome) com base no slug vindo da URL.
 * Usado quando a página de um vendedor é carregada diretamente.
 */
export async function getSellerInfoBySlug(slugFromUrl) {
    // Se o slug estiver no cache, retorna
    if (sellerSlugCache[slugFromUrl]) {
        return sellerSlugCache[slugFromUrl];
    }

    // --- INÍCIO DA CORREÇÃO ---
    // Adiciona a lógica de retry para esperar o 'db' ser inicializado
    if (!db) {
        console.warn("getSellerInfoBySlug: 'db' ainda não está pronto. Tentando novamente em 100ms...");
        // Retorna uma promessa que tenta de novo
        return new Promise((resolve) => {
            setTimeout(() => {
                // Tenta chamar a si mesma novamente
                resolve(getSellerInfoBySlug(slugFromUrl)); 
            }, 100); // Espera 100ms
        });
    }
    // --- FIM DA CORREÇÃO ---

    try {
        // Agora que 'db' está disponível, continua a busca
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
            sellerName: sellerData.name // Retorna o nome normal para exibição
        };

        sellerSlugCache[slugFromUrl] = result; // Salva no cache usando o slug como chave
        return result;

    } catch (error) {
        console.error("Erro ao buscar vendedor por slug:", error);
        return null;
    }
}
