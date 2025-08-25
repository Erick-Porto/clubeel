import type { NextApiRequest, NextApiResponse } from 'next';
import API_CONSUME from '@/services/api-consume';

function IsValidCPF(cpf: string): boolean {
    if (cpf.length !== 11 || /^(\d)\1+$/.test(cpf)) {
        return false;
    }

    let sum = 0;
    let remainder;

    for (let i = 1; i <= 9; i++) {
        sum += parseInt(cpf.substring(i - 1, i)) * (11 - i);
    }

    remainder = (sum * 10) % 11;

    if (remainder === 10 || remainder === 11) {
        remainder = 0;
    }

    if (remainder !== parseInt(cpf.substring(9, 10))) {
        return false;
    }

    sum = 0;

    for (let i = 1; i <= 10; i++) {
        sum += parseInt(cpf.substring(i - 1, i)) * (12 - i);
    }

    remainder = (sum * 10) % 11;

    if (remainder === 10 || remainder === 11) {
        remainder = 0;
    }

    if (remainder !== parseInt(cpf.substring(10, 11))) {
        return false;
    }

    return true;
}

export default async function RegisterHandler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method === 'POST') {
        const { cpf, matricula, bornAs, password } = req.body;

        // Verificar campos obrigatórios
        if (!cpf || !matricula || !bornAs || !password) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        // Validar CPF
        if (!IsValidCPF(cpf)) {
            return res.status(400).json({ error: 'Invalid CPF' });
        }

        try {
            // Chamada ao serviço externo
            const data = await API_CONSUME(
                'POST',
                'register',
                {
                    Authorization: 'Bearer ' + process.env.NEXT_PUBLIC_API_TOKEN,
                    Session: null,
                },
                {
                    title: matricula,
                    cpf,
                    birthDate: bornAs,
                    password,
                }
            );

            // Garantir que o serviço externo retorna dados válidos
            if (!data) {
                return res.status(500).json({ error: 'Empty response from external service' });
            }

            return res.status(200).json(data);
        } catch (error) {
            console.error('Error in API_CONSUME:', error);

            if (error instanceof Error) {
                return res.status(500).json({ error: error.message });
            } else {
                return res.status(500).json({ error: 'An unknown error occurred' });
            }
        }
    } else {
        res.setHeader('Allow', ['POST']);
        res.status(405).json({ error: `Method ${req.method} Not Allowed` });
    }
}