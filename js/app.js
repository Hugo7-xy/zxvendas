// js/app.js

// Importações dos serviços do Firebase (centralizados)
import { auth, db, storage, functions, googleProvider } from './firebase-config.js';

// Importação de módulos de UI
import { initModalClosers } from './ui.js';

// Importa o Roteador
import * as router from './router.js';

// Importa módulos
import * as produtos from './systemaprodutos.js';
import * as menu from './systemamenu.js';
import * as filtro from './systemafiltro.js';
import * as vendedor from './systemavendedor.js';
import * as admin from './systemaadmin.js';
import * as registro from './systemaregistro.js';
import * as referencias from './systemareferencias.js';
import * as vendedores from './systemavendedores.js';
import * as canais from './systemacanais.js';

// Event listener para garantir que o DOM está carregado
document.addEventListener('DOMContentLoaded', () => {

    // Inicializa helpers de UI
    try {
        initModalClosers();
    } catch (error) {
        console.error("APP: Erro em initModalClosers():", error);
    }

    // Objeto de dependências
    const dependencies = { auth, db, storage, functions, googleProvider };

    // Inicializa cada módulo do sistema (com try-catch individual)
    try { menu.init(dependencies); }
    catch(e) { console.error("APP: Erro inicializando menu:", e); }

    try { filtro.init(dependencies); }
    catch(e) { console.error("APP: Erro inicializando filtro:", e); }

    try { vendedor.init(dependencies); }
    catch(e) { console.error("APP: Erro inicializando vendedor:", e); }

    try { admin.init(dependencies); }
    catch(e) { console.error("APP: Erro inicializando admin:", e); }

    try { registro.init(dependencies); }
    catch(e) { console.error("APP: Erro inicializando registro:", e); }

    try { referencias.init(dependencies); }
    catch(e) { console.error("APP: Erro inicializando referencias:", e); }

    try { vendedores.init(dependencies); }
    catch(e) { console.error("APP: Erro inicializando vendedores:", e); }

    try { produtos.init(dependencies); }
    catch(e) { console.error("APP: Erro inicializando produtos:", e); }

    try {
        canais.init(dependencies);
    } catch(error) {
        console.error("APP: ERRO AO CHAMAR canais.init():", error);
    }

});
