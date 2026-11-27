import { http, setAccessToken, clearAccessToken, getAccessToken } from './httpClient';

const API_URL = http.apiUrl;

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
  async refresh() {
    try {
      const data = await http.post('/auth/refresh', {}, { auth: false });
      if (data?.access_token) setAccessToken(data.access_token);
      return data;
    } catch {
      return null;
    }
  },
  setToken(token) {
    setAccessToken(token);
  },
  getToken() {
    return getAccessToken();
  },
  async loginViaEmailPassword(email, password) {
    const data = await http.post('/auth/login', { email, password }, { auth: false });
    if (data?.access_token) setAccessToken(data.access_token);
    return data;
  },
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
  async resetPasswordRequest(email) {
    return http.post('/auth/forgot-password', { email }, { auth: false });
  },
  async resetPassword({ resetToken, newPassword }) {
    return http.post('/auth/reset-password', { resetToken, newPassword }, { auth: false });
  },
  loginWithProvider(provider, returnTo) {
    if (provider !== 'google') return;
    const url = new URL(`${API_URL}/auth/${provider}`, window.location.origin);
    if (returnTo) url.searchParams.set('returnTo', returnTo);
    window.location.href = url.toString();
  },
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
