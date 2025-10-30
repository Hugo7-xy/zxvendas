// js/systemaprodutos.js
import { showLoading, hideLoading } from './ui.js';
import { collection, getDocs, query, where, orderBy, doc, getDoc, limit } from "https://www.gstatic.com/firebasejs/9.6.7/firebase-firestore.js";
// MODIFICADO: Importa também o router para pegar o ID diretamente como fallback
import { currentSellerFilterId as routerSellerId } from './router.js';

let db;
let sellerCache = {};

export function init(dependencies) {
    db = dependencies.db;
    const initialFilter = { type: 'price', value: 'all' };
    // A chamada inicial pode não precisar carregar nada se o router for carregar depois
    // fetchAndRenderProducts(initialFilter); // Pode comentar esta linha se o router sempre carrega na inicialização
    document.addEventListener('filterChanged', (e) => {
        fetchAndRenderProducts(e.detail);
    });
}

/**
 * Busca e renderiza produtos no grid.
 * (Com logs adicionais e verificação de ID)
 */
export async function fetchAndRenderProducts(filter) {
    showLoading();
    const productGrid = document.getElementById('product-grid');
    if (!productGrid) { hideLoading(); return; }
    productGrid.innerHTML = ''; // Limpa antes de mostrar o loading interno

    // --- LOG ADICIONAL: Verifica o ID do vendedor ---
    // Usa o ID do router importado como fallback caso o filter não o tenha (embora devesse ter)
    const sellerIdToFilter = filter?.value?.sellerId || routerSellerId || null;
    console.log(`fetchAndRenderProducts chamado com filtro:`, filter, ` | Usando sellerId: ${sellerIdToFilter}`);
    // --- FIM LOG ---

    productGrid.innerHTML = '<p>Carregando produtos...</p>'; // Loading interno

    const requiredItems = (filter.type === 'items' && filter.value?.length > 0) ? filter.value : null;
    const isPriceFilterActive = filter.type === 'price' && filter.value && filter.value !== 'all';

    try {
        if (!db) {
             throw new Error("Firestore DB não está inicializado.");
        }
        const productsRef = collection(db, "produtos");
        let q_constraints = [
            where("available", "==", true)
        ];

        // 1. Adiciona filtro de vendedor SE estiver ativo
        if (sellerIdToFilter) { // Usa a variável verificada
            console.log(`Adicionando filtro where("sellerId", "==", "${sellerIdToFilter}")`);
            q_constraints.push(where("sellerId", "==", sellerIdToFilter));
        } else {
             console.log("Nenhum filtro de vendedor ativo.");
        }

        // 2. Adiciona filtros específicos (preço ou itens) e ORDENAÇÃO
        if (isPriceFilterActive) {
            const priceFilter = filter.value;
            if (priceFilter.min) { q_constraints.push(where("price", ">=", priceFilter.min)); }
            if (priceFilter.max && priceFilter.max !== Infinity) { q_constraints.push(where("price", "<=", priceFilter.max)); }
            q_constraints.push(orderBy("price", "asc"));
            // q_constraints.push(orderBy("createdAt", "desc")); // Só descomente se criou o índice composto price+createdAt

        } else if (filter.type === 'items' && requiredItems) {
            const limitedItems = requiredItems.slice(0, 10);
            q_constraints.push(where("tags", "array-contains-any", limitedItems));
            q_constraints.push(orderBy("createdAt", "desc")); // Ordenação padrão para filtro de itens

        } else {
             // Caso 'all' price ou APENAS filtro de vendedor
             q_constraints.push(orderBy("createdAt", "desc")); // Ordenação padrão por data
        }

        // 4. Limita o número de resultados
        q_constraints.push(limit(50));

        console.log("Query Constraints:", q_constraints); // Log das constraints

        const q = query(productsRef, ...q_constraints);
        const querySnapshot = await getDocs(q);

        console.log(`Consulta retornou ${querySnapshot.size} documentos.`); // Log do número de resultados

        // Limpa o grid antes de adicionar os cards
        productGrid.innerHTML = '';

        // --- Filtro Client-Side para Lógica "E" dos Itens ---
        let finalProductCount = 0;
        if (querySnapshot.empty) {
            console.log("QuerySnapshot está vazio.");
        } else {
            for (const doc of querySnapshot.docs) {
                const product = doc.data();
                const productId = doc.id;

                // Filtro client-side para 'items' continua necessário se a consulta foi 'array-contains-any'
                if (requiredItems) {
                    const productTags = product.tags || [];
                    const productContainsAllItems = requiredItems.every(item => productTags.includes(item));
                    if (!productContainsAllItems) {
                        continue; // Pula este produto
                    }
                }

                // Verifica se o vendedor do produto bate com o filtro (redundante, mas seguro)
                if (sellerIdToFilter && product.sellerId !== sellerIdToFilter) {
                     console.warn(`Produto ${productId} retornado mas não pertence ao vendedor ${sellerIdToFilter}. Pulando.`);
                     continue;
                }


                finalProductCount++;
                const sellerData = await getSellerData(product.sellerId);
                const card = createProductCard(product, productId, sellerData);
                productGrid.appendChild(card);
            }
        }
        // --- Fim do Filtro Client-Side ---

        // Mensagem se NENHUM produto passou pelos filtros (query vazia OU filtro client-side)
        if (finalProductCount === 0) {
            productGrid.innerHTML = '<p>Nenhuma conta encontrada para este filtro.</p>';
        }

    } catch (error) {
        console.error("Erro CRÍTICO ao buscar produtos:", error); // Log do erro completo
         if (error.message && error.message.includes("requires an index")) {
            productGrid.innerHTML = `<p>Erro: Índice do Firestore ausente ou inválido. <a href="${extractIndexLink(error.message)}" target="_blank" style="color: #c8a664; text-decoration: underline;">Clique aqui para criar o índice</a> e tente novamente após alguns minutos.</p>`;
         } else if (error.message && error.message.includes("maximum 10")) {
             productGrid.innerHTML = '<p>Erro: Selecione no máximo 10 itens para filtrar.</p>';
         } else if (error.message && error.message.includes("inequality") && error.message.includes("orderBy")) {
             productGrid.innerHTML = `<p>Erro de consulta Firestore. Verifique a combinação de filtros e ordenação ou se falta um índice.</p><p style="font-size: 0.8em; color: #8b6c43;">Detalhe: ${error.message}</p>`;
         } else {
            // Mensagem de erro genérica mais informativa
            productGrid.innerHTML = `<p>Erro ao carregar produtos. Verifique o console do navegador para mais detalhes.</p><p style="font-size: 0.8em; color: #8b6c43;">Erro: ${error.message || 'Erro desconhecido'}</p>`;
         }
    } finally {
        hideLoading();
    }
}


function extractIndexLink(errorMessage) {
    const match = errorMessage.match(/https?:\/\/[^\s)\]]+/);
    return match ? match[0] : '#';
}

async function getSellerData(sellerId) {
    // ...(código sem alterações)...
    if (!sellerId) return { name: 'Vendedor Desconhecido', whatsapp: '' };
    if (sellerCache[sellerId]) { return sellerCache[sellerId]; }
    try {
        const userRef = doc(db, "users", sellerId);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) { const data = userSnap.data(); sellerCache[sellerId] = data; return data; }
        console.warn("Documento não encontrado para sellerId:", sellerId);
        return { name: 'Vendedor', whatsapp: '' };
    } catch (e) { console.error("Erro ao buscar vendedor:", e); return { name: 'Vendedor', whatsapp: '' }; }
}

function createProductCard(product, productId, sellerData) {
     // ...(código sem alterações)...
    const div = document.createElement('div'); div.className = 'product-card'; div.setAttribute('data-id', productId);
    const formattedPrice = (product.price || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    const whatsappNumber = sellerData?.whatsapp || '';
    const sellerNameForMsg = sellerData?.name || 'Vendedor Verificado';
    const message = `Olá, ${sellerNameForMsg}! Tenho interesse na conta "${product.title || 'sem título'}" no valor de ${formattedPrice}, que vi na ZX Store.`;
    const whatsappLink = whatsappNumber ? `https://api.whatsapp.com/send?phone=${whatsappNumber}&text=${encodeURIComponent(message)}` : null;
    const videoUrl = product.videoUrl; let videoElementHtml = '';
    if (videoUrl && (videoUrl.includes('youtube.com') || videoUrl.includes('youtu.be'))) {
        const embedUrl = getYouTubeEmbedUrl(videoUrl);
        videoElementHtml = `<iframe src="${embedUrl}" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen loading="lazy"></iframe>`;
    }
    else if (videoUrl && videoUrl.includes('cdn.discordapp.com') && videoUrl.includes('.mp4')) {
        videoElementHtml = `<video src="${videoUrl}" controls loop muted playsinline preload="metadata"></video>`;
    }
    else if (videoUrl && videoUrl.includes('drive.google.com/file/d/')) {
        try {
            const urlParts = videoUrl.split('/d/');
            const fileId = urlParts[1].split('/')[0];
            const embedUrl = `https://drive.google.com/file/d/${fileId}/preview`;
            videoElementHtml = `<iframe src="${embedUrl}" frameborder="0" allow="autoplay; encrypted-media" allowfullscreen loading="lazy" style="width: 100%; height: 180px;"></iframe>`;
        } catch (e) {
            console.error("Erro ao processar URL do Google Drive:", e);
            videoElementHtml = `<div class="video-placeholder">URL do Google Drive inválida</div>`;
        }
    }
    else {
        videoElementHtml = `<div class="video-placeholder">Pré-visualização de vídeo indisponível</div>`;
    }
    const buttonClass = whatsappLink ? "whatsapp-button" : "whatsapp-button disabled";
    const buttonTag = whatsappLink ? 'a' : 'button';
    const buttonAttrs = whatsappLink ? `href="${whatsappLink}" target="_blank"` : 'disabled title="WhatsApp do vendedor não disponível"';
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

function getYouTubeEmbedUrl(url) {
    // ...(código sem alterações)...
    if (!url) return ''; try { const urlObj = new URL(url); let videoId; if (urlObj.hostname === 'youtu.be') { videoId = urlObj.pathname.slice(1); } else if (urlObj.hostname.includes('youtube.com')) { videoId = urlObj.searchParams.get('v'); } if (videoId) { return `https://www.youtube.com/embed/${videoId}`; } else { console.warn("Não foi possível extrair videoId do YouTube:", url); return ''; } } catch (e) { console.error("URL de vídeo inválida:", url, e); return ''; }
}
