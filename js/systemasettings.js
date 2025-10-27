// js/systemasettings.js
import { showToast, showLoading, hideLoading } from './ui.js'; // Removido showModal, hideModal
import { getAuth } from "https://www.gstatic.com/firebasejs/9.6.7/firebase-auth.js"; // Removido sendPasswordResetEmail daqui
import { getFirestore, doc, updateDoc, getDoc } from "https://www.gstatic.com/firebasejs/9.6.7/firebase-firestore.js";
// NOVO: Importa função de reset de senha
import { sendPasswordResetEmail } from "https://www.gstatic.com/firebasejs/9.6.7/firebase-auth.js";


let auth;
let db;
let currentUserData = null; // Guarda dados do usuário atual ao carregar a página

// Elementos da Página de Perfil
let profileFormElement = null;
let nameInput = null;
let phoneInput = null;
let profileFeedbackDiv = null;

// Elementos da Página de Segurança
let resetPasswordBtn = null;
let securityFeedbackDiv = null;

export function init(dependencies) {
    auth = dependencies.auth; // Recebe auth de app.js
    db = dependencies.db;     // Recebe db de app.js

    // Não adiciona listeners aqui diretamente, pois os elementos
    // podem não estar visíveis no DOM ainda. As funções chamadas
    // pelo router cuidarão disso.
}

/**
 * [EXPORTADO] Chamado pelo router quando a página /settings/profile é exibida.
 * Busca dados do usuário e configura o formulário de perfil.
 */
export async function loadProfileData() {
    // Pega referências aos elementos DO PERFIL (só quando a página carrega)
    profileFormElement = document.getElementById('user-settings-form');
    nameInput = document.getElementById('user-settings-name');
    phoneInput = document.getElementById('user-settings-phone');
    profileFeedbackDiv = document.getElementById('user-settings-feedback');

    if (!profileFormElement || !nameInput || !phoneInput) {
        console.warn("Elementos do formulário de perfil não encontrados.");
        return;
    }

    // Adiciona listener de submit ao formulário de perfil
    profileFormElement.removeEventListener('submit', handleSettingsUpdate); // Remove listener antigo se houver
    profileFormElement.addEventListener('submit', handleSettingsUpdate);

    // Pega o usuário logado
    const user = auth.currentUser;
    if (!user) {
        showToast("Faça login para ver suas configurações.", "error");
        // Opcional: redirecionar para login ou home
        // navigate('/');
        return;
    }

    // Guarda dados atuais
    currentUserData = user;

    // Busca dados do Firestore para preencher
    showLoading(); // Mostra loading enquanto busca
    try {
        const userRef = doc(db, "users", user.uid);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) {
            const firestoreData = userSnap.data();
            nameInput.value = firestoreData.name || user.displayName || '';
            phoneInput.value = firestoreData.phone || firestoreData.whatsapp || '';
            // Atualiza currentUserData com dados mais recentes do Firestore
            currentUserData = { ...user, ...firestoreData };
        } else {
            nameInput.value = user.displayName || '';
            phoneInput.value = '';
            console.warn("Documento Firestore não encontrado para preencher configurações.");
        }
        // Limpa feedback
        if (profileFeedbackDiv) {
            profileFeedbackDiv.textContent = '';
            profileFeedbackDiv.style.color = 'initial';
        }
    } catch (error) {
        console.error("Erro ao buscar dados para a página de perfil:", error);
        showToast("Erro ao carregar suas informações.", "error");
    } finally {
        hideLoading();
    }
}


/**
 * [EXPORTADO] Chamado pelo router quando a página /settings/security é exibida.
 * Configura o botão de reset de senha.
 */
export function setupSecurityPage() {
    // Pega referências aos elementos DE SEGURANÇA
    resetPasswordBtn = document.getElementById('reset-password-btn');
    securityFeedbackDiv = document.getElementById('user-security-feedback'); // Novo ID para feedback

    if (resetPasswordBtn) {
         resetPasswordBtn.removeEventListener('click', handlePasswordReset); // Remove listener antigo
         resetPasswordBtn.addEventListener('click', handlePasswordReset);
    } else {
        console.warn("Botão de redefinir senha não encontrado na página de segurança.");
    }

    // Limpa feedback ao carregar a página
    if (securityFeedbackDiv) {
        securityFeedbackDiv.textContent = '';
        securityFeedbackDiv.style.color = 'initial';
    }
}


// --- Funções de Lógica (handleSettingsUpdate, handlePasswordReset - adaptadas) ---

// Função para lidar com a atualização de nome e telefone (semelhante, mas usa profileFeedbackDiv)
async function handleSettingsUpdate(e) {
    e.preventDefault();
    const user = auth.currentUser; // Pega o usuário atual do Auth
    if (!user) return showToast("Sessão expirada. Faça login novamente.", "error");

    const newName = nameInput.value.trim();
    const newPhone = phoneInput.value.trim();

    if (!newName || !newPhone) {
        showSettingsFeedback(profileFeedbackDiv, "Nome e Telefone são obrigatórios.", true);
        return;
    }

    showLoading();
    showSettingsFeedback(profileFeedbackDiv, "Salvando alterações...", false);

    try {
        const userRef = doc(db, "users", user.uid);
        await updateDoc(userRef, {
            name: newName,
            phone: newPhone
        });

        showToast("Informações atualizadas com sucesso!", "success");
        // Não precisa fechar modal
        showSettingsFeedback(profileFeedbackDiv, "Salvo com sucesso!", false);
        // Dispara evento para atualizar UI (ex: nome no painel lateral)
        document.dispatchEvent(new CustomEvent('userDataUpdated'));

    } catch (error) {
        console.error("Erro ao atualizar informações:", error);
        showSettingsFeedback(profileFeedbackDiv, "Erro ao salvar. Tente novamente.", true);
    } finally {
        hideLoading();
    }
}

// Função para lidar com o pedido de redefinição de senha (semelhante, mas usa securityFeedbackDiv)
async function handlePasswordReset() {
    const user = auth.currentUser;
    if (!user || !user.email) {
        showToast("Usuário não encontrado ou sem e-mail associado.", "error");
        return;
    }

    showLoading();
    showSettingsFeedback(securityFeedbackDiv, "Enviando e-mail de redefinição...", false);

    try {
        await sendPasswordResetEmail(auth, user.email);
        showToast(`E-mail de redefinição enviado para ${user.email}. Verifique sua caixa de entrada e spam.`, "success");
        showSettingsFeedback(securityFeedbackDiv, `E-mail enviado para ${user.email}.`, false);

    } catch (error) {
        console.error("Erro ao enviar e-mail de redefinição:", error);
        let msg = "Erro ao enviar e-mail.";
        showSettingsFeedback(securityFeedbackDiv, msg, true);
    } finally {
        hideLoading();
    }
}

// Função auxiliar para mostrar feedback (agora recebe o elemento de feedback como parâmetro)
function showSettingsFeedback(feedbackElement, message, isError = false) {
    if (!feedbackElement) return;
    feedbackElement.textContent = message;
    feedbackElement.style.color = isError ? '#dc3545' : '#25D366'; // Vermelho ou Verde
}
