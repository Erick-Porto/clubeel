import type { NextApiRequest, NextApiResponse } from 'next';
import API_CONSUME from '@/services/api-consume';

export default async function LoginHandler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method === 'POST') {
        const { login, password } = req.body;
        if (!login || !password) return res.status(400).json({ error: 'Missing login or password' });

        try {
            const data = await API_CONSUME('POST', 'login',
                {
                    Authorization: 'Bearer ' + process.env.NEXT_PUBLIC_API_TOKEN,
                    Session: null,
                },
                { 
                    login,
                    password
                }
            );

            if (!data || !data.token || !data.user) {
                return res.status(401).json({ error: 'Invalid login credentials' });
            }

            return res.status(200).json(data);

        } catch (error) {
            console.error('Login API error:', error);
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