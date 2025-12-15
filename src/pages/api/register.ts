// pages/api/register.ts

import type { NextApiRequest, NextApiResponse } from 'next';
import API_CONSUME from '@/services/api-consume';

// ... (Função IsValidCPF permanece igual) ...
function IsValidCPF(cpf: string): boolean {
    if (cpf.length !== 11 || /^(\d)\1+$/.test(cpf)) return false;
    let sum = 0, remainder;
    for (let i = 1; i <= 9; i++) sum += parseInt(cpf.substring(i - 1, i)) * (11 - i);
    remainder = (sum * 10) % 11;
    if (remainder === 10 || remainder === 11) remainder = 0;
    if (remainder !== parseInt(cpf.substring(9, 10))) return false;
    sum = 0;
    for (let i = 1; i <= 10; i++) sum += parseInt(cpf.substring(i - 1, i)) * (12 - i);
    remainder = (sum * 10) % 11;
    if (remainder === 10 || remainder === 11) remainder = 0;
    if (remainder !== parseInt(cpf.substring(10, 11))) return false;
    return true;
}

export default async function RegisterHandler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method === 'POST') {
        const { cpf, title, birthDate, password } = req.body;

        if (!cpf || !title || !birthDate || !password) {
            return res.status(400).json({ error: "Missing required fields" });
        }

        if (!IsValidCPF(cpf)) {
            return res.status(400).json({ error: 'Invalid CPF' });
        }

        try {
            // Renomeado para 'response' para indicar que é o envelope
            const response = await API_CONSUME(
                'POST',
                'register',
                { Session: null },
                { title, cpf, birthDate, password }
            );

            // 1. Verificação de Falha (Novo Padrão)
            if (!response.ok) {
                // Repassa o status real da API (ex: 422, 409) e a mensagem de erro
                return res.status(response.status).json({ 
                    error: response.message || 'Falha ao registrar usuário.' 
                });
            }

            // 2. Verificação de Dados Vazios (Opcional, mas boa prática)
            if (!response.data) {
                return res.status(500).json({ error: 'Servidor retornou sucesso mas sem dados.' });
            }

            // 3. Sucesso: Retorna apenas os dados (desenvelopado)
            return res.status(200).json(response.data);

        } catch (error) {
            console.error('Error in RegisterHandler:', error);
            // Este catch agora só captura erros de execução (ex: JSON parse failed),
            // pois erros de rede/API são tratados no `if (!response.ok)`
            return res.status(500).json({ error: 'Internal Server Error' });
        }
    } else {
        res.setHeader('Allow', ['POST']);
        res.status(405).json({ error: `Method ${req.method} Not Allowed` });
    }
}