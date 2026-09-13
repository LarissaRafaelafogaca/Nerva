// Parâmetros do app. O backend proprietário anterior foi removido; agora só
// precisamos saber se há um token e onde fica a API.
import { getAccessToken, clearAccessToken } from '@/api/httpClient';

const isNode = typeof window === 'undefined';

const isClearAccessTokenRequested = () =>
	!isNode && new URLSearchParams(window.location.search).get('clear_access_token') === 'true';

if (isClearAccessTokenRequested()) {
	clearAccessToken();
}

export const appParams = {
	// getter para sempre refletir o token atual (ex.: capturado do redirect Google)
	get token() {
		return getAccessToken();
	},
	apiUrl: import.meta.env.VITE_API_URL || '/api',
};
