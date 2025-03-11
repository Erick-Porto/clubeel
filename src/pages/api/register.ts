import type { NextApiRequest, NextApiResponse } from 'next';

function isValidCPF(cpf: string): boolean {
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

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method === 'POST') {
        const { cpf, matricula, bornAs, password} = req.body;

        if (!cpf || !matricula || !bornAs || !password) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        if (!isValidCPF(cpf)) {
            return res.status(400).json({ error: 'Invalid CPF' });
        }

        try {
            const apiResponse = await fetch('http://192.168.100.205/api/register', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer ' + process.env.API_KEY,
                },
                body: JSON.stringify({
                    title:matricula,
                    cpf,
                    birthDate:bornAs,
                    password}),
            });

            if (!apiResponse.ok) {
                const contentType = apiResponse.headers.get('content-type');
                if (contentType && contentType.includes('application/json')) {
                    const errorData = await apiResponse.json();
                    throw new Error(errorData.message || 'Failed to register');
                } else {
                    throw new Error('Failed to register');
                }
            }

            const contentType = apiResponse.headers.get('content-type');
            if (contentType && contentType.includes('application/json')) {
                const data = await apiResponse.json();
                return res.status(200).json(data);
            } else {
                throw new Error('Unexpected response format');
            }
        } catch (error) {
            if (error instanceof Error) {
                return res.status(500).json({ error: error.message });
            } else {
                return res.status(500).json({ error: 'An unknown error occurred' });
            }
        }
    } else {
        res.setHeader('Allow', ['POST']);
        res.status(405).end(`Method ${req.method} Not Allowed`);
    }
}