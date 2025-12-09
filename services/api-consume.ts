import { toast } from "react-toastify";
import { signOut } from "next-auth/react"; // 1. Importar signOut

const BASE_URL = `${process.env.NEXT_PUBLIC_LARA_API}/api` || "https://lara.clubedosfuncionarios.com.br/api";

async function API_CONSUME(method: string, endpoint: string, headers: any = {}, body: any = null) {
    try {
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

        const response = await fetch(url, config);
        console.log(`API_CONSUME Response Status: ${response.status} for URL: ${url}`);
        if (response.status >= 500) {
            console.error(`Erro Crítico de Servidor (${response.status}) em: ${url}`);
            handleCriticalError();
            return { error: true, status: response.status, message: "Servidor indisponível" };
        }

        if (response.status === 419) {
             handleCriticalError();
             return { error: true, status: 419, message: "Sessão expirada." };
        }

        const responseData = await response.json().catch(() => null);
        console.log('API_CONSUME Response Data:', responseData);
        return responseData;

    } catch (error: any) {
        console.error("API_CONSUME Error:", error);

        if (error.name === 'TypeError' && error.message === 'Failed to fetch') {
            console.error("Falha de conexão com a API.");
            handleCriticalError();
            return { error: true, status: 0, message: "Erro de Conexão com a API" };
        }
        throw error;
    }
}

function handleCriticalError() {
    if (typeof window !== 'undefined') {
        const currentPath = window.location.pathname;
        
        if (currentPath !== '/login' && !window.location.search.includes('maintenance=true')) {
            
            console.warn("Falha crítica detectada. Realizando logout forçado...");

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