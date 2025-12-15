import type { NextApiRequest, NextApiResponse } from 'next';
import API_CONSUME from '@/services/api-consume';
import { toast } from 'react-toastify';

export default async function LoginHandler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method === 'POST') {
        const { login, password } = req.body;
        
        if (!login || !password) {
            return res.status(400).json({ error: 'Missing login or password' });
        }

        try {
            // Renomeamos para 'response' para ficar claro que é o envelope
            const response = await API_CONSUME('POST', 'login',
                {
                    Session: null,
                },
                { 
                    login,
                    password
                }
            );
            
            // 1. Verificação de Sucesso (Status HTTP)
            if (!response.ok || !response.data) {
                // response.message conterá "Credenciais inválidas" se a API retornou 401
                return res.status(401).json({ error: response.message || 'Invalid login credentials' });
            }

            // 2. Extração dos dados reais
            const payload = response.data;

            // 3. Verificação de Integridade dos dados esperados
            if (!payload.token || !payload.user) {
                return res.status(401).json({ error: 'Invalid response from server' });
            }

            // 4. Retorna APENAS os dados do usuário/token (desenvelopado)
            return res.status(200).json(payload);

        } catch (error) {
            toast.error('Login API error: ' + (error instanceof Error ? error.message : String(error)));
            // Esse catch agora pega apenas erros de código (ex: JSON parse), não erros da API
            return res.status(500).json({ error: 'Internal Server Error' });
        }
    } else {
        res.setHeader('Allow', ['POST']);
        res.status(405).end(`Method ${req.method} Not Allowed`);
    }
}