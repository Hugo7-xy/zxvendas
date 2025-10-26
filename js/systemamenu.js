// js/systemamenu.js
import { showModal, hideModal, showToast } from './ui.js';
import { onAuthStateChanged, signInWithPopup, signInWithEmailAndPassword, signOut } from "https://www.gstatic.com/firebasejs/9.6.7/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/9.6.7/firebase-firestore.js";
import { navigate } from './router.js'; // Importa a função de navegação do roteador

// Variáveis locais para armazenar os serviços do Firebase
let auth, db, googleProvider;
let currentUser = null; // Armazena o usuário logado e seus dados

// Função de inicialização, chamada pelo app.js
export function init(dependencies) {
    auth = dependencies.auth;
    db = dependencies.db;
    googleProvider = dependencies.googleProvider;

    setupAuthListener();
    setupEventHandlers();
    setupNavigation(); // Modificada para usar o roteador
    setupSidePanel();
}

/**
 * Monitora o estado da autenticação (login/logout)
 */
function setupAuthListener() {
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            // Usuário está logado
            console.log("Usuário logado:", user.uid);
            const userData = await fetchUserData(user.uid);
            currentUser = { ...user, ...userData }; // Combina dados do Auth e Firestore
            updateUI(currentUser);
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
            console.warn("Documento do usuário não encontrado no Firestore.");
            // Verifica se é um login novo via Google/outro provider sem doc ainda
            // Poderia criar um doc aqui ou esperar a Cloud Function de criação
            return { role: 'cliente' }; // Assume cliente se não encontrar doc
        }
    } catch (error) {
        console.error("Erro ao buscar dados do usuário:", error);
        return { role: 'cliente' }; // Padrão em caso de erro
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

    if (user) {
        // Logado
        if (loggedOutView) loggedOutView.classList.add('hidden');
        if (loggedInView) {
             loggedInView.classList.remove('hidden');
             const displayNameEl = document.getElementById('user-display-name');
             if (displayNameEl) displayNameEl.textContent = user.displayName || user.name || user.email;
        }

        // Mostra o botão do painel se for vendedor ou admin
        const dashboardBtn = document.getElementById('go-to-dashboard-btn');
        if (dashboardBtn) {
            if (user.role === 'vendedor' || user.role === 'admin') {
                dashboardBtn.classList.remove('hidden');
            } else {
                dashboardBtn.classList.add('hidden');
            }
        }

    } else {
        // Deslogado
        if (loggedOutView) loggedOutView.classList.remove('hidden');
        if (loggedInView) loggedInView.classList.add('hidden');
        const dashboardBtn = document.getElementById('go-to-dashboard-btn');
        if (dashboardBtn) dashboardBtn.classList.add('hidden');
    }

    // Fecha o painel lateral (útil após login/logout)
    if (panel) panel.classList.remove('is-open');
    if (overlay) overlay.classList.add('hidden');
}

/**
 * Configura todos os ouvintes de eventos (cliques em botões)
 */
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

    // Botão "Acessar Painel" (abre o modal do dashboard)
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

    // Link "Criar conta" (ainda abre modal diretamente)
    const registerLink = document.querySelector('[data-modal-target="register-modal"]');
    if (registerLink) {
        registerLink.addEventListener('click', (e) => {
            e.preventDefault();
            showModal('register-modal');
        });
    }
}

// --- Funções de Autenticação ---

async function handleGoogleLogin() {
    try {
        const result = await signInWithPopup(auth, googleProvider);
        // O onAuthStateChanged cuidará de atualizar a UI e buscar/criar doc no Firestore (via CF ou lógica interna)
        showToast('Login com Google bem-sucedido!', 'success');
    } catch (error) {
        console.error("Erro no login com Google:", error);
        showToast(`Erro: ${error.message}`, 'error');
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

    try {
        await signInWithEmailAndPassword(auth, email, password);
        // O onAuthStateChanged cuidará de atualizar a UI.
        showToast('Login bem-sucedido!', 'success');
        e.target.reset(); // Limpa o formulário
    } catch (error) {
        console.error("Erro no login com e-mail:", error);
        let msg = 'Erro ao tentar entrar.';
        if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
            msg = 'E-mail ou senha inválidos.';
        }
        showToast(msg, 'error');
    }
}

async function handleLogout(e) {
    e.preventDefault();
    try {
        await signOut(auth);
        // O onAuthStateChanged cuidará de atualizar a UI.
        showToast('Você saiu da sua conta.', 'info');
        // Redireciona para a página inicial após logout
        navigate('/');
    } catch (error) {
        console.error("Erro ao sair:", error);
        showToast('Erro ao tentar sair.', 'error');
    }
}

// --- Funções de Navegação e UI ---

/**
 * [MODIFICADO] Controla a navegação principal usando o roteador
 */
function setupNavigation() {
    const navLinks = document.querySelectorAll('.nav-link');

    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault(); // Impede o carregamento da página padrão
            const targetPath = link.getAttribute('href'); // Pega o href (ex: "/vendedores")

            // Usa a função 'navigate' do router.js para mudar a URL e o conteúdo
            navigate(targetPath);
        });
    });
}

/**
 * [EXPORTADO] Exporta função para o roteador atualizar o link ativo na navegação
 * @param {string} path - O caminho da URL atual (ex: "/vendedores" ou "/")
 */
export function setActiveLink(path) {
    const navLinks = document.querySelectorAll('.nav-link');
    navLinks.forEach(link => {
        // Compara o href do link com o path atual
        // Trata o caso especial de '/vendedores/*'
        const linkPath = link.getAttribute('href');
        if (linkPath === path || (path.startsWith('/vendedores/') && linkPath === '/vendedores')) {
            link.classList.add('active');
        } else {
            link.classList.remove('active');
        }
    });
}


/**
 * Controla abertura e fechamento do painel lateral de usuário
 * (Sem mudanças na lógica interna, usa funções do ui.js)
 */
function setupSidePanel() {
    // A lógica de abrir/fechar pelos botões e overlay
    // agora está centralizada em ui.js (initUserPanelListeners)
    // Esta função pode ficar vazia ou ser removida se não fizer mais nada.
    // console.log("Listeners do painel lateral de usuário configurados em ui.js");
}
