// js/systemamenu.js
import { showModal, hideModal, showToast } from './ui.js';
import { onAuthStateChanged, signInWithPopup, signInWithEmailAndPassword, signOut } from "https://www.gstatic.com/firebasejs/9.6.7/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/9.6.7/firebase-firestore.js";
import { navigate } from './router.js'; // Importa a função de navegação do roteador
// REMOVIDO: import { openUserSettingsModal } from './systemasettings.js';

let auth, db, googleProvider;
let currentUser = null; // Armazena o usuário logado e seus dados

// Função handleUserDataUpdate (OPCIONAL, mas recomendada para atualizar nome no painel)
function handleUserDataUpdate() {
    const displayNameEl = document.getElementById('user-display-name');
    // Garante que auth.currentUser existe antes de acessar uid
    if (displayNameEl && currentUser && auth.currentUser && currentUser.uid === auth.currentUser.uid) {
        // Rebusca os dados do Firestore para garantir a atualização
        fetchUserData(currentUser.uid).then(updatedData => {
             // Atualiza currentUser local com os dados mais recentes do Auth e Firestore
             currentUser = { ...auth.currentUser, ...updatedData };
             displayNameEl.textContent = updatedData.name || currentUser.displayName || currentUser.email;
        }).catch(error => {
            console.error("Erro ao rebuscar dados do usuário após atualização:", error);
        });
    }
}


export function init(dependencies) {
    // ... (atribuições de auth, db, googleProvider)
    auth = dependencies.auth;
    db = dependencies.db;
    googleProvider = dependencies.googleProvider;

    setupAuthListener();
    setupEventHandlers(); // <- Modificaremos esta
    setupNavigation();
    setupSidePanel();

    // Listener para quando os dados do usuário forem atualizados (continua útil)
    document.addEventListener('userDataUpdated', handleUserDataUpdate); // <-- ADICIONE ESTA LINHA
}

/**
 * Monitora o estado da autenticação (login/logout)
 */
function setupAuthListener() {
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            // Usuário está logado
            console.log("Usuário logado:", user.uid);
            try {
                const userData = await fetchUserData(user.uid);
                currentUser = { ...user, ...userData }; // Combina dados do Auth e Firestore
                updateUI(currentUser);
            } catch (error) {
                console.error("Erro ao buscar dados do usuário no AuthListener:", error);
                // Mesmo com erro, tenta atualizar a UI com os dados básicos do Auth
                currentUser = user; // Guarda pelo menos os dados do Auth
                updateUI(currentUser);
            }
        } else {
            // Usuário está deslogado
            console.log("Usuário deslogado.");
            currentUser = null;
            updateUI(null);
        }
    });
}


/**
 * Busca dados adicionais do usuário (como 'role') no Firestore
 */
async function fetchUserData(uid) {
    try {
        const userRef = doc(db, "users", uid);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) {
            return userSnap.data();
        } else {
            console.warn("Documento do usuário não encontrado no Firestore:", uid);
            // Considerar criar um documento básico se for um login novo via Google
            // Por enquanto, retorna um objeto padrão
            return { role: 'cliente', name: null, phone: null }; // Retorna objeto com campos esperados como null
        }
    } catch (error) {
        console.error("Erro ao buscar dados do usuário no Firestore:", error);
        // Retorna um objeto padrão em caso de erro para evitar falhas na UI
        return { role: 'cliente', name: null, phone: null };
    }
}


/**
 * Atualiza a interface do usuário com base no estado de login
 */
function updateUI(user) {
    const loggedOutView = document.getElementById('logged-out-view');
    const loggedInView = document.getElementById('logged-in-view');
    const panel = document.getElementById('user-side-panel');
    const overlay = document.getElementById('panel-overlay');

    // --- Seletores para o botão de menu ---
    const userIconPlaceholder = document.getElementById('user-icon-placeholder');
    const userProfileImg = document.getElementById('user-profile-img');
    // --- FIM ---

    if (user) {
        // Logado
        if (loggedOutView) loggedOutView.classList.add('hidden');
        if (loggedInView) {
             loggedInView.classList.remove('hidden');
             const displayNameEl = document.getElementById('user-display-name');
             // Prioriza o nome do Firestore (user.name), depois displayName do Auth, depois email
             if (displayNameEl) displayNameEl.textContent = user.name || user.displayName || user.email;
        }

        // Mostra o botão do painel se for vendedor ou admin
        const dashboardBtn = document.getElementById('go-to-dashboard-btn');
        if (dashboardBtn) {
            // Usa user.role que vem do fetchUserData (pode ser 'cliente' se Firestore falhar)
            if (user.role === 'vendedor' || user.role === 'admin') {
                dashboardBtn.classList.remove('hidden');
            } else {
                dashboardBtn.classList.add('hidden');
            }
        }

        // --- Lógica para exibir foto ou ícone no botão de menu ---
        if (userIconPlaceholder && userProfileImg) {
            // Prioriza Firestore image URL, depois Auth URL
            const photoURL = user.profileImageUrl || user.photoURL;
            // console.log("URL da foto encontrada:", photoURL); // Log da URL (descomentar se precisar depurar)

            if (photoURL) {
                userProfileImg.src = photoURL;
                userProfileImg.classList.remove('hidden');
                userIconPlaceholder.classList.add('hidden');
            } else {
                // Se não tiver foto, mostra o ícone padrão
                userProfileImg.src = ''; // Limpa src antigo
                userProfileImg.classList.add('hidden');
                userIconPlaceholder.classList.remove('hidden');
            }
        }
        // --- FIM Lógica foto/ícone ---

    } else {
        // Deslogado
        if (loggedOutView) loggedOutView.classList.remove('hidden');
        if (loggedInView) loggedInView.classList.add('hidden');
        const dashboardBtn = document.getElementById('go-to-dashboard-btn');
        if (dashboardBtn) dashboardBtn.classList.add('hidden');

        // --- Garante que o ícone padrão seja mostrado ao deslogar ---
        if (userIconPlaceholder && userProfileImg) {
            userProfileImg.classList.add('hidden');
            userProfileImg.src = ''; // Limpa src
            userIconPlaceholder.classList.remove('hidden');
        }
        // --- FIM ---
    }


}


function setupEventHandlers() {
    // Login com Google
    const googleBtn = document.getElementById('google-login-btn');
    if (googleBtn) googleBtn.addEventListener('click', handleGoogleLogin);

    // Login com E-mail/Senha
    const emailForm = document.getElementById('panel-login-form');
    if (emailForm) emailForm.addEventListener('submit', handleEmailLogin);

    // Logout
    const logoutBtn = document.getElementById('logout-btn-panel');
    if (logoutBtn) logoutBtn.addEventListener('click', handleLogout);

    // Botão "Acessar Painel" (abre o modal do dashboard de vendedor/admin)
    const dashboardBtn = document.getElementById('go-to-dashboard-btn');
    if (dashboardBtn) {
        dashboardBtn.addEventListener('click', (e) => {
            e.preventDefault();
            showModal('seller-dashboard-modal');
            // Fecha o painel lateral
            const userPanel = document.getElementById('user-side-panel');
            const panelOverlay = document.getElementById('panel-overlay');
            if (userPanel) userPanel.classList.remove('is-open');
            if (panelOverlay) panelOverlay.classList.add('hidden');
        });
    }

    // Link "Criar conta" (abre modal de registro)
    const registerLink = document.querySelector('[data-modal-target="register-modal"]');
    if (registerLink) {
        registerLink.addEventListener('click', (e) => {
            e.preventDefault();
            showModal('register-modal');
             // Fecha o painel lateral ao abrir o modal de registro
             const userPanel = document.getElementById('user-side-panel');
             const panelOverlay = document.getElementById('panel-overlay');
             if (userPanel) userPanel.classList.remove('is-open');
             if (panelOverlay) panelOverlay.classList.add('hidden');
        });
    }

    // --- ALTERADO LISTENER PARA O BOTÃO DE CONFIGURAÇÕES ---
    const openSettingsBtn = document.getElementById('open-settings-btn');
    if (openSettingsBtn) {
        openSettingsBtn.addEventListener('click', (e) => {
            e.preventDefault();
             if (currentUser) { // Só navega se o usuário estiver logado
                 navigate('/settings/profile'); // <-- NAVEGA PARA A ROTA DE PERFIL
                 // Fecha o painel lateral
                 const userPanel = document.getElementById('user-side-panel');
                 const panelOverlay = document.getElementById('panel-overlay');
                 if (userPanel) userPanel.classList.remove('is-open');
                 if (panelOverlay) panelOverlay.classList.add('hidden');
             } else {
                 showToast("Faça login para acessar as configurações.", "error");
             }
        });
    }
    // --- FIM ALTERAÇÃO ---
    document.body.addEventListener('click', (e) => {
        // Verifica se o elemento clicado (ou um de seus pais) é um link de navegação de settings
        const settingsLink = e.target.closest('.settings-nav-link');
        if (settingsLink) {
            e.preventDefault(); // Impede a navegação padrão do link <a>
            const targetPath = settingsLink.getAttribute('href');
            if (targetPath) {
                navigate(targetPath); // Usa o roteador para navegar entre /profile e /security
            }
        }
    });
    // --- FIM NOVO ---
}


// --- Funções de Autenticação ---

async function handleGoogleLogin() {
    try {
        const result = await signInWithPopup(auth, googleProvider);
        // O onAuthStateChanged cuidará de atualizar a UI e buscar/criar doc no Firestore (via CF ou lógica interna)
        showToast('Login com Google bem-sucedido!', 'success');
        // Fecha o painel após o login
        const userPanel = document.getElementById('user-side-panel');
        const panelOverlay = document.getElementById('panel-overlay');
        if (userPanel) userPanel.classList.remove('is-open');
        if (panelOverlay) panelOverlay.classList.add('hidden');
    } catch (error) {
        console.error("Erro no login com Google:", error);
        let msg = `Erro: ${error.message}`;
        if (error.code === 'auth/popup-closed-by-user') {
            msg = 'Login cancelado.';
        } else if (error.code === 'auth/cancelled-popup-request') {
             msg = 'Múltiplas tentativas de login. Tente novamente.';
        }
        showToast(msg, 'error');
    }
}

async function handleEmailLogin(e) {
    e.preventDefault();
    const emailInput = document.getElementById('panel-login-email');
    const passwordInput = document.getElementById('panel-login-password');
    const email = emailInput ? emailInput.value : null;
    const password = passwordInput ? passwordInput.value : null;

    if (!email || !password) {
        showToast('Preencha e-mail e senha.', 'error');
        return;
    }

    showLoading(); // Mostra loading durante a tentativa
    try {
        await signInWithEmailAndPassword(auth, email, password);
        // O onAuthStateChanged cuidará de atualizar a UI.
        showToast('Login bem-sucedido!', 'success');
        if(e.target) e.target.reset(); // Limpa o formulário se e.target existir
        // Fecha o painel após o login
        const userPanel = document.getElementById('user-side-panel');
        const panelOverlay = document.getElementById('panel-overlay');
        if (userPanel) userPanel.classList.remove('is-open');
        if (panelOverlay) panelOverlay.classList.add('hidden');
    } catch (error) {
        console.error("Erro no login com e-mail:", error);
        let msg = 'Erro ao tentar entrar.';
        if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
            msg = 'E-mail ou senha inválidos.';
        } else if (error.code === 'auth/too-many-requests') {
            msg = 'Muitas tentativas de login. Tente novamente mais tarde.';
        }
        showToast(msg, 'error');
    } finally {
        hideLoading(); // Esconde loading
    }
}

async function handleLogout(e) {
    e.preventDefault();
    showLoading();
    try {
        await signOut(auth);
        // O onAuthStateChanged cuidará de atualizar a UI.
        showToast('Você saiu da sua conta.', 'info');
         // Fecha o painel após o logout
         const userPanel = document.getElementById('user-side-panel');
         const panelOverlay = document.getElementById('panel-overlay');
         if (userPanel) userPanel.classList.remove('is-open');
         if (panelOverlay) panelOverlay.classList.add('hidden');
        // Redireciona para a página inicial após logout
        navigate('/');
    } catch (error) {
        console.error("Erro ao sair:", error);
        showToast('Erro ao tentar sair.', 'error');
    } finally {
        hideLoading();
    }
}


function setupNavigation() {
    const navLinks = document.querySelectorAll('.nav-link');

    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault(); // Impede o carregamento da página padrão
            const targetPath = link.getAttribute('href'); // Pega o href (ex: "/vendedores")

            
            if (targetPath) { 
                 navigate(targetPath);
            }
        });
    });
}


export function setActiveLink(path) {
    const navLinks = document.querySelectorAll('.nav-link');
    navLinks.forEach(link => {
        const linkPath = link.getAttribute('href');
        // Se path for null (ex: página de settings), remove 'active' de todos
        if (!path) {
            link.classList.remove('active');
        }
       
        else if (linkPath === path || (path.startsWith('/vendedores/') && linkPath === '/vendedores')) {
            link.classList.add('active');
        } else {
            link.classList.remove('active');
        }
    });
}



function setupSidePanel() {
  
}
