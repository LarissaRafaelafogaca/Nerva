// Biometria (Face ID / Touch ID / impressão digital) via WebAuthn, de forma
// LOCAL e simplificada: registramos uma credencial de plataforma no dispositivo
// e, no desbloqueio, pedimos uma verificação com o autenticador do aparelho.
//
// Observação honesta de segurança: esta é uma verificação LOCAL (não há desafio
// verificado por servidor). Ela confirma que a pessoa passou pela biometria do
// aparelho para desbloquear a tela do app — adequado como "tela de bloqueio",
// mas não substitui a autenticação de login (essa continua sendo o JWT).

const CRED_KEY = 'nerva_biometric_cred_id';

function bufToB64url(buf) {
  const bytes = new Uint8Array(buf);
  let str = '';
  for (const b of bytes) str += String.fromCharCode(b);
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function b64urlToBuf(b64url) {
  const b64 = b64url.replace(/-/g, '+').replace(/_/g, '/');
  const str = atob(b64);
  const bytes = new Uint8Array(str.length);
  for (let i = 0; i < str.length; i++) bytes[i] = str.charCodeAt(i);
  return bytes.buffer;
}
function randomChallenge() {
  return crypto.getRandomValues(new Uint8Array(32));
}

export function isBiometricSupported() {
  return typeof window !== 'undefined' && !!window.PublicKeyCredential && !!navigator.credentials;
}

// Verifica se o dispositivo tem um autenticador de plataforma (Face ID/Touch ID).
export async function isPlatformAuthenticatorAvailable() {
  try {
    if (!isBiometricSupported()) return false;
    return await window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
  } catch {
    return false;
  }
}

// Registra a credencial biométrica (ao ativar a biometria nas Configurações).
export async function registerBiometric(userId, userName) {
  if (!isBiometricSupported()) throw new Error('unsupported');
  const cred = await navigator.credentials.create({
    publicKey: {
      challenge: randomChallenge(),
      rp: { name: 'Nerva', id: window.location.hostname },
      user: {
        id: new TextEncoder().encode(String(userId || 'nerva-user')),
        name: userName || 'nerva',
        displayName: userName || 'Nerva',
      },
      pubKeyCredParams: [
        { type: 'public-key', alg: -7 },   // ES256
        { type: 'public-key', alg: -257 }, // RS256
      ],
      authenticatorSelection: {
        authenticatorAttachment: 'platform',
        userVerification: 'required',
        residentKey: 'preferred',
      },
      timeout: 60000,
      attestation: 'none',
    },
  });
  if (!cred) throw new Error('cancelled');
  localStorage.setItem(CRED_KEY, bufToB64url(cred.rawId));
  return true;
}

export function clearBiometric() {
  localStorage.removeItem(CRED_KEY);
}

export function hasBiometricCredential() {
  return !!localStorage.getItem(CRED_KEY);
}

// Pede a verificação biométrica para desbloquear. Retorna true se passou.
export async function verifyBiometric() {
  try {
    if (!isBiometricSupported()) return false;
    const storedId = localStorage.getItem(CRED_KEY);
    const allowCredentials = storedId
      ? [{ type: 'public-key', id: b64urlToBuf(storedId) }]
      : undefined;
    const assertion = await navigator.credentials.get({
      publicKey: {
        challenge: randomChallenge(),
        rpId: window.location.hostname,
        allowCredentials,
        userVerification: 'required',
        timeout: 60000,
      },
    });
    return !!assertion;
  } catch {
    return false;
  }
}
