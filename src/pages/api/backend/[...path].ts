import { NextRequest, NextResponse } from "next/server";

// URL da API Real (Backend Laravel/Outro)
const API_URL = process.env.INTERNAL_LARA_API_URL;

async function handler(req: NextRequest, { params }: { params: { path: string[] } }) {
    // 1. Reconstrói o caminho (ex: /ping)
    const path = params.path.join("/");
    const query = req.nextUrl.search; // Pega query params (?id=1)
    
    // 2. Prepara os Headers
    const headers = new Headers(req.headers);
    headers.set("Content-Type", "application/json");
    
    // INJEÇÃO SERVER-SIDE: O Token é inserido aqui, o cliente não precisa enviar
    const token = process.env.INTERNAL_LARA_API_TOKEN;
    if (token) {
        headers.set("Authorization", `Bearer ${token}`);
    }

    // Remove headers que podem causar conflito de host
    headers.delete("host");
    headers.delete("connection");

    // 3. Lê o corpo da requisição (se houver)
    let body = null;
    if (req.method !== "GET" && req.method !== "HEAD") {
        try {
            body = JSON.stringify(await req.json());
        } catch {
            // Caso o body venha vazio ou inválido
            body = null;
        }
    }

    try {
        // 4. Dispara a requisição REAL para o servidor interno (192.168...)
        const response = await fetch(`${API_URL}/api/${path}${query}`, {
            method: req.method,
            headers: headers,
            body: body,
            cache: "no-store", // Evita cache do Next.js em dados dinâmicos
        });

        // 5. Pega a resposta e devolve para o Front
        const data = await response.json().catch(() => ({}));
        
        return NextResponse.json(data, { 
            status: response.status,
            statusText: response.statusText
        });

    } catch (error) {
        console.error("[PROXY ERROR]", error);
        return NextResponse.json(
            { message: "Erro de comunicação com o servidor interno." }, 
            { status: 502 }
        );
    }
}

// Exporta os métodos suportados
export const GET = handler;
export const POST = handler;
export const PUT = handler;
export const DELETE = handler;
export const PATCH = handler;