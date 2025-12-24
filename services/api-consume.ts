import { toast } from "react-toastify";
import { signOut } from "next-auth/react";

// DETECTA O AMBIENTE
const IS_SERVER = typeof window === 'undefined';

// Lógica de URL Híbrida:
// 1. Se estiver no SERVIDOR (SSR), usa o IP interno direto (definido no .env).
// 2. Se estiver no NAVEGADOR, usa a rota relativa '/api/backend' que o Next.js vai redirecionar.
const BASE_URL = IS_SERVER
    ? (process.env.INTERNAL_API_URL || "http://192.168.10.10") // Fallback para IP interno
    : "/api/backend"; // Rota mágica do Rewrite

export interface IApiResponse<T = any> {
    data: T | null;
    status: number;
    ok: boolean;
    message?: string;
}

async function API_CONSUME<T = any>(
    method: string, 
    endpoint: string, 
    headers: any = {}, 
    body: any = null
): Promise<IApiResponse<T>> {
    
    const config: RequestInit = {
        method,
        headers: {
            'Content-Type': 'application/json',
            // Mantém o token. Nota: Em arquiteturas BFF avançadas, esse token poderia ser injetado no lado do servidor.
            'Authorization': `Bearer ${process.env.NEXT_PUBLIC_LARA_API_TOKEN}`,
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache',
            ...headers
        },
        // 'no-store' é importante para evitar cache de dados dinâmicos do Laravel
        cache: 'no-store' 
    };

    if (body) config.body = JSON.stringify(body);

    // Constrói a URL final
    // Se o endpoint já vier completo (http...), usa ele. Se não, usa a BASE_URL calculada.
    const url = endpoint.startsWith('http') ? endpoint : `${BASE_URL}/${endpoint.replace(/^\//, '')}`;

    try {
        const response = await fetch(url, config);
        
        const responseData = await response.json().catch(() => null);

        // Tratamento de erros no lado do Servidor (logs no terminal) vs Cliente (Toast)
        if (response.status >= 500) {
            if (!IS_SERVER) {
                toast.error(`Erro Crítico (${response.status})`);
            } else {
                console.error(`[SSR ERROR] ${url} returned ${response.status}`, responseData);
            }
        }
        
        if (response.status === 419) {
             handleCriticalError();
             return { 
                 data: responseData, 
                 status: 419, 
                 ok: false, 
                 message: "Sessão expirada." 
             };
        }

        return {
            data: responseData,
            status: response.status,
            ok: response.ok,
            message: responseData?.message || responseData?.error || null
        };

    } catch (error: any) {
        const errorMessage = error instanceof Error ? error.message : String(error);

        // Só exibe Toast se estiver no navegador
        if (!IS_SERVER) {
            toast.error("Conexão instável. Tentando reconectar...");
        } else {
            console.error(`[SSR NETWORK ERROR] ${url}: ${errorMessage}`);
        }

        if (error.name === 'TypeError' && errorMessage === 'Failed to fetch') {
            if (!IS_SERVER) handleCriticalError();
            return { 
                data: null, 
                status: 0, 
                ok: false, 
                message: "Erro de conexão com o servidor." 
            };
        }
        
        return { 
            data: null, 
            status: 500, 
            ok: false, 
            message: "Erro interno no cliente HTTP." 
        };
    }
}

function handleCriticalError() {
    // Só executa redirecionamento se estiver no navegador
    if (typeof window !== 'undefined') {
        const currentPath = window.location.pathname;
        
        if (currentPath !== '/login' && !window.location.search.includes('maintenance=true')) {
            // Removido toast.warn para evitar flood, ou usar um controle de estado
            signOut({ 
                callbackUrl: '/login?maintenance=true',
                redirect: true 
            }).catch(() => {
                window.location.href = '/login?maintenance=true';
            });
        }
    }
}

export default API_CONSUME;