// js/app.js
console.log("APP: Script app.js iniciado."); // LOG 1

// Importações dos serviços do Firebase (centralizados)
import { auth, db, storage, functions, googleProvider } from './firebase-config.js';
console.log("APP: Firebase config importado."); // LOG 2

// Importação de módulos de UI
import { initModalClosers } from './ui.js';
console.log("APP: UI importado."); // LOG 3

// Importa o Roteador
import * as router from './router.js';
console.log("APP: Router importado."); // LOG 4

// Importa módulos
import * as produtos from './systemaprodutos.js';
import * as menu from './systemamenu.js';
import * as filtro from './systemafiltro.js';
import * as vendedor from './systemavendedor.js';
import * as admin from './systemaadmin.js';
import * as registro from './systemaregistro.js';
import * as referencias from './systemareferencias.js';
import * as vendedores from './systemavendedores.js';
import * as canais from './systemacanais.js'; // Import do módulo problemático
console.log("APP: Todos os módulos importados."); // LOG 5

// Event listener para garantir que o DOM está carregado
document.addEventListener('DOMContentLoaded', () => {
    console.log("APP: DOMContentLoaded disparado."); // LOG 6

    // Inicializa helpers de UI
    try {
        initModalClosers();
        console.log("APP: initModalClosers() executado."); // LOG 7
    } catch (error) {
        console.error("APP: Erro em initModalClosers():", error); // LOG ERRO UI
    }


    // Objeto de dependências
    const dependencies = { auth, db, storage, functions, googleProvider };
    console.log("APP: Dependências criadas."); // LOG 8

    // Inicializa cada módulo do sistema (com try-catch individual)
    try { menu.init(dependencies); console.log("APP: menu.init() OK."); }
    catch(e) { console.error("APP: Erro inicializando menu:", e); }

    try { filtro.init(dependencies); console.log("APP: filtro.init() OK."); }
    catch(e) { console.error("APP: Erro inicializando filtro:", e); }

    try { vendedor.init(dependencies); console.log("APP: vendedor.init() OK."); }
    catch(e) { console.error("APP: Erro inicializando vendedor:", e); }

    try { admin.init(dependencies); console.log("APP: admin.init() OK."); }
    catch(e) { console.error("APP: Erro inicializando admin:", e); }

    try { registro.init(dependencies); console.log("APP: registro.init() OK."); }
    catch(e) { console.error("APP: Erro inicializando registro:", e); }

    try { referencias.init(dependencies); console.log("APP: referencias.init() OK."); }
    catch(e) { console.error("APP: Erro inicializando referencias:", e); }

    try { vendedores.init(dependencies); console.log("APP: vendedores.init() OK."); }
    catch(e) { console.error("APP: Erro inicializando vendedores:", e); }

    try { produtos.init(dependencies); console.log("APP: produtos.init() OK."); }
    catch(e) { console.error("APP: Erro inicializando produtos:", e); }

    // Chamada ao módulo problemático
    console.log("APP: Tentando inicializar canais..."); // LOG 9
    try {
        canais.init(dependencies);
        console.log("APP: canais.init() chamado com sucesso."); // LOG 10
    } catch(error) {
        console.error("APP: ERRO AO CHAMAR canais.init():", error); // LOG ERRO CANAIS INIT
    }

    console.log("APP: Fim da inicialização no DOMContentLoaded."); // LOG 11

    // O router.js já adiciona seu próprio listener para DOMContentLoaded
});

console.log("APP: Script app.js finalizado (setup inicial)."); // LOG 12
