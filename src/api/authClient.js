// Reproduz a superfície base44.auth usada pelo front-end, sobre o backend próprio.
import { http, setAccessToken, clearAccessToken, getAccessToken } from './httpClient';

const API_URL = http.apiUrl;

// Ao carregar a app, se o backend redirecionou com ?access_token=..., captura e limpa a URL.
function captureTokenFromUrl() {
  try {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('access_token');
    if (token) {
      setAccessToken(token);
      params.delete('access_token');
      const clean =
        window.location.pathname + (params.toString() ? `?${params.toString()}` : '') + window.location.hash;
      window.history.replaceState({}, '', clean);
    }
  } catch {
    /* ignore */
  }
}
captureTokenFromUrl();

export const authClient = {
  // ----- sessão / usuário -----
  async me() {
    return http.get('/auth/me');
  },
  async updateMe(partial) {
    return http.patch('/auth/me', partial);
  },
  async verifyPin(pin) {
    const res = await http.post('/auth/verify-pin', { pin });
    return !!res?.ok;
  },
  setToken(token) {
    setAccessToken(token);
  },
  getToken() {
    return getAccessToken();
  },

  // ----- login tradicional -----
  async loginViaEmailPassword(email, password) {
    const data = await http.post('/auth/login', { email, password }, { auth: false });
    if (data?.access_token) setAccessToken(data.access_token);
    return data;
  },

  // ----- cadastro + OTP -----
  async register({ email, password }) {
    return http.post('/auth/register', { email, password }, { auth: false });
  },
  async verifyOtp({ email, otpCode }) {
    const data = await http.post('/auth/verify-otp', { email, otpCode }, { auth: false });
    if (data?.access_token) setAccessToken(data.access_token);
    return data;
  },
  async resendOtp(email) {
    return http.post('/auth/resend-otp', { email }, { auth: false });
  },

  // ----- reset de senha -----
  async resetPasswordRequest(email) {
    return http.post('/auth/forgot-password', { email }, { auth: false });
  },
  async resetPassword({ resetToken, newPassword }) {
    return http.post('/auth/reset-password', { resetToken, newPassword }, { auth: false });
  },

  // ----- Google (fluxo de redirect) -----
  loginWithProvider(provider, returnTo) {
    if (provider !== 'google') return;
    const url = new URL(`${API_URL}/auth/${provider}`, window.location.origin);
    if (returnTo) url.searchParams.set('returnTo', returnTo);
    window.location.href = url.toString();
  },

  // ----- logout / redirect -----
  async logout(redirectUrl) {
    try {
      await http.post('/auth/logout', {});
    } catch {
      /* ignore */
    }
    clearAccessToken();
    if (redirectUrl) {
      window.location.href = '/login';
    }
  },
  redirectToLogin(returnTo) {
    const to = returnTo && returnTo !== window.location.href ? returnTo : window.location.pathname;
    window.location.href = `/login?returnTo=${encodeURIComponent(to)}`;
  },
};
