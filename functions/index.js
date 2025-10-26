// index.js - formatado para suas regras de lint
const {onCall, HttpsError} = require("firebase-functions/v2/https");
const {initializeApp} = require("firebase-admin/app");
const {getAuth} = require("firebase-admin/auth");
const {getFirestore} = require("firebase-admin/firestore");
const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const { Timestamp } = require("firebase-admin/firestore");

initializeApp();

exports.createClientUser = onCall(async (request) => {
  const {email, password, name, phone} = request.data || {};

  if (!email || !password || !name || !phone) {
    throw new HttpsError("invalid-argument",
        "Todos os campos são obrigatórios.");
  }

  try {
    const adminAuth = getAuth();
    const adminDb = getFirestore();

    const userRecord = await adminAuth.createUser({
      email,
      password,
      displayName: name,
      disabled: false,
    });

    const uid = userRecord.uid;
    await adminAuth.setCustomUserClaims(uid, {role: "cliente"});
    await adminDb
        .collection("users")
        .doc(uid)
        .set({name, email, phone, role: "cliente", createdAt: new Date()});

    return {success: true, uid};
  } catch (error) {
    if (error.code === "auth/email-already-exists") {
      throw new HttpsError("already-exists", "Este e-mail já está em uso.");
    }
    throw new HttpsError("internal", error.message || String(error));
  }
});

exports.createSeller = onCall(async (request) => {
  if (!request.auth || !request.auth.token ||
      request.auth.token.role !== "admin") {
    throw new HttpsError("permission-denied",
        "Você não tem permissão para executar esta ação.");
  }

  const {email, password, name, whatsapp} = request.data || {};
  if (!email || !password || !name || !whatsapp) {
    throw new HttpsError("invalid-argument",
        "Todos os campos são obrigatórios.");
  }

  try {
    const adminAuth = getAuth();
    const adminDb = getFirestore();

    const userRecord = await adminAuth.createUser({
      email,
      password,
      displayName: name,
      disabled: false,
    });

    const uid = userRecord.uid;
    await adminAuth.setCustomUserClaims(uid, {role: "vendedor"});
    await adminDb
        .collection("users")
        .doc(uid)
        .set({name, email, whatsapp, role: "vendedor", createdAt: new Date()});

    return {success: true, uid};
  } catch (error) {
    if (error.code === "auth/email-already-exists") {
      throw new HttpsError("already-exists", "Este e-mail já está em uso.");
    }
    throw new HttpsError("internal", error.message || String(error));
  }
});

exports.deleteSeller = onCall(async (request) => {
  if (!request.auth || !request.auth.token ||
      request.auth.token.role !== "admin") {
    throw new HttpsError("permission-denied",
        "Você não tem permissão para executar esta ação.");
  }

  const {uid} = request.data || {};
  if (!uid) {
    throw new HttpsError("invalid-argument",
        "UID do vendedor é obrigatório.");
  }

  try {
    const adminAuth = getAuth();
    const adminDb = getFirestore();

    await adminAuth.deleteUser(uid);
    await adminDb.collection("users").doc(uid).delete();

    return {success: true, message: "Vendedor removido com sucesso."};
  } catch (error) {
    throw new HttpsError("internal", error.message || String(error));
  }
});
/**
 * Atualiza o timestamp do último produto adicionado pelo vendedor.
 * Acionada quando um novo documento é criado em 'produtos'.
 */
exports.updateSellerLastProductTimestamp = onDocumentCreated("produtos/{productId}", async (event) => {
  // Pega os dados do novo produto
  const snapshot = event.data;
  if (!snapshot) {
    console.log("Nenhum dado associado ao evento.");
    return null;
  }
  const productData = snapshot.data();
  const sellerId = productData.sellerId;
  // Usa o timestamp de criação do próprio produto
  const createdAt = productData.createdAt || Timestamp.now(); // Fallback para agora se createdAt não estiver lá

  if (!sellerId) {
    console.log(`Produto ${snapshot.id} não tem sellerId.`);
    return null;
  }

  console.log(`Atualizando lastProductTimestamp para vendedor ${sellerId} devido ao produto ${snapshot.id}`);

  try {
    const adminDb = getFirestore();
    const userRef = adminDb.collection("users").doc(sellerId);

    // Atualiza o campo no documento do usuário (vendedor)
    await userRef.update({
      lastProductTimestamp: createdAt
    });

    console.log(`Timestamp do vendedor ${sellerId} atualizado com sucesso.`);
    return { success: true };

  } catch (error) {
    console.error(`Erro ao atualizar timestamp para vendedor ${sellerId}:`, error);
    // Não lançamos HttpsError aqui, pois não é uma onCall
    return { success: false, error: error.message };
  }
});
