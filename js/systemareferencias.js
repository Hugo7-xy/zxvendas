// js/systemareferencias.js
import { collection, getDocs, query, orderBy, limit } from "https://www.gstatic.com/firebasejs/9.6.7/firebase-firestore.js";
import { showLoading, hideLoading } from './ui.js'; // Assumindo que você pode querer usar loading no futuro

let db;
let hasLoaded = false; // Flag para não carregar mais de uma vez

export function init(dependencies) {
    db = dependencies.db;

    const navLink = document.querySelector('.nav-link[data-target="references-page"]');
    if (navLink) {
        // Ouve o clique no link da navegação
        navLink.addEventListener('click', (e) => {
            // Se o menu.js já usa o router, a navegação ocorrerá lá.
            // Aqui, apenas garantimos que o carregamento aconteça.
            if (!hasLoaded) {
                loadReferences();
            }
            // Não prevenimos o default nem navegamos aqui,
            // deixamos o systemamenu.js/router.js cuidarem disso.
        });
    }

    // Adiciona listener para carregar na primeira vez que a página é mostrada pelo ROTEADOR
    const referencesPage = document.getElementById('references-page');
    if (referencesPage) {
        const observer = new MutationObserver(mutations => {
            mutations.forEach(mutation => {
                if (mutation.attributeName === 'class') {
                    const isHidden = referencesPage.classList.contains('hidden');
                    // Se a página ficou visível E ainda não carregou os dados
                    if (!isHidden && !hasLoaded) {
                        loadReferences();
                    }
                }
            });
        });
        // Observa mudanças na classe (para detectar quando 'hidden' é removida)
        observer.observe(referencesPage, { attributes: true });
    }
}

/**
 * Busca as referências no Firestore e as renderiza no grid
 */
async function loadReferences() {
    hasLoaded = true; // Marca como carregado para não buscar de novo
    const grid = document.getElementById('references-grid');
    if (!grid) return;

    // Mostra um loading temporário dentro do grid
    grid.innerHTML = '<p style="text-align: center; width: 100%;">Carregando referências...</p>';

    try {
        // Busca as 50 referências mais recentes
        const q = query(
            collection(db, "references"),
            orderBy("createdAt", "desc"),
            limit(50)
        );

        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
            grid.innerHTML = '<p style="text-align: center; width: 100%;">Nenhuma referência de vendedor encontrada.</p>';
            return;
        }

        grid.innerHTML = ''; // Limpa o "carregando"
        querySnapshot.forEach(doc => {
            const ref = doc.data();
            const card = createReferenceCard(ref);
            grid.appendChild(card);
        });

    } catch (error) {
        console.error("Erro ao carregar referências:", error);
        grid.innerHTML = '<p style="text-align: center; width: 100%;">Erro ao carregar referências. Tente novamente.</p>';
    }
}

/**
 * Cria o HTML do Card de Referência
 * (Texto corrigido para "Vendida por:")
 */
function createReferenceCard(reference) {
    const div = document.createElement('div');
    div.className = 'ref-card';

    div.innerHTML = `
        <img src="${reference.imageUrl}" alt="Referência de venda" loading="lazy">
        <div class="ref-vendor-tag">
            Vendida por: ${reference.sellerName || 'Vendedor Verificado'}
        </div>
    `;
    //   ^^ CORREÇÃO APLICADA AQUI
    return div;
}
