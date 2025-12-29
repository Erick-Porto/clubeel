import type { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from "next-auth";
import { authOptions } from "@/api/auth/[...nextauth]"; 

interface SessionWithToken {
    accessToken?: string;
}

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
    
    const searchParams = new URLSearchParams();
    Object.entries(queryParams).forEach(([key, value]) => {
        if (Array.isArray(value)) {
            value.forEach((v) => searchParams.append(key, v));
        } else if (typeof value === 'string') {
            searchParams.append(key, value);
        }
    });
    
    const queryString = searchParams.toString();
    const pathString = Array.isArray(path) ? path.join('/') : (path || '');
    
    const destUrl = `${API_URL}/api/${pathString}${queryString ? `?${queryString}` : ''}`;

    const headers = new Headers();
    headers.set("Content-Type", "application/json");
    headers.set("Accept", "application/json"); 
    headers.set("Authorization", `Bearer ${appToken}`);

    try {
        const session = await getServerSession(req, res, authOptions);
        const sessionWithToken = session as unknown as SessionWithToken;

        if (sessionWithToken && sessionWithToken.accessToken) {
            headers.set("Session", sessionWithToken.accessToken);
        }
    } catch (error: unknown) {
        console.error("Erro ao obter sessão:", error);
    }

    let body: BodyInit | null = null;
    if (req.method !== 'GET' && req.method !== 'HEAD' && req.body) {
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
            return res.status(response.status).json({
                message: "Erro na API Backend (Retorno não-JSON)",
                raw_response: textData.substring(0, 100)
            });
        }

        return res.status(response.status).send(textData);

    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";        
        return res.status(502).json({ 
            message: "Proxy Connection Failed", 
            error: errorMessage 
        });
    }
}