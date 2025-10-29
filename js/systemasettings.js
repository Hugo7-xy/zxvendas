// js/systemasettings.js
import { showToast, showLoading, hideLoading } from './ui.js';
import { auth, db } from './firebase-config.js';
// Importa 'updatePassword' e 'reauthenticateWithCredential', 'EmailAuthProvider' (para lidar com erro de login recente)
import { sendPasswordResetEmail, updatePassword, EmailAuthProvider, reauthenticateWithCredential } from "https://www.gstatic.com/firebasejs/9.6.7/firebase-auth.js";
import { doc, updateDoc, getDoc } from "https://www.gstatic.com/firebasejs/9.6.7/firebase-firestore.js";


let localDb;
let currentUserDataForPage = null;

// --- Elementos da Página de Perfil ---
let profileFormElement = null;
let nameInput = null;
let phoneInput = null;
let profileFeedbackDiv = null;

// --- Elementos da Página de Segurança ---
let resetPasswordBtn = null;
let securityFeedbackDiv = null;
// NOVOS Elementos para Update de Senha
let updatePasswordForm = null;
let newPasswordInput = null;
let confirmPasswordInput = null;
let updatePasswordFeedbackDiv = null;

// A função init ainda pode receber outras dependências se necessário
export function init(dependencies) {
    localDb = dependencies.db;
    
}

/**
 * [EXPORTADO] Chamado pelo router quando a página /settings/profile é exibida.
 * Busca dados do usuário e configura o formulário de perfil.
 */
export async function loadProfileData() {
    // ... (código existente sem alterações) ...
    

    profileFormElement = document.getElementById('user-settings-form');
    nameInput = document.getElementById('user-settings-name');
    phoneInput = document.getElementById('user-settings-phone');
    profileFeedbackDiv = document.getElementById('user-settings-feedback');

    if (!profileFormElement || !nameInput || !phoneInput) {
        console.error("Erro Crítico: Elementos do formulário de perfil NÃO encontrados...");
        return;
    } else {
        
    }

    profileFormElement.removeEventListener('submit', handleSettingsUpdate);
    profileFormElement.addEventListener('submit', handleSettingsUpdate);

    if (!auth) {
        console.error("loadProfileData: ERRO IMPREVISTO - O serviço 'auth' importado é inválido!");
        showToast("Erro crítico na configuração do Firebase.", "error");
        return;
    }
    

    const user = auth.currentUser;
   

    if (!user) {
        console.warn("loadProfileData: Usuário não está logado (auth.currentUser é null/undefined).");
        showToast("Faça login para ver suas configurações.", "error");
        return;
    } else {
         
    }

    nameInput.value = '';
    phoneInput.value = '';
    if (profileFeedbackDiv) profileFeedbackDiv.textContent = '';

    showLoading();
    try {
        const dbRef = localDb || db;
        if (!dbRef) {
            throw new Error("Referência do Firestore (db) não está disponível.");
        }
        const userRef = doc(dbRef, "users", user.uid);
        
        const userSnap = await getDoc(userRef);

        if (userSnap.exists()) {
            const firestoreData = userSnap.data();
            

            const nameFromDb = firestoreData.name || user.displayName || '';
            const phoneFromDb = firestoreData.phone || firestoreData.whatsapp || '';

           

            nameInput.value = nameFromDb;
            phoneInput.value = phoneFromDb;

            currentUserDataForPage = { uid: user.uid, email: user.email, ...firestoreData };
            

        } else {
            console.warn("Documento Firestore NÃO encontrado para o usuário:", user.uid);
            nameInput.value = user.displayName || '';
            phoneInput.value = '';
            currentUserDataForPage = { uid: user.uid, email: user.email, name: user.displayName || '', phone: '' };
        }

        if (profileFeedbackDiv) {
            profileFeedbackDiv.textContent = '';
            profileFeedbackDiv.style.color = 'initial';
        }
    } catch (error) {
        console.error("Erro GERAL ao buscar/preencher dados do perfil:", error);
        showToast("Erro ao carregar suas informações. Verifique o console.", "error");
         nameInput.value = '';
         phoneInput.value = '';
    } finally {
        hideLoading();
        
    }
}

/**
 * [EXPORTADO] Chamado pelo router quando a página /settings/security é exibida.
 * Configura os botões e formulários da página de segurança.
 */
export function setupSecurityPage() {
    

    resetPasswordBtn = document.getElementById('reset-password-btn');
    securityFeedbackDiv = document.getElementById('user-security-feedback');
    // --- Pega referências dos novos elementos ---
    updatePasswordForm = document.getElementById('update-password-form');
    newPasswordInput = document.getElementById('user-settings-new-password');
    confirmPasswordInput = document.getElementById('user-settings-confirm-password');
    updatePasswordFeedbackDiv = document.getElementById('update-password-feedback');
    // --- Fim novas referências ---

    if (!auth) {
        console.error("setupSecurityPage: Serviço 'auth' não disponível.");
        // Opcional: Desabilitar botões/forms se auth não estiver pronto
        return;
    }

    // Botão de Reset por E-mail
    if (resetPasswordBtn) {
         resetPasswordBtn.removeEventListener('click', handlePasswordReset);
         resetPasswordBtn.addEventListener('click', handlePasswordReset);
         
    } else {
        console.warn("Botão de redefinir senha (#reset-password-btn) não encontrado.");
    }

    // --- Adiciona Listener para o formulário de Alterar Senha ---
    if (updatePasswordForm && newPasswordInput && confirmPasswordInput) {
        updatePasswordForm.removeEventListener('submit', handleUpdatePasswordSubmit);
        updatePasswordForm.addEventListener('submit', handleUpdatePasswordSubmit);
        
        // Limpa campos ao configurar
        updatePasswordForm.reset();
        if(updatePasswordFeedbackDiv) updatePasswordFeedbackDiv.textContent = '';
    } else {
         console.warn("Elementos do formulário de alterar senha não encontrados (#update-password-form, #user-settings-new-password, #user-settings-confirm-password).");
    }
    // --- Fim Listener ---

    if (securityFeedbackDiv) {
        securityFeedbackDiv.textContent = '';
        securityFeedbackDiv.style.color = 'initial';
    }
    if (updatePasswordFeedbackDiv) { // Limpa feedback do outro form também
        updatePasswordFeedbackDiv.textContent = '';
        updatePasswordFeedbackDiv.style.color = 'initial';
    }
}


// --- Funções de Lógica ---

async function handleSettingsUpdate(e) {
    // ... (código existente sem alterações) ...
    e.preventDefault();
    if (!auth) {
        console.error("handleSettingsUpdate: Serviço 'auth' indisponível.");
        showToast("Erro interno. Tente recarregar.", "error");
        return;
    }
    
    if (!currentUserDataForPage || !auth.currentUser || currentUserDataForPage.uid !== auth.currentUser.uid) {
        console.error("Falha na validação da sessão!");
        showToast("Sessão inválida ou dados não carregados. Recarregue a página.", "error");
        return;
    }

    const newName = nameInput.value.trim();
    const newPhone = phoneInput.value.trim();

    if (!newName || !newPhone) {
        showSettingsFeedback(profileFeedbackDiv, "Nome e Telefone são obrigatórios.", true);
        return;
    }

    showLoading();
    showSettingsFeedback(profileFeedbackDiv, "Salvando alterações...", false);

    try {
        const dbRef = localDb || db;
        if (!dbRef) {
            throw new Error("Referência do Firestore (db) não está disponível.");
        }
        const userRef = doc(dbRef, "users", currentUserDataForPage.uid);
        await updateDoc(userRef, {
            name: newName,
            phone: newPhone
        });

        showToast("Informações atualizadas com sucesso!", "success");
        showSettingsFeedback(profileFeedbackDiv, "Salvo com sucesso!", false);

        currentUserDataForPage.name = newName;
        currentUserDataForPage.phone = newPhone;

        document.dispatchEvent(new CustomEvent('userDataUpdated'));

    } catch (error) {
        console.error("Erro ao atualizar informações:", error);
        showSettingsFeedback(profileFeedbackDiv, "Erro ao salvar. Tente novamente.", true);
    } finally {
        hideLoading();
    }
}

async function handlePasswordReset() {
    // ... (código existente sem alterações) ...
    if (!auth) {
        console.error("handlePasswordReset: Serviço 'auth' indisponível.");
        showToast("Erro interno. Tente recarregar.", "error");
        return;
    }
    const user = auth.currentUser;
    if (!user || !user.email) {
        showToast("Usuário não encontrado ou sem e-mail associado.", "error");
        return;
    }

    showLoading();
    showSettingsFeedback(securityFeedbackDiv, "Enviando e-mail de redefinição...", false); // Usa o feedback correto

    try {
        await sendPasswordResetEmail(auth, user.email);
        showToast(`E-mail de redefinição enviado para ${user.email}. Verifique sua caixa de entrada e spam.`, "success");
        showSettingsFeedback(securityFeedbackDiv, `E-mail enviado para ${user.email}.`, false); // Usa o feedback correto

    } catch (error) {
        console.error("Erro ao enviar e-mail de redefinição:", error);
        let msg = "Erro ao enviar e-mail.";
        showSettingsFeedback(securityFeedbackDiv, msg, true); // Usa o feedback correto
    } finally {
        hideLoading();
    }
}

/**
 * --- NOVA FUNÇÃO ---
 * Manipula o submit do formulário de alteração de senha
 */
async function handleUpdatePasswordSubmit(e) {
    e.preventDefault();
    if (!auth) {
        console.error("handleUpdatePasswordSubmit: Serviço 'auth' indisponível.");
        showToast("Erro interno. Tente recarregar.", "error");
        return;
    }

    const user = auth.currentUser;
    if (!user) {
        showToast("Você precisa estar logado para alterar a senha.", "error");
        return;
    }

    const newPassword = newPasswordInput.value;
    const confirmPassword = confirmPasswordInput.value;

    // Validações
    if (!newPassword || !confirmPassword) {
        showSettingsFeedback(updatePasswordFeedbackDiv, "Preencha ambos os campos de senha.", true);
        return;
    }
    if (newPassword.length < 6) {
         showSettingsFeedback(updatePasswordFeedbackDiv, "A nova senha deve ter no mínimo 6 caracteres.", true);
         return;
    }
    if (newPassword !== confirmPassword) {
        showSettingsFeedback(updatePasswordFeedbackDiv, "As senhas não coincidem.", true);
        return;
    }

    showLoading();
    showSettingsFeedback(updatePasswordFeedbackDiv, "Atualizando senha...", false);

    try {
        await updatePassword(user, newPassword);
        showToast("Senha alterada com sucesso!", "success");
        showSettingsFeedback(updatePasswordFeedbackDiv, "Senha alterada com sucesso!", false);
        updatePasswordForm.reset(); // Limpa o formulário

    } catch (error) {
        console.error("Erro ao atualizar senha:", error);
        let msg = "Erro ao atualizar senha. Tente novamente.";
        // --- Tratamento Específico para 'auth/requires-recent-login' ---
        if (error.code === 'auth/requires-recent-login') {
            msg = "Sua sessão expirou por segurança. Por favor, faça login novamente antes de tentar alterar a senha.";
            // Idealmente, você poderia:
            // 1. Deslogar o usuário: signOut(auth); navigate('/');
            // 2. Ou tentar reautenticar (mais complexo, exigiria pedir a senha atual)
            // Por simplicidade, vamos apenas avisar para relogar.
            showToast(msg, 'error'); // Mostra um toast também
        }
        // --- Fim Tratamento Específico ---
         else if (error.code === 'auth/weak-password') {
            msg = "A senha fornecida é muito fraca.";
        }
        showSettingsFeedback(updatePasswordFeedbackDiv, msg, true);
    } finally {
        hideLoading();
    }
}
// --- FIM NOVA FUNÇÃO ---


// Função auxiliar para mostrar feedback
function showSettingsFeedback(feedbackElement, message, isError = false) {
    if (!feedbackElement) {
        console.warn("Elemento de feedback não encontrado para a mensagem:", message);
        return;
    }
    feedbackElement.textContent = message;
    feedbackElement.style.color = isError ? '#dc3545' : '#25D366';
}
