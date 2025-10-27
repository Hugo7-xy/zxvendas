// js/systemamenu.js
import { showModal, hideModal, showToast, showLoading, hideLoading } from './ui.js'; // Adicionado showLoading, hideLoading
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
    setupEventHandlers();
    setupNavigation();
    setupSidePanel();

    // Listener para quando os dados do usuário forem atualizados (continua útil)
    document.addEventListener('userDataUpdated', handleUserDataUpdate);
}

/**
 * Monitora o estado da autenticação (login/logout)
 */
function setupAuthListener() {
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            // Usuário está logado (código existente)
            console.log("Usuário logado:", user.uid);
            try {
                const userData = await fetchUserData(user.uid);
                currentUser = { ...user, ...userData };
                updateUI(currentUser);
            } catch (error) {
                console.error("Erro ao buscar dados do usuário no AuthListener:", error);
                currentUser = user;
                updateUI(currentUser);
            }
        } else {
            // Usuário está deslogado
            console.log("Usuário deslogado (detectado por onAuthStateChanged)."); // Log para depuração
            currentUser = null;
            updateUI(null); // <- ESSENCIAL PARA ATUALIZAR A UI
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
            return { role: 'cliente', name: null, phone: null };
        }
    } catch (error) {
        console.error("Erro ao buscar dados do usuário no Firestore:", error);
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

    const userIconPlaceholder = document.getElementById('user-icon-placeholder');
    const userProfileImg = document.getElementById('user-profile-img');

    if (user) {
        // Logado
        if (loggedOutView) loggedOutView.classList.add('hidden');
        if (loggedInView) {
             loggedInView.classList.remove('hidden');
             const displayNameEl = document.getElementById('user-display-name');
             if (displayNameEl) displayNameEl.textContent = user.name || user.displayName || user.email;
        }

        const dashboardBtn = document.getElementById('go-to-dashboard-btn');
        if (dashboardBtn) {
            if (user.role === 'vendedor' || user.role === 'admin') {
                dashboardBtn.classList.remove('hidden');
            } else {
                dashboardBtn.classList.add('hidden');
            }
        }

        if (userIconPlaceholder && userProfileImg) {
            const photoURL = user.profileImageUrl || user.photoURL;
            if (photoURL) {
                userProfileImg.src = photoURL;
                userProfileImg.classList.remove('hidden');
                userIconPlaceholder.classList.add('hidden');
            } else {
                userProfileImg.src = '';
                userProfileImg.classList.add('hidden');
                userIconPlaceholder.classList.remove('hidden');
            }
        }

    } else {
        // Deslogado
        if (loggedOutView) loggedOutView.classList.remove('hidden');
        if (loggedInView) loggedInView.classList.add('hidden');
        const dashboardBtn = document.getElementById('go-to-dashboard-btn');
        if (dashboardBtn) dashboardBtn.classList.add('hidden');

        if (userIconPlaceholder && userProfileImg) {
            userProfileImg.classList.add('hidden');
            userProfileImg.src = '';
            userIconPlaceholder.classList.remove('hidden');
        }
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
    if (logoutBtn) {
         console.log("Adicionando listener ao botão Sair"); // Log para depuração
         logoutBtn.addEventListener('click', handleLogout);
    } else {
         console.error("Botão Sair (logout-btn-panel) não encontrado!");
    }


    // Botão "Acessar Painel" (vendedor/admin)
    const dashboardBtn = document.getElementById('go-to-dashboard-btn');
    if (dashboardBtn) {
        dashboardBtn.addEventListener('click', (e) => {
            e.preventDefault();
            showModal('seller-dashboard-modal');
            const userPanel = document.getElementById('user-side-panel');
            const panelOverlay = document.getElementById('panel-overlay');
            if (userPanel) userPanel.classList.remove('is-open');
            if (panelOverlay) panelOverlay.classList.add('hidden');
        });
    }

    // Link "Criar conta"
    const registerLink = document.querySelector('[data-modal-target="register-modal"]');
    if (registerLink) {
        registerLink.addEventListener('click', (e) => {
            e.preventDefault();
            showModal('register-modal');
             const userPanel = document.getElementById('user-side-panel');
             const panelOverlay = document.getElementById('panel-overlay');
             if (userPanel) userPanel.classList.remove('is-open');
             if (panelOverlay) panelOverlay.classList.add('hidden');
        });
    }

    // Botão "Configurações"
    const openSettingsBtn = document.getElementById('open-settings-btn');
    if (openSettingsBtn) {
        openSettingsBtn.addEventListener('click', (e) => {
            e.preventDefault();
             if (currentUser) {
                 navigate('/settings/profile');
                 const userPanel = document.getElementById('user-side-panel');
                 const panelOverlay = document.getElementById('panel-overlay');
                 if (userPanel) userPanel.classList.remove('is-open');
                 if (panelOverlay) panelOverlay.classList.add('hidden');
             } else {
                 showToast("Faça login para acessar as configurações.", "error");
             }
        });
    }

    // Links internos da página de settings
    document.body.addEventListener('click', (e) => {
        const settingsLink = e.target.closest('.settings-nav-link');
        if (settingsLink) {
            e.preventDefault();
            const targetPath = settingsLink.getAttribute('href');
            if (targetPath) {
                navigate(targetPath);
            }
        }
    });
}


// --- Funções de Autenticação ---

async function handleGoogleLogin() {
    showLoading();
    try {
        const result = await signInWithPopup(auth, googleProvider);
        showToast('Login com Google bem-sucedido!', 'success');
        const userPanel = document.getElementById('user-side-panel');
        const panelOverlay = document.getElementById('panel-overlay');
        if (userPanel) userPanel.classList.remove('is-open');
        if (panelOverlay) panelOverlay.classList.add('hidden');
    } catch (error) {
        console.error("Erro no login com Google:", error);
        let msg = `Erro: ${error.message}`;
        if (error.code === 'auth/popup-closed-by-user') { msg = 'Login cancelado.'; }
        else if (error.code === 'auth/cancelled-popup-request') { msg = 'Múltiplas tentativas de login. Tente novamente.'; }
        showToast(msg, 'error');
    } finally {
        hideLoading();
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

    showLoading();
    try {
        await signInWithEmailAndPassword(auth, email, password);
        showToast('Login bem-sucedido!', 'success');
        if(e.target) e.target.reset();
        const userPanel = document.getElementById('user-side-panel');
        const panelOverlay = document.getElementById('panel-overlay');
        if (userPanel) userPanel.classList.remove('is-open');
        if (panelOverlay) panelOverlay.classList.add('hidden');
    } catch (error) {
        console.error("Erro no login com e-mail:", error);
        let msg = 'Erro ao tentar entrar.';
        if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') { msg = 'E-mail ou senha inválidos.'; }
        else if (error.code === 'auth/too-many-requests') { msg = 'Muitas tentativas de login. Tente novamente mais tarde.'; }
        showToast(msg, 'error');
    } finally {
        hideLoading();
    }
}

async function handleLogout(e) {
    console.log("handleLogout chamado!"); // Log para depuração
    e.preventDefault();
    showLoading(); // Mostra loading
    try {
        await signOut(auth);
        // O onAuthStateChanged DEVE cuidar de chamar updateUI(null).
        console.log("signOut executado com sucesso."); // Log para depuração
        showToast('Você saiu da sua conta.', 'info');
        navigate('/'); // Redireciona para a página inicial após logout

        // Garante que o painel feche após o logout
        const userPanel = document.getElementById('user-side-panel');
        const panelOverlay = document.getElementById('panel-overlay');
        if (userPanel) userPanel.classList.remove('is-open');
        if (panelOverlay) panelOverlay.classList.add('hidden');

    } catch (error) {
        console.error("Erro ao executar signOut:", error); // Log do erro específico
        showToast('Erro ao tentar sair.', 'error');
    } finally {
        hideLoading(); // Garante que o loading seja escondido SEMPRE
        console.log("handleLogout finalizado."); // Log para depuração
    }
}


// --- Funções de Navegação e UI ---

function setupNavigation() {
    const navLinks = document.querySelectorAll('.nav-link');
    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const targetPath = link.getAttribute('href');
            if (targetPath) { navigate(targetPath); }
        });
    });
}

export function setActiveLink(path) {
    const navLinks = document.querySelectorAll('.nav-link');
    navLinks.forEach(link => {
        const linkPath = link.getAttribute('href');
        if (!path) {
            link.classList.remove('active');
        } else if (linkPath === path || (path.startsWith('/vendedores/') && linkPath === '/vendedores')) {
            link.classList.add('active');
        } else {
            link.classList.remove('active');
        }
    });
}

function setupSidePanel() {
    // A lógica de abrir/fechar está em ui.js
}
