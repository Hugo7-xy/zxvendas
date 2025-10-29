// js/app.js

// Importações dos serviços do Firebase (centralizados)
import { auth, db, storage, functions, googleProvider } from './firebase-config.js';

// Importação de módulos de UI (MODIFICADO)
import { initModalClosers, showLoading, hideLoading, showToast } from './ui.js';

// Importa o Roteador (MODIFICADO)
import * as router from './router.js';
import { navigate } from './router.js'; // Importa a função navigate

// Importa funções do Firestore (NOVO)
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/9.6.7/firebase-firestore.js";

// Importa módulos
import * as produtos from './systemaprodutos.js';
import * as menu from './systemamenu.js';
import * as filtro from './systemafiltro.js';
import * as vendedor from './systemavendedor.js';
import * as admin from './systemaadmin.js';
import * as registro from './systemaregistro.js';
import * as referencias from './systemareferencias.js';
import * as vendedores from './systemavendedores.js';
import * as canais from './systemacanais.js';

/**
 * (NOVO)
 * Verifica se a URL contém um 'ref' de vendedor e redireciona se válido.
 * Executa apenas na carga inicial da página.
 */
async function handleReferralLink() {
    const urlParams = new URLSearchParams(window.location.search);
    const sellerId = urlParams.get('ref');

    if (sellerId) {
        showLoading(); // Mostra feedback visual
        try {
            const userRef = doc(db, "users", sellerId);
            const userSnap = await getDoc(userRef);

            if (userSnap.exists()) {
                const sellerData = userSnap.data();
                if (sellerData.role === 'vendedor') {
                    const sellerName = sellerData.name || 'Vendedor Verificado';
                    // Constrói o caminho URL seguro
                    const encodedSellerName = encodeURIComponent((sellerName).replace(/\s+/g, '-').toLowerCase());
                    const targetPath = `/vendedores/${encodedSellerName}`;

                    // Remove o parâmetro 'ref' da URL para evitar redirecionamentos repetidos
                    // e navega para a página do vendedor
                    history.replaceState(null, '', window.location.pathname); // Limpa query string
                    navigate(targetPath, { sellerId: sellerId, sellerName: sellerName });
                    // O router.js cuidará de exibir a página correta e carregar os produtos
                    return true; // Indica que um redirecionamento ocorreu
                } else {
                    console.warn(`Referral ID '${sellerId}' não pertence a um vendedor.`);
                    showToast("Link de referência inválido.", "error");
                }
            } else {
                console.warn(`Referral ID '${sellerId}' não encontrado.`);
                showToast("Vendedor da referência não encontrado.", "error");
            }
        } catch (error) {
            console.error("Erro ao processar link de referência:", error);
            showToast("Erro ao processar o link de referência.", "error");
        } finally {
            hideLoading();
            // Limpa o parâmetro da URL mesmo se der erro, para evitar loops
            history.replaceState(null, '', window.location.pathname);
        }
    }
    return false; // Indica que nenhum redirecionamento ocorreu
}


// Event listener para garantir que o DOM está carregado (MODIFICADO para async)
document.addEventListener('DOMContentLoaded', async () => {

    // --- INÍCIO DA NOVA LÓGICA ---
    // Verifica link de referência ANTES de inicializar o resto
    const redirected = await handleReferralLink();
    if (redirected) {
        // Se redirecionou, podemos talvez parar aqui ou apenas deixar
        // o router lidar com a nova rota na sua inicialização normal.
        // Por segurança, vamos deixar continuar, pois o router será chamado
        // pela função navigate e fará o setup correto.
        console.log("Redirecionado via link de referência.");
    }
    // --- FIM DA NOVA LÓGICA ---


    // Inicializa helpers de UI
    try {
        initModalClosers();
    } catch (error) {
        console.error("APP: Erro em initModalClosers():", error);
    }

    // Objeto de dependências
    const dependencies = { auth, db, storage, functions, googleProvider };

    // Inicializa cada módulo do sistema (com try-catch individual)
    try { menu.init(dependencies); }
    catch(e) { console.error("APP: Erro inicializando menu:", e); }

    try { filtro.init(dependencies); }
    catch(e) { console.error("APP: Erro inicializando filtro:", e); }

    try { vendedor.init(dependencies); }
    catch(e) { console.error("APP: Erro inicializando vendedor:", e); }

    try { admin.init(dependencies); }
    catch(e) { console.error("APP: Erro inicializando admin:", e); }

    try { registro.init(dependencies); }
    catch(e) { console.error("APP: Erro inicializando registro:", e); }

    try { referencias.init(dependencies); }
    catch(e) { console.error("APP: Erro inicializando referencias:", e); }

    try { vendedores.init(dependencies); }
    catch(e) { console.error("APP: Erro inicializando vendedores:", e); }

    try { produtos.init(dependencies); }
    catch(e) { console.error("APP: Erro inicializando produtos:", e); }

    try {
        canais.init(dependencies);
    } catch(error) {
        console.error("APP: ERRO AO CHAMAR canais.init():", error);
    }

});
