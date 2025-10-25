// js/systemaprodutos.js
import { showLoading, hideLoading } from './ui.js';
// Importa 'array-contains-any' e 'limit'
import { collection, getDocs, query, where, orderBy, doc, getDoc, limit } from "https://www.gstatic.com/firebasejs/9.6.7/firebase-firestore.js";

let db;
let sellerCache = {};

export function init(dependencies) {
    console.log("Sistema de Produtos (Preço, Itens Múltiplos 'E', Vendedor) inicializado.");
    db = dependencies.db;

    // Carrega todos os produtos inicialmente
    const initialFilter = { type: 'price', value: 'all' };
    fetchAndRenderProducts(initialFilter);

    // Ouve o evento de filtro da sidebar/modal
    document.addEventListener('filterChanged', (e) => {
        // e.detail será { type: 'price', value: ... }
        // ou { type: 'items', value: ['Item1', 'Item2'] }
        fetchAndRenderProducts(e.detail);
    });

    // Ouve o evento disparado pela galeria de vendedores
    document.addEventListener('sellerSelected', (e) => {
        const { sellerId } = e.detail;
        if (sellerId) {
            // Chama a função de busca com o filtro de vendedor
            fetchAndRenderProducts({ type: 'seller', value: sellerId });
        }
    });
}

/**
 * Busca e renderiza produtos no grid.
 * (Atualizado para aceitar type: 'seller' e filtrar "E" para 'items')
 */
export async function fetchAndRenderProducts(filter) {
    showLoading();
    const productGrid = document.getElementById('product-grid');
    if (!productGrid) { hideLoading(); return; }
    productGrid.innerHTML = '';

    // Guarda os itens selecionados para a filtragem client-side (lógica "E")
    const requiredItems = (filter.type === 'items' && filter.value?.length > 0) ? filter.value : null;

    try {
        // Usa a coleção "produtos"
        const productsRef = collection(db, "produtos");
        let q_constraints = [
            where("available", "==", true)
        ];

        // --- Monta a consulta ao Firestore ---
        if (filter.type === 'price') {
            const priceFilter = filter.value;
            if (priceFilter && priceFilter !== 'all') {
                if (priceFilter.min) { q_constraints.push(where("price", ">=", priceFilter.min)); }
                if (priceFilter.max && priceFilter.max !== Infinity) { q_constraints.push(where("price", "<=", priceFilter.max)); }
                q_constraints.push(orderBy("price", "asc"));
            } else { // 'all'
                q_constraints.push(orderBy("createdAt", "desc"));
            }

        } else if (filter.type === 'items') {
            // Para lógica "E", ainda buscamos por "OU" no Firestore
            // e filtramos depois no Javascript
            if (requiredItems) {
                 // Limita a 10 itens (restrição Firestore)
                const limitedItems = requiredItems.slice(0, 10);
                q_constraints.push(where("tags", "array-contains-any", limitedItems));
                 // Não pode ordenar por createdAt aqui sem índice
            } else { // Array vazio, busca todos
                 q_constraints.push(orderBy("createdAt", "desc"));
            }

        } else if (filter.type === 'seller') {
            const sellerFilter = filter.value; // ID do vendedor
            if (sellerFilter) {
                q_constraints.push(where("sellerId", "==", sellerFilter));
                q_constraints.push(orderBy("createdAt", "desc"));
            } else { // Fallback se sellerId for inválido
                q_constraints.push(orderBy("createdAt", "desc"));
            }
        } else { // Fallback para qualquer outro caso
             q_constraints.push(orderBy("createdAt", "desc"));
        }

        // Limita o número de resultados
        q_constraints.push(limit(50));

        const q = query(productsRef, ...q_constraints);
        const querySnapshot = await getDocs(q);

        // --- Filtro Client-Side para Lógica "E" dos Itens ---
        let finalProductCount = 0;
        for (const doc of querySnapshot.docs) {
            const product = doc.data();
            const productId = doc.id;

            // Se o filtro é por itens, verifica se o produto contém TODOS eles
            if (requiredItems) {
                const productTags = product.tags || [];
                const productContainsAllItems = requiredItems.every(item => productTags.includes(item));

                // Se NÃO contiver todos, PULA para o próximo produto
                if (!productContainsAllItems) {
                    continue;
                }
            }

            // Se passou (ou não era filtro de item), renderiza
            finalProductCount++;
            const sellerData = await getSellerData(product.sellerId);
            const card = createProductCard(product, productId, sellerData);
            productGrid.appendChild(card);
        }
        // --- Fim do Filtro Client-Side ---

        // Mostra mensagem se NENHUM produto passou em TODOS os filtros
        if (finalProductCount === 0) {
            productGrid.innerHTML = '<p>Nenhuma conta encontrada para este filtro.</p>';
        }

    } catch (error) {
        console.error("Erro ao buscar produtos:", error);
         if (error.message.includes("maximum 10")) {
            productGrid.innerHTML = '<p>Erro: Selecione no máximo 10 itens para filtrar.</p>';
         } else if (error.message.includes("requires an index")) {
            // Extrai o link de criação de índice da mensagem de erro
            productGrid.innerHTML = `<p>Erro: Índice do Firestore ausente. <a href="${extractIndexLink(error.message)}" target="_blank" style="color: #c8a664; text-decoration: underline;">Clique aqui para criar o índice</a> e tente novamente após alguns minutos.</p>`;
         } else {
            productGrid.innerHTML = '<p>Erro ao carregar produtos. Tente novamente.</p>';
         }
    } finally {
        hideLoading();
    }
}

/**
 * Helper para extrair o link de criação de índice do erro do Firestore
 */
function extractIndexLink(errorMessage) {
    const match = errorMessage.match(/https?:\/\/[^\s]+/);
    return match ? match[0] : '#';
}
/**
 * Busca dados do vendedor (com cache)
 * (Sem mudanças)
 */
async function getSellerData(sellerId) {
    if (sellerCache[sellerId]) { return sellerCache[sellerId]; }
    try {
        const userRef = doc(db, "users", sellerId);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) { const data = userSnap.data(); sellerCache[sellerId] = data; return data; }
        return { name: 'Vendedor', whatsapp: '' };
    } catch (e) { console.error("Erro ao buscar vendedor:", e); return { name: 'Vendedor', whatsapp: '' }; }
}

/**
 * Cria o HTML do Card de Produto
 * (Sem mudanças)
 */
function createProductCard(product, productId, sellerData) {
    const div = document.createElement('div'); div.className = 'product-card'; div.setAttribute('data-id', productId);
    const formattedPrice = (product.price || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    const message = `Olá, ${sellerData.name}! Tenho interesse na conta "${product.title}" (ID: ${productId}) no valor de ${formattedPrice}, que vi na ZX Store.`;
    const whatsappLink = `https://api.whatsapp.com/send?phone=${sellerData.whatsapp}&text=${encodeURIComponent(message)}`;
    const videoUrl = product.videoUrl; let videoElementHtml = '';
    if (videoUrl && (videoUrl.includes('youtube.com') || videoUrl.includes('youtu.be'))) { const embedUrl = getYouTubeEmbedUrl(videoUrl); videoElementHtml = `<iframe src="${embedUrl}" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>`; }
    else if (videoUrl && videoUrl.includes('cdn.discordapp.com') && videoUrl.includes('.mp4')) { videoElementHtml = `<video src="${videoUrl}" controls loop muted playsinline></video>`; }
    else { videoElementHtml = `<div class="video-placeholder">Pré-visualização de vídeo indisponível</div>`; }
    div.innerHTML = `${videoElementHtml}<div class="card-content"><h3>${product.title}</h3><p class="description">${product.description}</p><p class="price">${formattedPrice}</p><a href="${whatsappLink}" class="whatsapp-button" target="_blank"><i class="fab fa-whatsapp"></i> Chamar Vendedor</a></div>`; return div;
}

/**
 * Converte URL normal do YouTube para URL de Embed.
 * (Sem mudanças)
 */
function getYouTubeEmbedUrl(url) {
    if (!url) return ''; try { const urlObj = new URL(url); let videoId; if (urlObj.hostname === 'youtu.be') { videoId = urlObj.pathname.slice(1); } else if (urlObj.hostname.includes('youtube.com')) { videoId = urlObj.searchParams.get('v'); } else { return url; } return `https://www.youtube.com/embed/${videoId}`; } catch (e) { console.error("URL de vídeo inválida:", url, e); return ''; }
}
