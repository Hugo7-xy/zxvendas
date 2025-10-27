// js/systemasettings.js
import { showToast, showLoading, hideLoading } from './ui.js';
import { getAuth } from "https://www.gstatic.com/firebasejs/9.6.7/firebase-auth.js";
import { getFirestore, doc, updateDoc, getDoc } from "https://www.gstatic.com/firebasejs/9.6.7/firebase-firestore.js";
import { sendPasswordResetEmail } from "https://www.gstatic.com/firebasejs/9.6.7/firebase-auth.js";

let auth;
let db;
let currentUserDataForPage = null; // Renomeado para clareza, guarda dados usados na PÁGINA

// Elementos da Página de Perfil
let profileFormElement = null;
let nameInput = null;
let phoneInput = null;
let profileFeedbackDiv = null;

// Elementos da Página de Segurança
let resetPasswordBtn = null;
let securityFeedbackDiv = null;

export function init(dependencies) {
    auth = dependencies.auth;
    db = dependencies.db;
    console.log("systemasettings.js: init chamado."); // Log de inicialização
}

/**
 * [EXPORTADO] Chamado pelo router quando a página /settings/profile é exibida.
 * Busca dados do usuário e configura o formulário de perfil.
 */
export async function loadProfileData() {
    console.log("loadProfileData iniciado."); // Log 1

    profileFormElement = document.getElementById('user-settings-form');
    nameInput = document.getElementById('user-settings-name');
    phoneInput = document.getElementById('user-settings-phone');
    profileFeedbackDiv = document.getElementById('user-settings-feedback');

    // Verifica se os elementos essenciais existem
    if (!profileFormElement || !nameInput || !phoneInput) {
        console.error("Erro Crítico: Elementos do formulário de perfil NÃO encontrados (#user-settings-form, #user-settings-name, #user-settings-phone). Verifique os IDs no HTML."); // Log 2
        return;
    } else {
        console.log("Elementos do formulário encontrados:", { nameInput, phoneInput }); // Log 3
    }

    // Garante que o listener de submit seja adicionado apenas uma vez
    profileFormElement.removeEventListener('submit', handleSettingsUpdate);
    profileFormElement.addEventListener('submit', handleSettingsUpdate);

    // --- VERIFICAÇÃO REFORÇADA ---
    if (!auth) {
        console.error("loadProfileData: ERRO FATAL - O serviço 'auth' do Firebase não está inicializado neste módulo!");
        showToast("Erro interno de configuração. Tente recarregar.", "error");
        return; // Não podemos prosseguir sem 'auth'
    }
    console.log("loadProfileData: Objeto 'auth' verificado."); // Novo Log de verificação

    const user = auth.currentUser;
    console.log("loadProfileData: auth.currentUser obtido:", user); // Log para ver o que foi retornado

    if (!user) {
        console.warn("loadProfileData: Usuário não está logado (auth.currentUser é null/undefined)."); // Log 4
        showToast("Faça login para ver suas configurações.", "error");
        // Idealmente, redirecionar para login ou home aqui
        // import { navigate } from './router.js'; navigate('/');
        return;
    } else {
         console.log("loadProfileData: Usuário logado:", user.uid); // Log 5
    }

    // Reseta os campos antes de buscar, caso o usuário navegue de volta
    nameInput.value = '';
    phoneInput.value = '';
    if (profileFeedbackDiv) profileFeedbackDiv.textContent = '';


    showLoading();
    try {
        const userRef = doc(db, "users", user.uid);
        console.log("Buscando documento Firestore:", userRef.path); // Log 6
        const userSnap = await getDoc(userRef);

        if (userSnap.exists()) {
            const firestoreData = userSnap.data();
            console.log("Dados do Firestore encontrados:", firestoreData); // Log 7: MUITO IMPORTANTE verificar este log!

            // ---- PONTO CRÍTICO ----
            // Verifica EXATAMENTE os nomes dos campos no seu Firestore (case-sensitive!)
            const nameFromDb = firestoreData.name || user.displayName || '';
            const phoneFromDb = firestoreData.phone || firestoreData.whatsapp || ''; // Tenta 'phone', depois 'whatsapp'

            console.log("Valor a ser definido para NOME:", `"${nameFromDb}"`);     // Log 8
            console.log("Valor a ser definido para TELEFONE:", `"${phoneFromDb}"`); // Log 9

            // Atribui os valores aos inputs
            nameInput.value = nameFromDb;
            phoneInput.value = phoneFromDb;
            // ---- FIM PONTO CRÍTICO ----

            // Guarda os dados carregados para uso no submit
            currentUserDataForPage = { uid: user.uid, email: user.email, ...firestoreData };
            console.log("Valores definidos nos inputs. Verifique a tela."); // Log 10

        } else {
            console.warn("Documento Firestore NÃO encontrado para o usuário:", user.uid); // Log 11
            // Se não tem doc, usa dados do Auth se disponíveis e guarda
            nameInput.value = user.displayName || '';
            phoneInput.value = ''; // Phone não vem do Auth
             currentUserDataForPage = { uid: user.uid, email: user.email, name: user.displayName || '', phone: '' }; // Guarda dados básicos
        }

        // Limpa feedback anterior (redundante, mas seguro)
        if (profileFeedbackDiv) {
            profileFeedbackDiv.textContent = '';
            profileFeedbackDiv.style.color = 'initial';
        }
    } catch (error) {
        console.error("Erro GERAL ao buscar/preencher dados do perfil:", error); // Log 12
        showToast("Erro ao carregar suas informações. Verifique o console.", "error");
         // Limpa inputs em caso de erro para não mostrar dados inconsistentes
         nameInput.value = '';
         phoneInput.value = '';
    } finally {
        hideLoading();
        console.log("loadProfileData finalizado."); // Log 13
    }
}

/**
 * [EXPORTADO] Chamado pelo router quando a página /settings/security é exibida.
 * Configura o botão de reset de senha.
 */
export function setupSecurityPage() {
    console.log("setupSecurityPage iniciado."); // Log

    resetPasswordBtn = document.getElementById('reset-password-btn');
    securityFeedbackDiv = document.getElementById('user-security-feedback');

    if (resetPasswordBtn) {
         resetPasswordBtn.removeEventListener('click', handlePasswordReset);
         resetPasswordBtn.addEventListener('click', handlePasswordReset);
         console.log("Listener adicionado ao botão de reset de senha."); // Log
    } else {
        console.warn("Botão de redefinir senha (#reset-password-btn) não encontrado na página de segurança."); // Log
    }

    if (securityFeedbackDiv) {
        securityFeedbackDiv.textContent = '';
        securityFeedbackDiv.style.color = 'initial';
    }
}


// --- Funções de Lógica (handleSettingsUpdate, handlePasswordReset) ---

async function handleSettingsUpdate(e) {
    e.preventDefault();
    console.log("handleSettingsUpdate chamado. auth.currentUser:", auth.currentUser, "currentUserDataForPage:", currentUserDataForPage);
    // Usa currentUserDataForPage que foi definido em loadProfileData
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
        const userRef = doc(db, "users", currentUserDataForPage.uid);
        // Atualiza apenas os campos relevantes no Firestore
        await updateDoc(userRef, {
            name: newName,
            phone: newPhone // Certifique-se que o campo no Firestore é 'phone'
            // Se o campo for 'whatsapp', use: whatsapp: newPhone
        });

        showToast("Informações atualizadas com sucesso!", "success");
        showSettingsFeedback(profileFeedbackDiv, "Salvo com sucesso!", false);

        // Atualiza os dados locais para refletir a mudança
        currentUserDataForPage.name = newName;
        currentUserDataForPage.phone = newPhone; // ou .whatsapp = newPhone

        // Dispara evento para atualizar UI (ex: nome no painel lateral em systemamenu.js)
        document.dispatchEvent(new CustomEvent('userDataUpdated'));

    } catch (error) {
        console.error("Erro ao atualizar informações:", error);
        showSettingsFeedback(profileFeedbackDiv, "Erro ao salvar. Tente novamente.", true);
    } finally {
        hideLoading();
    }
}

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
        // Adicionar tratamentos específicos de erro se necessário
        showSettingsFeedback(securityFeedbackDiv, msg, true);
    } finally {
        hideLoading();
    }
}

// Função auxiliar para mostrar feedback (recebe o elemento de feedback)
function showSettingsFeedback(feedbackElement, message, isError = false) {
    if (!feedbackElement) {
        console.warn("Elemento de feedback não encontrado para a mensagem:", message);
        return;
    }
    feedbackElement.textContent = message;
    feedbackElement.style.color = isError ? '#dc3545' : '#25D366'; // Vermelho ou Verde
}
