// js/systemaadmin.js
import { showModal, hideModal, showToast, showLoading, hideLoading } from './ui.js';
import { httpsCallable } from "https://www.gstatic.com/firebasejs/9.6.7/firebase-functions.js";
import { collection, query, where, getDocs, doc, getDoc } from "https://www.gstatic.com/firebasejs/9.6.7/firebase-firestore.js";

let db, auth, functions;
let adminTabInitialized = false; // Flag para carregar vendedores só uma vez
let confirmAction = null; // Armazena a função a ser executada na confirmação

export function init(dependencies) {
    db = dependencies.db;
    auth = dependencies.auth;
    functions = dependencies.functions;

    setupAuthListener();
    setupModalListeners();
    setupConfirmationModal();
}

/**
 * Ouve o estado de autenticação para verificar se o usuário é admin
 */
function setupAuthListener() {
    auth.onAuthStateChanged(async (user) => {
        if (user) {
            // Busca os dados do usuário (especialmente a 'role') do Firestore
            const userRef = doc(db, "users", user.uid);
            const userSnap = await getDoc(userRef);
            
            if (userSnap.exists() && userSnap.data().role === 'admin') {
                showAdminTab();
            } else {
                hideAdminTab();
            }
        } else {
            hideAdminTab();
        }
    });
}

/**
 * Mostra a aba de Admin e prepara seus eventos
 */
function showAdminTab() {
    const adminTabButton = document.getElementById('admin-tab-button');
    if (!adminTabButton) return;
    
    adminTabButton.classList.remove('hidden');

    // Adiciona listener para carregar os vendedores QUANDO o admin clicar na aba
    adminTabButton.querySelector('button').addEventListener('click', () => {
        if (!adminTabInitialized) {
            loadSellers();
            adminTabInitialized = true;
        }
    });
}

/**
 * Esconde a aba de Admin
 */
function hideAdminTab() {
    const adminTabButton = document.getElementById('admin-tab-button');
    if (adminTabButton) adminTabButton.classList.add('hidden');
    
    // Esconde o painel de admin caso esteja visível
    const adminPanel = document.getElementById('panel-admin');
    if (adminPanel) adminPanel.classList.add('hidden');
}

/**
 * Carrega e renderiza a lista de vendedores
 */
async function loadSellers() {
    const listContainer = document.getElementById('admin-seller-list');
    if (!listContainer) return;
    
    listContainer.innerHTML = '<p>Carregando vendedores...</p>';

    try {
        const q = query(collection(db, "users"), where("role", "==", "vendedor"));
        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
            listContainer.innerHTML = '<p>Nenhum vendedor encontrado.</p>';
            return;
        }

        listContainer.innerHTML = ''; // Limpa
        querySnapshot.forEach((doc) => {
            const seller = doc.data();
            const sellerId = doc.id;
            
            const item = document.createElement('div');
            item.className = 'vendor-product-item'; // Reutiliza o estilo
            item.innerHTML = `
                <div class="vendor-info">
                    <span class="vendor-name">${seller.name || 'Nome não definido'}</span>
                    <span class="vendor-email">${seller.email || 'Email não definido'}</span>
                </div>
                <div class="actions">
                    <button class="action-btn delete-btn" data-id="${sellerId}" data-name="${seller.name}">
                        <i class="fas fa-trash"></i> Remover
                    </button>
                </div>
            `;
            listContainer.appendChild(item);
        });

        // Adiciona listeners aos botões
        listContainer.querySelectorAll('.delete-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                handleDeleteSeller(btn.dataset.id, btn.dataset.name);
            });
        });

    } catch (error) {
        console.error("Erro ao carregar vendedores:", error);
        listContainer.innerHTML = '<p>Erro ao carregar lista.</p>';
    }
}

/**
 * Configura listeners dos modais de admin
 */
function setupModalListeners() {
    // Botão "Adicionar Novo Vendedor"
    document.getElementById('show-add-seller-modal-btn').addEventListener('click', () => {
        document.getElementById('add-seller-form').reset();
        showAdminFeedback('', false); // Limpa feedback
        showModal('add-seller-modal');
    });

    // Submit do formulário
    document.getElementById('add-seller-form').addEventListener('submit', handleAddSeller);
}

/**
 * Chama a Cloud Function 'createSeller'
 */
async function handleAddSeller(e) {
    e.preventDefault();
    showLoading();
    showAdminFeedback('Criando vendedor...', false);

    const formData = {
        name: document.getElementById('seller-name').value,
        whatsapp: document.getElementById('seller-whatsapp').value,
        email: document.getElementById('seller-email').value,
        password: document.getElementById('seller-password').value
    };

    try {
        // Chama a Cloud Function 'createSeller'
        const createSellerFunction = httpsCallable(functions, 'createSeller');
        const result = await createSellerFunction(formData);

        if (result.data.success) {
            showToast('Vendedor criado com sucesso!', 'success');
            hideModal('add-seller-modal');
            loadSellers(); // Recarrega a lista
        } else {
            throw new Error(result.data.message || 'Erro desconhecido');
        }

    } catch (error) {
        console.error("Erro ao criar vendedor:", error);
        showAdminFeedback(`Erro: ${error.message}`, true);
    } finally {
        hideLoading();
    }
}

/**
 * Mostra uma mensagem de feedback dentro do modal de adicionar vendedor
 */
function showAdminFeedback(message, isError = false) {
    const feedbackDiv = document.getElementById('add-seller-feedback');
    feedbackDiv.textContent = message;
    feedbackDiv.style.color = isError ? '#dc3545' : '#25D366';
}

/**
 * Abre o modal de confirmação para deletar um vendedor
 */
function handleDeleteSeller(sellerId, sellerName) {
    // Define a mensagem
    document.getElementById('confirm-title').textContent = 'Remover Vendedor';
    document.getElementById('confirm-message').textContent = `Você tem certeza que deseja remover "${sellerName}"? Esta ação é permanente e deletará o usuário e sua conta.`;
    
    // Armazena a ação
    confirmAction = () => confirmDelete(sellerId);
    
    // Mostra o modal
    showModal('confirm-modal');
}

/**
 * Chama a Cloud Function 'deleteSeller'
 */
async function confirmDelete(sellerId) {
    hideModal('confirm-modal');
    showLoading();

    try {
        // Chama a Cloud Function 'deleteSeller'
        const deleteSellerFunction = httpsCallable(functions, 'deleteSeller');
        const result = await deleteSellerFunction({ uid: sellerId });

        if (result.data.success) {
            showToast('Vendedor removido com sucesso!', 'success');
            loadSellers(); // Recarrega a lista
        } else {
            throw new Error(result.data.message || 'Erro desconhecido');
        }

    } catch (error) {
        console.error("Erro ao remover vendedor:", error);
        showToast(`Erro: ${error.message}`, 'error');
    } finally {
        hideLoading();
    }
}

/**
 * Configura os botões do modal de confirmação
 */
function setupConfirmationModal() {
    document.getElementById('confirm-yes-btn').addEventListener('click', () => {
        if (typeof confirmAction === 'function') {
            confirmAction();
        }
        confirmAction = null; // Limpa a ação
    });

    document.getElementById('confirm-no-btn').addEventListener('click', () => {
        confirmAction = null; // Limpa a ação
        hideModal('confirm-modal');
    });
}
