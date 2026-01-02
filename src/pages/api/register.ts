// pages/api/register.ts

import type { NextApiRequest, NextApiResponse } from 'next';
import API_CONSUME from '@/services/api-consume';

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
            const response = await API_CONSUME(
                'POST',
                'register',
                {},
                { title, cpf, birthDate, password }
            );

            if (!response.ok) {
                return res.status(response.status).json({ 
                    error: response.message || 'Falha ao registrar usuário.' 
                });
            }

            if (!response.data) {
                return res.status(500).json({ error: 'Servidor retornou sucesso mas sem dados.' });
            }

            return res.status(200).json(response.data);

        } catch (error) {
            console.error('Error in RegisterHandler:', error);
            return res.status(500).json({ error: 'Internal Server Error' });
        }
    } else {
        res.setHeader('Allow', ['POST']);
        res.status(405).json({ error: `Method ${req.method} Not Allowed` });
    }
}