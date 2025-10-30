// js/systemaprodutos.js
import { showLoading, hideLoading } from './ui.js';
import { collection, getDocs, query, where, orderBy, doc, getDoc, limit } from "https://www.gstatic.com/firebasejs/9.6.7/firebase-firestore.js";
import { currentSellerFilterId } from './router.js'; // Importa o ID do vendedor ativo

let db;
let sellerCache = {};

export function init(dependencies) {
    db = dependencies.db;

    // Carrega todos os produtos inicialmente
    const initialFilter = { type: 'price', value: 'all' };
    fetchAndRenderProducts(initialFilter);

    // Ouve o evento de filtro da sidebar/modal
    document.addEventListener('filterChanged', (e) => {
        fetchAndRenderProducts(e.detail);
    });
}

/**
 * Busca e renderiza produtos no grid.
 * (Corrigido para orderBy correto com filtros de preço e vendedor)
 */
export async function fetchAndRenderProducts(filter) {
    showLoading();
    const productGrid = document.getElementById('product-grid');
    if (!productGrid) { hideLoading(); return; }
    productGrid.innerHTML = '';

    const requiredItems = (filter.type === 'items' && filter.value?.length > 0) ? filter.value : null;
    const isPriceFilterActive = filter.type === 'price' && filter.value && filter.value !== 'all';

    try {
        const productsRef = collection(db, "produtos");
        let q_constraints = [
            where("available", "==", true)
        ];

        // 1. Adiciona filtro de vendedor SE estiver ativo
        if (currentSellerFilterId) {
            q_constraints.push(where("sellerId", "==", currentSellerFilterId));
            
        }

        // 2. Adiciona filtros específicos (preço ou itens)
        if (isPriceFilterActive) {
            const priceFilter = filter.value;
            if (priceFilter.min) { q_constraints.push(where("price", ">=", priceFilter.min)); }
            if (priceFilter.max && priceFilter.max !== Infinity) { q_constraints.push(where("price", "<=", priceFilter.max)); }
            // *** CORREÇÃO: A primeira ordenação DEVE ser 'price' por causa da desigualdade ***
            q_constraints.push(orderBy("price", "asc"));
            // Podemos tentar adicionar uma segunda ordenação, mas pode exigir índice composto
            // q_constraints.push(orderBy("createdAt", "desc")); // Descomente se tiver o índice

        } else if (filter.type === 'items' && requiredItems) {
            const limitedItems = requiredItems.slice(0, 10);
            q_constraints.push(where("tags", "array-contains-any", limitedItems));
            // *** CORREÇÃO: Adiciona ordenação padrão por data QUANDO NÃO HÁ FILTRO DE PREÇO ***
            q_constraints.push(orderBy("createdAt", "desc"));

        } else {
             // Caso 'all' price ou nenhum filtro específico (apenas vendedor talvez)
             // *** CORREÇÃO: Adiciona ordenação padrão por data ***
             q_constraints.push(orderBy("createdAt", "desc"));
        }

        // 4. Limita o número de resultados
        q_constraints.push(limit(50));

       

        const q = query(productsRef, ...q_constraints);
        const querySnapshot = await getDocs(q);

        // --- Filtro Client-Side para Lógica "E" dos Itens ---
        let finalProductCount = 0;
        for (const doc of querySnapshot.docs) {
            const product = doc.data();
            const productId = doc.id;

            // Filtro client-side para 'items' continua necessário se a consulta foi 'array-contains-any'
            if (requiredItems) {
                const productTags = product.tags || [];
                const productContainsAllItems = requiredItems.every(item => productTags.includes(item));
                if (!productContainsAllItems) {
                    continue;
                }
            }

            finalProductCount++;
            const sellerData = await getSellerData(product.sellerId);
            const card = createProductCard(product, productId, sellerData);
            productGrid.appendChild(card);
        }
        // --- Fim do Filtro Client-Side ---

        if (finalProductCount === 0) {
            productGrid.innerHTML = '<p>Nenhuma conta encontrada para este filtro.</p>';
        }

    } catch (error) {
        console.error("Erro ao buscar produtos:", error);
         if (error.message.includes("requires an index")) {
            // A mensagem de erro agora pode sugerir um índice composto (sellerId, price, createdAt por exemplo)
            productGrid.innerHTML = `<p>Erro: Índice do Firestore ausente ou inválido para esta combinação de filtros e ordenação. <a href="${extractIndexLink(error.message)}" target="_blank" style="color: #c8a664; text-decoration: underline;">Clique aqui para criar o índice necessário</a> e tente novamente após alguns minutos.</p>`;
         } else if (error.message.includes("maximum 10")) {
             productGrid.innerHTML = '<p>Erro: Selecione no máximo 10 itens para filtrar.</p>';
         } else if (error.message.includes("inequality") && error.message.includes("orderBy")) {
             // Captura genérica do erro que você viu
             productGrid.innerHTML = `<p>Erro de consulta: ${error.message}. Verifique a combinação de filtros e ordenação.</p>`;
         }
         else {
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
    const match = errorMessage.match(/https?:\/\/[^\s)\]]+/); // Tenta pegar a URL até espaço, ), ou ]
    return match ? match[0] : '#';
}
/**
 * Busca dados do vendedor (com cache)
 */
async function getSellerData(sellerId) {
    if (!sellerId) return { name: 'Vendedor Desconhecido', whatsapp: '' }; // Adiciona verificação
    if (sellerCache[sellerId]) { return sellerCache[sellerId]; }
    try {
        const userRef = doc(db, "users", sellerId);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) { const data = userSnap.data(); sellerCache[sellerId] = data; return data; }
        console.warn("Documento não encontrado para sellerId:", sellerId);
        return { name: 'Vendedor', whatsapp: '' }; // Fallback se não encontrar
    } catch (e) { console.error("Erro ao buscar vendedor:", e); return { name: 'Vendedor', whatsapp: '' }; }
}

/**
 * Cria o HTML do Card de Produto
 */
function createProductCard(product, productId, sellerData) {
    const div = document.createElement('div'); div.className = 'product-card'; div.setAttribute('data-id', productId);
    const formattedPrice = (product.price || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

    const whatsappNumber = sellerData?.whatsapp || '';
    const sellerNameForMsg = sellerData?.name || 'Vendedor Verificado'; // Usa um nome padrão se não houver
    const message = `Olá, ${sellerNameForMsg}! Tenho interesse na conta "${product.title || 'sem título'}" no valor de ${formattedPrice}, que vi na ZX Store.`; // Adiciona fallback para título
    const whatsappLink = whatsappNumber ? `https://api.whatsapp.com/send?phone=${whatsappNumber}&text=${encodeURIComponent(message)}` : null;

    const videoUrl = product.videoUrl; let videoElementHtml = '';
    if (videoUrl && (videoUrl.includes('youtube.com') || videoUrl.includes('youtu.be'))) {
        const embedUrl = getYouTubeEmbedUrl(videoUrl);
        videoElementHtml = `<iframe src="${embedUrl}" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen loading="lazy"></iframe>`;
    }
    else if (videoUrl && videoUrl.includes('cdn.discordapp.com') && videoUrl.includes('.mp4')) {
        videoElementHtml = `<video src="${videoUrl}" controls loop muted playsinline preload="metadata"></video>`;
    }
    // --- INÍCIO DA MODIFICAÇÃO PARA GOOGLE DRIVE ---
    else if (videoUrl && videoUrl.includes('drive.google.com/file/d/')) {
        try {
            // Extrai o ID do arquivo da URL do Google Drive
            const urlParts = videoUrl.split('/d/');
            const fileId = urlParts[1].split('/')[0];
            const embedUrl = `https://drive.google.com/file/d/${fileId}/preview`;
            videoElementHtml = `<iframe src="${embedUrl}" frameborder="0" allow="autoplay; encrypted-media" allowfullscreen loading="lazy" style="width: 100%; height: 180px;"></iframe>`;
        } catch (e) {
            console.error("Erro ao processar URL do Google Drive:", e);
            videoElementHtml = `<div class="video-placeholder">URL do Google Drive inválida</div>`;
        }
    }
    // --- FIM DA MODIFICAÇÃO ---
    else {
        videoElementHtml = `<div class="video-placeholder">Pré-visualização de vídeo indisponível</div>`;
    }

    const buttonClass = whatsappLink ? "whatsapp-button" : "whatsapp-button disabled";
    const buttonTag = whatsappLink ? 'a' : 'button';
    const buttonAttrs = whatsappLink ? `href="${whatsappLink}" target="_blank"` : 'disabled title="WhatsApp do vendedor não disponível"'; // Adiciona title para botão desabilitado

    div.innerHTML = `
        ${videoElementHtml}
        <div class="card-content">
            <h3>${product.title || 'Título não definido'}</h3>
            <p class="description">${product.description || 'Sem descrição.'}</p>
            <p class="price">${formattedPrice}</p>
            <${buttonTag} ${buttonAttrs} class="${buttonClass}">
                <i class="fab fa-whatsapp"></i> Chamar Vendedor
            </${buttonTag}>
        </div>`;
    return div;
}

/**
 * Converte URL normal do YouTube para URL de Embed.
 */
function getYouTubeEmbedUrl(url) {
    if (!url) return ''; try { const urlObj = new URL(url); let videoId; if (urlObj.hostname === 'youtu.be') { videoId = urlObj.pathname.slice(1); } else if (urlObj.hostname.includes('youtube.com')) { videoId = urlObj.searchParams.get('v'); } if (videoId) { return `https://www.youtube.com/embed/${videoId}`; } else { console.warn("Não foi possível extrair videoId do YouTube:", url); return ''; } } catch (e) { console.error("URL de vídeo inválida:", url, e); return ''; }
}
