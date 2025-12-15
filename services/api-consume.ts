import { toast } from "react-toastify";
import { signOut } from "next-auth/react";

const BASE_URL = process.env.NEXT_PUBLIC_LARA_API 
    ? `${process.env.NEXT_PUBLIC_LARA_API}/api` 
    : "https://lara.clubedosfuncionarios.com.br/api";

// Interface para padronizar o retorno
export interface IApiResponse<T = any> {
    data: T | null;      // O corpo da resposta (seja sucesso ou erro da API)
    status: number;      // O código HTTP (200, 409, 500, etc.)
    ok: boolean;         // true se for 2xx, false caso contrário
    message?: string;    // Mensagem de erro amigável (se houver)
}

async function API_CONSUME<T = any>(
    method: string, 
    endpoint: string, 
    headers: any = {}, 
    body: any = null
): Promise<IApiResponse<T>> {
    
    // Configuração inicial
    const config: RequestInit = {
        method,
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.NEXT_PUBLIC_LARA_API_TOKEN}`,
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache',
            ...headers
        },
        cache: 'no-store'
    };

    if (body) {
        config.body = JSON.stringify(body);
    }

    const url = endpoint.startsWith('http') ? endpoint : `${BASE_URL}/${endpoint}`;

    try {
        const response = await fetch(url, config);
        
        console.log(`📡 API_CONSUME [${method}] ${response.status} - ${url}`);

        // Tenta ler o corpo como JSON, se falhar (body vazio), retorna null
        const responseData = await response.json().catch(() => null);

        // --- Tratamentos Especiais (Side Effects) ---
        
        // Se for erro crítico de servidor, logamos mas retornamos o status original
        if (response.status >= 500) {
            console.error(`🔥 Erro Crítico (${response.status}) em: ${url}`, responseData);
            // Opcional: handleCriticalError() se quiser deslogar em 500, 
            // mas geralmente 500 é temporário e não exige logout.
        }

        // Se a sessão expirou no Laravel (419 ou 401 dependendo da config)
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
            ok: response.ok, // Fetch define ok como true se status for 200-299
            message: responseData?.message || responseData?.error || null
        };

    } catch (error: any) {
        console.error("❌ API_CONSUME Network Error:", error);

        if (error.name === 'TypeError' && error.message === 'Failed to fetch') {
            console.error("Falha de conexão com a API.");
            handleCriticalError(); 
            // Retornamos um status 0 ou 503 para indicar erro de rede
            return { 
                data: null, 
                status: 0, 
                ok: false, 
                message: "Erro de conexão com o servidor." 
            };
        }
        
        // Erro desconhecido de execução
        return { 
            data: null, 
            status: 500, 
            ok: false, 
            message: "Erro interno no cliente HTTP." 
        };
    }
}

function handleCriticalError() {
    if (typeof window !== 'undefined') {
        const currentPath = window.location.pathname;
        
        if (currentPath !== '/login' && !window.location.search.includes('maintenance=true')) {
            console.warn("⚠️ Falha crítica ou sessão inválida. Logout forçado.");
            
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