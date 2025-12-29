import type { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from "next-auth";
import { authOptions } from "@/api/auth/[...nextauth]"; 

// Configuração para permitir payloads grandes se necessário
export const config = {
  api: {
    bodyParser: {
      sizeLimit: '4mb',
    },
  },
};

const API_URL = process.env.INTERNAL_LARA_API_URL;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    const appToken = process.env.INTERNAL_LARA_API_TOKEN;

    const { path } = req.query;
    const queryParams = { ...req.query };
    delete queryParams.path;
    
    const queryString = new URLSearchParams(queryParams as any).toString();
    const pathString = Array.isArray(path) ? path.join('/') : path;
    
    const destUrl = `${API_URL}/api/${pathString}${queryString ? `?${queryString}` : ''}`;

    // 3. Preparar Headers Limpos
    const headers = new Headers();
    headers.set("Content-Type", "application/json");
    headers.set("Accept", "application/json"); // Essencial para o Laravel
    headers.set("Authorization", `Bearer ${appToken}`);

    // Injetar Sessão do Usuário
    try {
        const session = await getServerSession(req, res, authOptions);
        if (session && (session as any).accessToken) {
            headers.set("Session", (session as any).accessToken);
        }
    } catch (error) {
        console.error("Erro ao obter sessão:", error);
    }

    // 4. Preparar o Body
    let body = null;
    if (req.method !== 'GET' && req.method !== 'HEAD' && req.body) {
        // No Pages Router, req.body já vem parseado se for JSON
        body = typeof req.body === 'object' ? JSON.stringify(req.body) : req.body;
    }

    try {
        const response = await fetch(destUrl, {
            method: req.method,
            headers: headers,
            body: body,
        });

        const contentType = response.headers.get("content-type");
        const isJson = contentType && contentType.includes("application/json");

        if (isJson) {
            const data = await response.json();
            return res.status(response.status).json(data);
        } 
        
        const textData = await response.text();
        
        if (!response.ok) {
            console.error("❌ [PROXY ERROR RESPONSE]", textData.substring(0, 200));
            return res.status(response.status).json({
                message: "Erro na API Backend (Retorno não-JSON)",
                raw_response: textData.substring(0, 100)
            });
        }

        return res.status(response.status).send(textData);

    } catch (error: any) {
        console.error("🔥 [PROXY FATAL]", error);
        return res.status(502).json({ 
            message: "Proxy Connection Failed", 
            error: error.message 
        });
    }
}