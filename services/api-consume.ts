import { signOut } from "next-auth/react";
import { toast } from "react-toastify";

const IS_SERVER = typeof window === 'undefined';
const INTERNAL_API = process.env.INTERNAL_LARA_API_URL;
const PROXY_API = "/api/backend"; 

export interface IApiResponse<T = any> {
    data: T | null;
    status: number;
    ok: boolean;
    message?: string;
}

// 1. O parâmetro options permite pular a checagem em rotas específicas (como o próprio login)
async function API_CONSUME<T = any>(
    method: string, 
    endpoint: string, 
    headers: Record<string, string> = {},
    body: any = null,
    options: { skipAuthCheck?: boolean } = {} 
): Promise<IApiResponse<T>> {
    
    const baseURL = IS_SERVER ? `${INTERNAL_API}/api` : PROXY_API;
    const cleanEndpoint = endpoint.replace(/^\//, '');
    const url = `${baseURL}/${cleanEndpoint}`;
    
    const appToken = process.env.INTERNAL_LARA_API_TOKEN;
    let requestHeaders: Record<string, string> = {
        'Content-Type': 'application/json',
        ...headers
    };

    if (IS_SERVER) {
         const hasAuth = Object.keys(requestHeaders).some(k => k.toLowerCase() === 'authorization');
         if (!hasAuth && appToken) requestHeaders['Authorization'] = `Bearer ${appToken}`;
    }

    const config: RequestInit = {
        method,
        headers: requestHeaders,
        cache: 'no-store'
    };

    if (body) {
        config.body = JSON.stringify(body);
    }

    try {
        const response = await fetch(url, config);

        // ✅ INTERCEPTOR DE AUTENTICAÇÃO GLOBAL
        // Se a API retornar 401 ou 403, forçamos o logout do usuário imediatamente.
        if ((response.status === 401 || response.status === 403) && !IS_SERVER && !options.skipAuthCheck) {
            console.warn(`[API_CONSUME] Acesso negado na rota ${endpoint}. Iniciando SignOut...`);
            
            toast.error("Sua sessão expirou. Por favor, faça login novamente.");
            
            // Força o logout e limpa os cookies do NextAuth
            await signOut({ callbackUrl: '/login', redirect: true });
            
            return { data: null, status: response.status, ok: false, message: "Sessão expirada." };
        }

        const responseText = await response.text();
        let responseData = null;
        try { responseData = JSON.parse(responseText); } catch {}

        if (IS_SERVER && !response.ok) {
            console.error(`[API_CONSUME ERROR] Status: ${response.status} | Body: ${responseText.substring(0, 200)}`);
        }
        
        if (!IS_SERVER && response.status >= 500) {
            toast.error(`Erro no Servidor (${response.status})`);
        }
        
        return {
            data: responseData,
            status: response.status,
            ok: response.ok,
            message: responseData?.message || responseData?.error || null
        };

    } catch (error: any) {
        if (IS_SERVER) {
            console.error(`[API_CONSUME NETWORK ERROR] Falha ao conectar em ${url}:`, error.message);
        }
        return { data: null, status: 503, ok: false, message: "Falha de conexão com a API." };
    }
}

export default API_CONSUME;