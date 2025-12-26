import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth"; // Importe isso
import { authOptions } from "@/api/auth/[...nextauth]"; // Importe suas configs de auth

const API_URL = process.env.INTERNAL_LARA_API_URL;

async function handler(req: NextRequest, { params }: { params: { path: string[] } }) {
    const path = params.path.join("/");
    const query = req.nextUrl.search;

    // 1. Obtém a sessão do usuário no lado do servidor
    // Nota: Se estiver usando App Router puro, talvez precise de uma adaptação dependendo da versão do NextAuth, 
    // mas getServerSession geralmente funciona se passar as options.
    const session = await getServerSession(authOptions);

    // 2. Prepara os Headers
    const headers = new Headers(req.headers);
    headers.set("Content-Type", "application/json");

    // Lógica de Token de API (Geral)
    const apiToken = process.env.LARA_API_TOKEN;
    if (apiToken) headers.set("Authorization", `Bearer ${apiToken}`);

    // --- A MÁGICA ACONTECE AQUI ---
    // Se o usuário estiver logado, injetamos o Session ID do Laravel
    if (session?.accessToken) {
        headers.set("Session", session.accessToken);
    }
    // ------------------------------

    // Limpeza de headers conflitantes
    headers.delete("host");
    headers.delete("connection");
    headers.delete("cookie"); // Opcional: Remove cookies do NextAuth para não confundir o Laravel

    let body = null;
    if (req.method !== "GET" && req.method !== "HEAD") {
        try { body = JSON.stringify(await req.json()); } catch { body = null; }
    }

    try {
        const response = await fetch(`${API_URL}/api/${path}${query}`, {
            method: req.method,
            headers: headers,
            body: body,
            cache: "no-store",
        });

        const data = await response.json().catch(() => ({}));
        return NextResponse.json(data, { status: response.status });

    } catch (error) {
        return NextResponse.json({ message: "Proxy Error" }, { status: 502 });
    }
}

export const GET = handler;
export const POST = handler;
export const PUT = handler;
export const DELETE = handler;
export const PATCH = handler;