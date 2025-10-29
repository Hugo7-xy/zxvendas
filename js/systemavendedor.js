
import { showModal, hideModal, showToast, showLoading, hideLoading, showConfirmationModal } from './ui.js';
import { openItemFilterModalForSelection, clearItemSelections } from './systemafiltro.js';
import {
    collection, getDocs, doc, getDoc, addDoc, updateDoc, deleteDoc,
    query, where, serverTimestamp, orderBy
} from "https://www.gstatic.com/firebasejs/9.6.7/firebase-firestore.js";
import {
    ref, uploadBytesResumable, getDownloadURL, deleteObject // Removido refFromURL se não usado diretamente
} from "https://www.gstatic.com/firebasejs/9.6.7/firebase-storage.js";

let db, auth, storage;
let currentUser = null;
let productCache = {};
// availableTags não é mais necessário aqui
let selectedProfilePictureFile = null;
let referencesLoaded = false;

// =======================================================
// --- FUNÇÃO DE INICIALIZAÇÃO ---
// =======================================================
export function init(dependencies) {
    db = dependencies.db;
    auth = dependencies.auth;
    storage = dependencies.storage;

    auth.onAuthStateChanged(async (user) => {
        if (user) {
            const userRef = doc(db, "users", user.uid);
            const userSnap = await getDoc(userRef);
            if (userSnap.exists()) {
                currentUser = { uid: user.uid, ...userSnap.data() };
                if (currentUser.role === 'vendedor') {
                    loadVendorProducts();
                }
            } else {
                currentUser = null;
            }
        } else {
            currentUser = null;
        }
    });

    // loadAvailableTags(); // Removido
    setupTabNavigation();
    setupProductFormListeners(); // Modificada
    setupReferenceForm();
    setupSettingsForm();
}

// --- Funções de Tags Removidas ---

/**
 * Configura a navegação por abas DENTRO do painel
 */
function setupTabNavigation() {
    const menuItems = document.querySelectorAll('.dashboard-menu-item');
    const panels = document.querySelectorAll('.dashboard-panel');
    menuItems.forEach(item => {
        item.addEventListener('click', () => {
            const targetPanelId = item.getAttribute('data-target');
            menuItems.forEach(i => i.classList.remove('active')); item.classList.add('active');
            panels.forEach(panel => {
                if (panel.id === targetPanelId) { panel.classList.remove('hidden'); }
                else { panel.classList.add('hidden'); }
            });
            // Carrega referências se a aba for clicada pela 1ª vez
            if (targetPanelId === 'panel-references' && !referencesLoaded) {
                loadVendorReferences();
            }
        });
    });
}


// =======================================================
// --- SEÇÃO DE GERENCIAMENTO DE PRODUTOS (CRUD) ---
// =======================================================
/**
 * Carrega a lista de produtos do vendedor logado
 */
async function loadVendorProducts() {
    if (!currentUser) return; const listContainer = document.getElementById('vendor-product-list'); if (!listContainer) return; listContainer.innerHTML = '<p>Carregando seus produtos...</p>'; productCache = {};
    try {
        const q = query(collection(db, "produtos"), where("sellerId", "==", currentUser.uid), orderBy("createdAt", "desc"));
        const querySnapshot = await getDocs(q);
        if (querySnapshot.empty) { listContainer.innerHTML = '<p>Você ainda não adicionou nenhuma conta.</p>'; return; }
        listContainer.innerHTML = '';
        querySnapshot.forEach(doc => {
            const product = doc.data(); const productId = doc.id; productCache[productId] = product;
            const item = document.createElement('div'); item.className = 'vendor-product-item';
            item.innerHTML = `<p>${product.title} - ${product.available ? 'Disponível' : 'Vendido'}</p><div class="actions"><button class="action-btn edit-btn" data-id="${productId}"><i class="fas fa-edit"></i> Editar</button><button class="action-btn delete-btn" data-id="${productId}"><i class="fas fa-trash"></i> Excluir</button></div>`;
            listContainer.appendChild(item);
        });
        listContainer.querySelectorAll('.edit-btn').forEach(btn => btn.addEventListener('click', () => handleEditProduct(btn.dataset.id)));
        listContainer.querySelectorAll('.delete-btn').forEach(btn => btn.addEventListener('click', () => handleDeleteProduct(btn.dataset.id)));
    } catch (error) { console.error("Erro ao carregar produtos do vendedor:", error); listContainer.innerHTML = '<p style="text-align: center;">Erro ao carregar produtos.</p>'; }
}

/**
 * Atualiza a área de exibição das tags selecionadas no formulário
 */
function updateSelectedTagsDisplay(formId, selectedTags) {
    const displayId = formId === 'add-product-form' ? 'add-product-selected-tags' : 'edit-product-selected-tags';
    const displayArea = document.getElementById(displayId);
    if (!displayArea) return;

    if (selectedTags && selectedTags.length > 0) {
        displayArea.innerHTML = ''; // Limpa
        displayArea.style.fontStyle = 'normal'; // Remove itálico
        selectedTags.forEach(tag => {
            const pill = document.createElement('span');
            pill.className = 'selected-tag-pill';
            pill.textContent = tag;
            displayArea.appendChild(pill);
        });
    } else {
        displayArea.innerHTML = 'Nenhum item selecionado.';
        displayArea.style.fontStyle = 'italic';
    }
}

/**
 * Configura os listeners dos formulários e dos botões "Selecionar Itens"
 */
function setupProductFormListeners() {
    // Listener para abrir o modal de ADICIONAR produto
    const productPanel = document.getElementById('panel-products');
    if(productPanel) {
        productPanel.addEventListener('click', (e) => {
            if (e.target.closest('.add-btn')) {
                e.preventDefault();
                const addForm = document.getElementById('add-product-form');
                if(addForm) {
                     addForm.reset();
                     addForm.dataset.selectedTags = '[]'; // Limpa tags guardadas
                }
                updateSelectedTagsDisplay('add-product-form', []);
                clearItemSelections(); // Limpa seleção visual no modal de filtro
                showModal('add-product-modal');
            }
        });
    }

    // Callback genérico para atualizar o formulário após seleção no modal
    const updateFormTags = (formId) => (newTags) => {
         const form = document.getElementById(formId);
         if (form) {
             form.dataset.selectedTags = JSON.stringify(newTags);
             updateSelectedTagsDisplay(formId, newTags);
         }
    };

    // Listener para o botão "Selecionar Itens..." DENTRO do modal ADICIONAR
    const openAddItemsBtn = document.querySelector('#add-product-form .open-item-selection-modal');
    if (openAddItemsBtn) {
        openAddItemsBtn.addEventListener('click', () => {
            const currentTags = JSON.parse(document.getElementById('add-product-form').dataset.selectedTags || '[]');
            openItemFilterModalForSelection(currentTags, updateFormTags('add-product-form'));
        });
    }

     // Listener para o botão "Selecionar Itens..." DENTRO do modal EDITAR
     const openEditItemsBtn = document.querySelector('#edit-product-form .open-item-selection-modal');
     if (openEditItemsBtn) {
         openEditItemsBtn.addEventListener('click', () => {
             const currentTags = JSON.parse(document.getElementById('edit-product-form').dataset.selectedTags || '[]');
             openItemFilterModalForSelection(currentTags, updateFormTags('edit-product-form'));
         });
     }

    // Submit do form Adicionar
    const addForm = document.getElementById('add-product-form');
    if(addForm) { addForm.addEventListener('submit', handleAddProductSubmit); }

    // Submit do form Editar
    const editForm = document.getElementById('edit-product-form');
    if(editForm) { editForm.addEventListener('submit', handleEditProductSubmit); }
}

/**
 * Normaliza o preço
 */
function parsePrice(priceString) { if (!priceString) return 0; return parseFloat(priceString.replace('.', '').replace(',', '.')) || 0; }

/**
 * Gera a descrição a partir das tags
 */
function generateDescriptionFromTags(tags) { if (!tags || tags.length === 0) { return "Conta com itens variados."; } return tags.slice(0, 5).join(', '); }

/**
 * Manipula o SUBMIT do form de Adicionar Produto
 */
async function handleAddProductSubmit(e) {
    e.preventDefault(); if (!currentUser) return showToast('Você precisa estar logado.', 'error'); showLoading();
    try {
        const selectedTags = JSON.parse(e.target.dataset.selectedTags || '[]');
        const generatedDescription = generateDescriptionFromTags(selectedTags);
        const product = { title: document.getElementById('product-title').value, description: generatedDescription, price: parsePrice(document.getElementById('product-price').value), videoUrl: document.getElementById('product-video').value, tags: selectedTags, sellerId: currentUser.uid, sellerName: currentUser.name, sellerWhatsapp: currentUser.whatsapp, available: true, createdAt: serverTimestamp() };
        if (!product.title || !product.price || !product.videoUrl) { throw new Error("Título, Valor e URL do Vídeo são obrigatórios."); }
        await addDoc(collection(db, "produtos"), product);
        showToast('Produto adicionado com sucesso!', 'success'); hideModal('add-product-modal'); loadVendorProducts();
        e.target.dataset.selectedTags = '[]'; // Limpa data attribute
    } catch (error) { console.error("Erro ao adicionar produto:", error); showToast(`Erro: ${error.message}`, 'error'); } finally { hideLoading(); }
}

/**
 * Prepara e abre o modal de Edição
 */
function handleEditProduct(productId) {
    const product = productCache[productId]; if (!product) return;
    const editForm = document.getElementById('edit-product-form'); if (!editForm) return;
    editForm.querySelector('#edit-product-id').value = productId;
    editForm.querySelector('#edit-product-title').value = product.title;
    editForm.querySelector('#edit-product-price').value = (product.price || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).replace('R$', '').trim();
    editForm.querySelector('#edit-product-video').value = product.videoUrl;
    const currentTags = product.tags || [];
    editForm.dataset.selectedTags = JSON.stringify(currentTags);
    updateSelectedTagsDisplay('edit-product-form', currentTags);
    clearItemSelections(); // Limpa seleção visual no modal de filtro
    showModal('edit-product-modal');
}

/**
 * Manipula o SUBMIT do form de Editar Produto
 */
async function handleEditProductSubmit(e) {
    e.preventDefault(); showLoading(); const productId = document.getElementById('edit-product-id').value; if (!productId) return;
    try {
        const selectedTags = JSON.parse(e.target.dataset.selectedTags || '[]');
        const generatedDescription = generateDescriptionFromTags(selectedTags);
        const productUpdates = { title: document.getElementById('edit-product-title').value, description: generatedDescription, price: parsePrice(document.getElementById('edit-product-price').value), videoUrl: document.getElementById('edit-product-video').value, tags: selectedTags };
        const productRef = doc(db, "produtos", productId); await updateDoc(productRef, productUpdates);
        showToast('Produto atualizado com sucesso!', 'success'); hideModal('edit-product-modal'); loadVendorProducts();
        e.target.dataset.selectedTags = '[]'; // Limpa data attribute
    } catch (error) { console.error("Erro ao atualizar produto:", error); showToast(`Erro: ${error.message}`, 'error'); } finally { hideLoading(); }
}

/**
 * Manipula o clique no botão Deletar Produto para usar o modal
 */
function handleDeleteProduct(productId) {
    const productTitle = productCache[productId]?.title || 'este produto';
    showConfirmationModal( 'Excluir Produto', `Tem certeza que deseja excluir "${productTitle}"? Esta ação não pode ser desfeita.`, () => deleteProductFromDb(productId) );
}

/**
 * Deleta o produto do Firestore (chamada pelo modal de confirmação)
 */
async function deleteProductFromDb(productId) {
    showLoading(); try { await deleteDoc(doc(db, "produtos", productId)); showToast('Produto excluído com sucesso.', 'success'); loadVendorProducts(); }
    catch (error) { console.error("Erro ao excluir produto:", error); showToast('Erro ao excluir produto.', 'error'); } finally { hideLoading(); }
}

// =======================================================
// --- SEÇÃO DE ADICIONAR/GERENCIAR REFERÊNCIAS ---
// =======================================================
/**
 * Configura o painel de referências (upload e lista/delete)
 */
function setupReferenceForm() {
    const form = document.getElementById('add-reference-form'); if (!form) return;
    const fileInput = document.getElementById('ref-image'); const fileNameDisplay = document.getElementById('file-name-display');
    if (fileInput && fileNameDisplay) { fileInput.addEventListener('change', () => { if (fileInput.files.length > 0) { fileNameDisplay.textContent = fileInput.files[0].name; } else { fileNameDisplay.textContent = 'Nenhum arquivo selecionado'; } }); }
    form.addEventListener('submit', handleReferenceUpload);

    const listContainer = document.getElementById('vendor-references-list');
    if (listContainer) {
        listContainer.addEventListener('click', (e) => {
            if (e.target.closest('.vendor-ref-delete-btn')) {
                e.preventDefault(); const button = e.target.closest('.vendor-ref-delete-btn'); const refId = button.dataset.id; const imageUrl = button.dataset.url;
                if (refId && imageUrl) {
                    showConfirmationModal('Excluir Referência', 'Tem certeza que deseja excluir esta referência?', () => deleteReferenceFromDb(refId, imageUrl));
                }
            }
        });
    }
}

/**
 * Manipula o SUBMIT do form de Adicionar Referência (upload)
 */
async function handleReferenceUpload(e) {
    e.preventDefault(); if (!currentUser) return showToast('Você precisa estar logado.', 'error'); const fileInput = document.getElementById('ref-image'); const file = fileInput.files[0]; if (!file) { showToast('Por favor, selecione um arquivo de imagem.', 'error'); return; } showLoading();
    try {
        const fileExtension = file.name.split('.').pop(); const fileName = `ref_${currentUser.uid}_${Date.now()}.${fileExtension}`; const storageRef = ref(storage, `references/${currentUser.uid}/${fileName}`);
        const uploadTask = uploadBytesResumable(storageRef, file); await uploadTask; const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
        await addDoc(collection(db, "references"), { imageUrl: downloadURL, sellerId: currentUser.uid, sellerName: currentUser.name, createdAt: serverTimestamp() });
        showToast('Referência adicionada com sucesso!', 'success'); e.target.reset(); document.getElementById('file-name-display').textContent = 'Nenhum arquivo selecionado'; loadVendorReferences();
    } catch (error) { console.error("Erro ao adicionar referência:", error); showToast('Erro ao enviar imagem. Tente novamente.', 'error'); } finally { hideLoading(); }
}

/**
 * Carrega a lista de referências do vendedor logado
 */
async function loadVendorReferences() {
    referencesLoaded = true; if (!currentUser) return; const listContainer = document.getElementById('vendor-references-list'); if (!listContainer) return; listContainer.innerHTML = '<p>Carregando suas referências...</p>';
    try {
        const q = query(collection(db, "references"), where("sellerId", "==", currentUser.uid), orderBy("createdAt", "desc"));
        const querySnapshot = await getDocs(q);
        if (querySnapshot.empty) { listContainer.innerHTML = '<p>Nenhuma referência enviada ainda.</p>'; return; }
        listContainer.innerHTML = '';
        querySnapshot.forEach(doc => {
            const refData = doc.data(); const refId = doc.id;
            const item = document.createElement('div'); item.className = 'vendor-ref-item';
            item.innerHTML = `<img src="${refData.imageUrl}" alt="Referência ${refId}" loading="lazy"><button class="vendor-ref-delete-btn" data-id="${refId}" data-url="${refData.imageUrl}" title="Excluir Referência"><i class="fas fa-times"></i></button>`;
            listContainer.appendChild(item);
        });
    } catch (error) { console.error("Erro ao carregar referências do vendedor:", error); listContainer.innerHTML = '<p>Erro ao carregar referências.</p>'; }
}

/**
 * Deleta uma referência (Firestore e Storage) - Chamada pelo modal
 */
async function deleteReferenceFromDb(refId, imageUrl) {
    showLoading();
    try {
        await deleteDoc(doc(db, "references", refId));
        // Tenta deletar a imagem do Storage. Envolve em try/catch pois a URL pode ser inválida
        try {
            const imageRef = ref(storage, imageUrl); // Tenta criar ref a partir da URL completa
            await deleteObject(imageRef);
        } catch (storageError) {
             // Tenta criar ref a partir do caminho se a URL falhar (menos provável funcionar com URL completa)
             // Isso pode precisar de ajuste dependendo de como as URLs são formatadas
             console.warn("Falha ao deletar imagem do Storage usando URL direta, tentando caminho relativo (pode falhar):", storageError);
              try {
                  // Extrai o caminho da URL (ex: 'references/uid/nome.jpg') - PODE FALHAR
                   const imagePath = new URL(imageUrl).pathname.split('/o/')[1].split('?')[0].replace(/%2F/g, '/');
                   const pathRef = ref(storage, decodeURIComponent(imagePath));
                   await deleteObject(pathRef);
                   
              } catch (pathError) {
                   console.error("Erro ao tentar deletar imagem do Storage via caminho relativo:", pathError);
              }
        }
        showToast('Referência excluída com sucesso.', 'success'); loadVendorReferences();
    } catch (error) {
        console.error("Erro ao excluir referência (Firestore ou Storage):", error);
        showToast('Erro ao excluir referência. A entrada pode ter sido removida, mas a imagem pode ter permanecido no armazenamento.', 'error');
        loadVendorReferences(); // Recarrega mesmo em caso de erro parcial
    } finally { hideLoading(); }
}


// =======================================================
// --- SEÇÃO DE CONFIGURAÇÕES DO PERFIL (com foto) ---
// =======================================================
/**
 * Configura o painel de Configurações (com upload de foto)
 */
function setupSettingsForm() {
    const editBtn = document.getElementById('edit-profile-btn'); const settingsForm = document.getElementById('settings-form'); const fileInput = document.getElementById('vendor-picture'); const previewImg = document.getElementById('profile-picture-preview-img');
    if (editBtn) {
        editBtn.addEventListener('click', () => {
            if (!currentUser) return;
            document.getElementById('vendor-name').value = currentUser.name || ''; document.getElementById('vendor-whatsapp').value = currentUser.whatsapp || ''; document.getElementById('vendor-instagram').value = currentUser.instagram || '';
            previewImg.src = currentUser.profileImageUrl || 'https://via.placeholder.com/100?text=Foto';
            selectedProfilePictureFile = null; fileInput.value = ''; showModal('settings-modal');
        });
    }
    if (fileInput && previewImg) {
        fileInput.addEventListener('change', (event) => {
            const file = event.target.files[0];
            if (file) {
                selectedProfilePictureFile = file; const reader = new FileReader(); reader.onload = (e) => { previewImg.src = e.target.result; }
                reader.readAsDataURL(file);
            } else { previewImg.src = currentUser?.profileImageUrl || 'https://via.placeholder.com/100?text=Foto'; selectedProfilePictureFile = null; }
        });
    }
    if (settingsForm) { settingsForm.addEventListener('submit', handleSettingsSubmit); }
}

/**
 * Manipula o SUBMIT do form de Configurações (com upload de foto)
 */
async function handleSettingsSubmit(e) {
    e.preventDefault(); if (!currentUser) return showToast('Você precisa estar logado.', 'error'); showLoading();
    try {
        let profileImageUrl = currentUser.profileImageUrl;
        if (selectedProfilePictureFile) {
            // Opcional: deletar imagem antiga aqui
            const fileExtension = selectedProfilePictureFile.name.split('.').pop(); const fileName = `profile_${currentUser.uid}.${fileExtension}`; const storageRef = ref(storage, `profilePictures/${currentUser.uid}/${fileName}`);
            const uploadTask = uploadBytesResumable(storageRef, selectedProfilePictureFile); await uploadTask;
            profileImageUrl = await getDownloadURL(uploadTask.snapshot.ref);
        }
        const updates = { name: document.getElementById('vendor-name').value, whatsapp: document.getElementById('vendor-whatsapp').value, instagram: document.getElementById('vendor-instagram').value, profileImageUrl: profileImageUrl };
        if (!updates.name || !updates.whatsapp) { throw new Error('Nome e WhatsApp são obrigatórios.'); }
        const userRef = doc(db, "users", currentUser.uid); await updateDoc(userRef, updates);
        currentUser = { ...currentUser, ...updates };
        showToast('Perfil atualizado com sucesso!', 'success'); hideModal('settings-modal'); selectedProfilePictureFile = null;
    } catch (error) { console.error("Erro ao atualizar perfil:", error); showToast(`Erro: ${error.message}`, 'error'); } finally { hideLoading(); }
}
