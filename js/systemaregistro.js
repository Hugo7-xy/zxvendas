// js/systemaregistro.js
import { showModal, hideModal, showToast, showLoading, hideLoading } from './ui.js';
import { httpsCallable } from "https://www.gstatic.com/firebasejs/9.6.7/firebase-functions.js";
import { signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/9.6.7/firebase-auth.js";

let functions, auth;
let feedbackDiv = null; // Para mostrar mensagens de erro/sucesso no modal

export function init(dependencies) {
    functions = dependencies.functions;
    auth = dependencies.auth;

    setupModalListeners();
}

function setupModalListeners() {
    const form = document.getElementById('register-form');
    if (!form) return;
    
    // Cria um div para feedback se não existir (apenas por garantia)
    feedbackDiv = document.createElement('div');
    feedbackDiv.style.marginTop = '1rem';
    form.appendChild(feedbackDiv);

    // Listener para o submit do formulário
    form.addEventListener('submit', handleRegisterSubmit);

    // Listener para abrir o modal de Termos
    const termsLink = document.querySelector('[data-modal-target="terms-modal"]');
    if (termsLink) {
        termsLink.addEventListener('click', (e) => {
            e.preventDefault();
            // Mostra o modal de termos por cima do modal de registro
            showModal('terms-modal');
        });
    }
}

/**
 * Mostra feedback dentro do modal de registro
 */
function showRegisterFeedback(message, isError = false) {
    if (!feedbackDiv) return;
    feedbackDiv.textContent = message;
    feedbackDiv.style.color = isError ? '#dc3545' : '#25D366'; // Vermelho ou Verde
}

/**
 * Manipula o SUBMIT do form de Registro
 */
async function handleRegisterSubmit(e) {
    e.preventDefault();
    showLoading();
    showRegisterFeedback('Criando sua conta...', false);

    // 1. Coletar dados do formulário
    const formData = {
        name: document.getElementById('register-name').value,
        email: document.getElementById('register-email').value,
        password: document.getElementById('register-password').value,
        phone: document.getElementById('register-phone').value
    };
    const termsChecked = document.getElementById('register-terms').checked;

    // 2. Validação
    try {
        if (!formData.name || !formData.email || !formData.password || !formData.phone) {
            throw new Error('Todos os campos são obrigatórios.');
        }
        if (formData.password.length < 6) {
            throw new Error('A senha deve ter no mínimo 6 caracteres.');
        }
        if (!termsChecked) {
            throw new Error('Você deve aceitar os Termos de Uso.');
        }

        // 3. Chamar a Cloud Function 'createClientUser'
        const createClientUserFunction = httpsCallable(functions, 'createClientUser');
        const result = await createClientUserFunction(formData);

        if (result.data.success) {
            // 4. Sucesso!
            showToast('Conta criada com sucesso!', 'success');
            hideModal('register-modal');
            
            // 5. Opcional: Fazer login automático do usuário
            // O onAuthStateChanged (no systemamenu.js) vai pegar
            // e atualizar a UI.
            await signInWithEmailAndPassword(auth, formData.email, formData.password);
            
        } else {
            // Erro vindo da Cloud Function
            throw new Error(result.data.message || 'Erro ao criar conta.');
        }

    } catch (error) {
        console.error("Erro no registro:", error);
        let msg = error.message;
        if (msg.includes('auth/email-already-in-use')) {
            msg = 'Este e-mail já está em uso.';
        }
        showRegisterFeedback(msg, true);
    } finally {
        hideLoading();
    }
}
