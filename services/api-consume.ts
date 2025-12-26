import { toast } from "react-toastify";
import { signOut } from "next-auth/react";

const IS_SERVER = typeof window === 'undefined';

// CONFIGURAÇÃO DAS BASES DE URL
// SSR: Bate direto no IP interno (para performance)
// Client: Bate na rota do Next.js (/api/backend), que fará o proxy
const INTERNAL_API = process.env.INTERNAL_LARA_API_URL;
const PROXY_API = "/api/backend"; 

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
    
    // Define qual URL base usar
    const baseURL = IS_SERVER ? `${INTERNAL_API}/api` : PROXY_API;

    // Remove barra inicial do endpoint para evitar duplicação (//ping)
    const cleanEndpoint = endpoint.replace(/^\//, '');
    
    // Constrói a URL final
    // Se for SSR: http://192.168.10.10:80/api/ping
    // Se for Client: /api/backend/ping
    const url = `${baseURL}/${cleanEndpoint}`;

    const config: RequestInit = {
        method,
        headers: {
            'Content-Type': 'application/json',
            // NOTA: Se for CLIENT-SIDE, não precisamos mandar o token aqui, 
            // pois o Route Handler (Passo 2) vai injetar.
            // Se for SERVER-SIDE, precisamos mandar.
            ...(IS_SERVER && {
                'Authorization': `Bearer ${process.env.INTERNAL_LARA_API_TOKEN}`
            }),
            ...headers
        },
        cache: 'no-store' 
    };

    if (body) config.body = JSON.stringify(body);

    try {
        const response = await fetch(url, config);
        
        const responseData = await response.json().catch(() => null);

        if (response.status >= 500) {
            if (!IS_SERVER) {
                toast.error(`Erro no Servidor (${response.status})`);
            } else {
                console.error(`[SSR FETCH ERROR] ${url} | Status: ${response.status}`, responseData);
            }
        }
        
        return {
            data: responseData,
            status: response.status,
            ok: response.ok,
            message: responseData?.message || responseData?.error || null
        };

    } catch (error: any) {
        const errorMessage = error instanceof Error ? error.message : String(error);

        if (!IS_SERVER) {
            console.error(`[CLIENT FETCH ERROR]`, error);
            // Evita flood de toast se a rede cair completamente
            if(method === 'GET') toast.error("Falha na comunicação.");
        } else {
            console.error(`[SSR NETWORK FAILURE] ${url}: ${errorMessage}`);
        }
        
        // Se falhar a conexão com o Proxy ou com a API
        return { 
            data: null, 
            status: 503, 
            ok: false, 
            message: "Serviço indisponível no momento." 
        };
    }
}

export default API_CONSUME;