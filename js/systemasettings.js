// js/systemasettings.js
import { showModal, hideModal, showToast, showLoading, hideLoading } from './ui.js';
import { getAuth, sendPasswordResetEmail } from "https://www.gstatic.com/firebasejs/9.6.7/firebase-auth.js";
import { getFirestore, doc, updateDoc, getDoc } from "https://www.gstatic.com/firebasejs/9.6.7/firebase-firestore.js";

let auth;
let db;
let currentUserData = null; // Para guardar os dados atuais ao abrir o modal

// Elementos do Modal (pegos uma vez no init)
let modalElement = null;
let formElement = null;
let nameInput = null;
let phoneInput = null;
let resetPasswordBtn = null;
let feedbackDiv = null;
let closeButton = null;

export function init(dependencies) {
    auth = dependencies.auth; // Recebe auth de app.js
    db = dependencies.db;     // Recebe db de app.js

    // Pega referências aos elementos do modal
    modalElement = document.getElementById('user-settings-modal');
    formElement = document.getElementById('user-settings-form');
    nameInput = document.getElementById('user-settings-name');
    phoneInput = document.getElementById('user-settings-phone');
    resetPasswordBtn = document.getElementById('reset-password-btn');
    feedbackDiv = document.getElementById('user-settings-feedback');
    closeButton = modalElement ? modalElement.querySelector('.close-btn-user-settings') : null;

    // Adiciona listeners aos elementos do modal (se existirem)
    if (formElement) {
        formElement.addEventListener('submit', handleSettingsUpdate);
    } else {
        console.warn("Formulário de configurações do usuário não encontrado.");
    }
    if (resetPasswordBtn) {
        resetPasswordBtn.addEventListener('click', handlePasswordReset);
    } else {
        console.warn("Botão de redefinir senha não encontrado.");
    }
    if (closeButton) {
        closeButton.addEventListener('click', () => hideModal('user-settings-modal'));
    }
    // O listener para abrir o modal será adicionado em systemamenu.js
}

// Função para ABRIR o modal e preencher os dados
export async function openUserSettingsModal(currentUser) {
    if (!modalElement || !nameInput || !phoneInput || !currentUser) return;

    // Guarda os dados atuais para referência
    currentUserData = currentUser;

    // Busca os dados mais recentes do Firestore para garantir que estão atualizados
    try {
        const userRef = doc(db, "users", currentUser.uid);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) {
            const firestoreData = userSnap.data();
            // Preenche o formulário
            nameInput.value = firestoreData.name || currentUser.displayName || ''; // Usa nome do Firestore ou Auth
            phoneInput.value = firestoreData.phone || firestoreData.whatsapp || ''; // Usa phone ou whatsapp do Firestore
        } else {
            // Se não tem documento Firestore (caso raro), usa dados do Auth
             nameInput.value = currentUser.displayName || '';
             phoneInput.value = ''; // Telefone geralmente não vem do Auth
             console.warn("Documento Firestore não encontrado para preencher configurações.");
        }
         // Limpa feedback anterior
         if (feedbackDiv) {
             feedbackDiv.textContent = '';
             feedbackDiv.style.color = 'initial';
         }
        showModal('user-settings-modal');
    } catch (error) {
        console.error("Erro ao buscar dados para o modal de configurações:", error);
        showToast("Erro ao carregar suas informações.", "error");
    }
}


// Função para lidar com a atualização de nome e telefone
async function handleSettingsUpdate(e) {
    e.preventDefault();
    if (!currentUserData) return; // Precisa ter os dados do usuário atual

    const newName = nameInput.value.trim();
    const newPhone = phoneInput.value.trim();

    if (!newName || !newPhone) {
        showSettingsFeedback("Nome e Telefone são obrigatórios.", true);
        return;
    }

    showLoading();
    showSettingsFeedback("Salvando alterações...", false);

    try {
        const userRef = doc(db, "users", currentUserData.uid);
        await updateDoc(userRef, {
            name: newName,
            phone: newPhone // Atualiza o campo 'phone' (ou 'whatsapp' se preferir manter esse nome)
            // Poderia atualizar o displayName no Auth também, mas requer reautenticação às vezes.
            // await updateProfile(auth.currentUser, { displayName: newName });
        });

        showToast("Informações atualizadas com sucesso!", "success");
        hideModal('user-settings-modal');
        // Opcional: Atualizar a UI principal (nome no painel) se o nome mudou.
        // Isso pode ser feito disparando um evento ou chamando uma função em systemamenu.js
        document.dispatchEvent(new CustomEvent('userDataUpdated'));


    } catch (error) {
        console.error("Erro ao atualizar informações:", error);
        showSettingsFeedback("Erro ao salvar. Tente novamente.", true);
    } finally {
        hideLoading();
    }
}

// Função para lidar com o pedido de redefinição de senha
async function handlePasswordReset() {
    const user = auth.currentUser; // Pega o usuário logado diretamente do Auth
    if (!user || !user.email) {
        showToast("Usuário não encontrado ou sem e-mail associado.", "error");
        return;
    }

    showLoading();
    showSettingsFeedback("Enviando e-mail de redefinição...", false);

    try {
        await sendPasswordResetEmail(auth, user.email);
        showToast(`E-mail de redefinição enviado para ${user.email}. Verifique sua caixa de entrada e spam.`, "success");
        // Não fecha o modal automaticamente, apenas mostra o feedback
        showSettingsFeedback(`E-mail enviado para ${user.email}.`, false);

    } catch (error) {
        console.error("Erro ao enviar e-mail de redefinição:", error);
        let msg = "Erro ao enviar e-mail.";
        // Adicionar tratamentos específicos de erro se necessário
        showSettingsFeedback(msg, true);
    } finally {
        hideLoading();
    }
}

// Função auxiliar para mostrar feedback dentro do modal de configurações
function showSettingsFeedback(message, isError = false) {
    if (!feedbackDiv) return;
    feedbackDiv.textContent = message;
    feedbackDiv.style.color = isError ? '#dc3545' : '#25D366'; // Vermelho ou Verde
}
