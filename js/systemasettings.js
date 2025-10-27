// js/systemasettings.js
import { showToast, showLoading, hideLoading } from './ui.js';
// Importa 'auth' DIRETAMENTE do firebase-config
import { auth, db } from './firebase-config.js';
// Não precisa mais importar getAuth daqui, pois já vem do firebase-config
import { doc, updateDoc, getDoc } from "https://www.gstatic.com/firebasejs/9.6.7/firebase-firestore.js";
import { sendPasswordResetEmail } from "https://www.gstatic.com/firebasejs/9.6.7/firebase-auth.js";

// REMOVE a declaração 'let auth;' daqui. 'db' ainda pode ser útil via init se preferir.
let localDb; // Renomeado para evitar conflito se db for importado
let currentUserDataForPage = null;

// Elementos da Página de Perfil
let profileFormElement = null;
let nameInput = null;
let phoneInput = null;
let profileFeedbackDiv = null;

// Elementos da Página de Segurança
let resetPasswordBtn = null;
let securityFeedbackDiv = null;

// A função init ainda pode receber outras dependências se necessário
export function init(dependencies) {
    // Se você ainda passa 'db' via dependência, pode atribuí-lo aqui
    localDb = dependencies.db; // Atribui à variável localDb
    // Não precisa mais fazer auth = dependencies.auth;
    console.log("systemasettings.js: init chamado (db atribuído).");
}

/**
 * [EXPORTADO] Chamado pelo router quando a página /settings/profile é exibida.
 * Busca dados do usuário e configura o formulário de perfil.
 */
export async function loadProfileData() {
    console.log("loadProfileData iniciado.");

    profileFormElement = document.getElementById('user-settings-form');
    nameInput = document.getElementById('user-settings-name');
    phoneInput = document.getElementById('user-settings-phone');
    profileFeedbackDiv = document.getElementById('user-settings-feedback');

    if (!profileFormElement || !nameInput || !phoneInput) {
        console.error("Erro Crítico: Elementos do formulário de perfil NÃO encontrados...");
        return;
    } else {
        console.log("Elementos do formulário encontrados:", { nameInput, phoneInput });
    }

    profileFormElement.removeEventListener('submit', handleSettingsUpdate);
    profileFormElement.addEventListener('submit', handleSettingsUpdate);

    // A verificação agora usa o 'auth' importado diretamente
    if (!auth) {
        // Este erro agora é MUITO improvável, a menos que firebase-config falhe
        console.error("loadProfileData: ERRO IMPREVISTO - O serviço 'auth' importado é inválido!");
        showToast("Erro crítico na configuração do Firebase.", "error");
        return;
    }
    console.log("loadProfileData: Objeto 'auth' (importado) verificado.");

    const user = auth.currentUser;
    console.log("loadProfileData: auth.currentUser obtido:", user);

    if (!user) {
        console.warn("loadProfileData: Usuário não está logado (auth.currentUser é null/undefined).");
        showToast("Faça login para ver suas configurações.", "error");
        return;
    } else {
         console.log("loadProfileData: Usuário logado:", user.uid);
    }

    nameInput.value = '';
    phoneInput.value = '';
    if (profileFeedbackDiv) profileFeedbackDiv.textContent = '';

    showLoading();
    try {
        // Usa 'localDb' que foi definido em init() ou 'db' importado diretamente
        const dbRef = localDb || db; // Escolhe a referência do DB a usar
        if (!dbRef) {
            throw new Error("Referência do Firestore (db) não está disponível.");
        }
        const userRef = doc(dbRef, "users", user.uid); // Usa dbRef
        console.log("Buscando documento Firestore:", userRef.path);
        const userSnap = await getDoc(userRef);

        if (userSnap.exists()) {
            const firestoreData = userSnap.data();
            console.log("Dados do Firestore encontrados:", firestoreData);

            const nameFromDb = firestoreData.name || user.displayName || '';
            const phoneFromDb = firestoreData.phone || firestoreData.whatsapp || '';

            console.log("Valor a ser definido para NOME:", `"${nameFromDb}"`);
            console.log("Valor a ser definido para TELEFONE:", `"${phoneFromDb}"`);

            nameInput.value = nameFromDb;
            phoneInput.value = phoneFromDb;

            currentUserDataForPage = { uid: user.uid, email: user.email, ...firestoreData };
            console.log("Valores definidos nos inputs. Verifique a tela.");

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
        console.log("loadProfileData finalizado.");
    }
}

/**
 * [EXPORTADO] Chamado pelo router quando a página /settings/security é exibida.
 * Configura o botão de reset de senha.
 */
export function setupSecurityPage() {
    console.log("setupSecurityPage iniciado.");

    resetPasswordBtn = document.getElementById('reset-password-btn');
    securityFeedbackDiv = document.getElementById('user-security-feedback');

    // Verifica se 'auth' está disponível antes de adicionar o listener
    if (!auth) {
        console.error("setupSecurityPage: Serviço 'auth' não disponível para configurar botão de reset.");
        return;
    }

    if (resetPasswordBtn) {
         resetPasswordBtn.removeEventListener('click', handlePasswordReset);
         resetPasswordBtn.addEventListener('click', handlePasswordReset);
         console.log("Listener adicionado ao botão de reset de senha.");
    } else {
        console.warn("Botão de redefinir senha (#reset-password-btn) não encontrado.");
    }

    if (securityFeedbackDiv) {
        securityFeedbackDiv.textContent = '';
        securityFeedbackDiv.style.color = 'initial';
    }
}


// --- Funções de Lógica (handleSettingsUpdate, handlePasswordReset) ---

async function handleSettingsUpdate(e) {
    e.preventDefault();
     // Verifica 'auth' importado aqui também
    if (!auth) {
        console.error("handleSettingsUpdate: Serviço 'auth' indisponível.");
        showToast("Erro interno. Tente recarregar.", "error");
        return;
    }
    console.log("handleSettingsUpdate chamado. auth.currentUser:", auth.currentUser, "currentUserDataForPage:", currentUserDataForPage);
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
        // Usa 'localDb' ou 'db' importado
        const dbRef = localDb || db;
        if (!dbRef) {
            throw new Error("Referência do Firestore (db) não está disponível.");
        }
        const userRef = doc(dbRef, "users", currentUserDataForPage.uid); // Usa dbRef
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
     // Verifica 'auth' importado
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

// Função auxiliar para mostrar feedback
function showSettingsFeedback(feedbackElement, message, isError = false) {
    if (!feedbackElement) {
        console.warn("Elemento de feedback não encontrado para a mensagem:", message);
        return;
    }
    feedbackElement.textContent = message;
    feedbackElement.style.color = isError ? '#dc3545' : '#25D366';
}
