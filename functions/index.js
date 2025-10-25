// index.js - formatado para suas regras de lint
const {onCall, HttpsError} = require("firebase-functions/v2/https");
const {initializeApp} = require("firebase-admin/app");
const {getAuth} = require("firebase-admin/auth");
const {getFirestore} = require("firebase-admin/firestore");

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
