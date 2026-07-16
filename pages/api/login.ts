import type { NextApiRequest, NextApiResponse } from 'next';
import API_CONSUME from '../../services/api-consume';
import { rateLimit, getClientIp } from '../../utils/rate-limit';
import { guardRequest } from '../../utils/sanitize';

export default async function LoginHandler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method === 'POST') {
        const rl = rateLimit(`login:${getClientIp(req)}`, 8, 60_000);
        if (!rl.ok) {
            res.setHeader('Retry-After', String(rl.retryAfter));
            return res.status(429).json({ error: 'Muitas tentativas. Tente novamente em instantes.' });
        }

        if (!guardRequest(req, res)) return;

        const { login, password } = req.body;

        if (!login || !password) {
            return res.status(400).json({ error: 'Missing login or password' });
        }

        try {
            const response = await API_CONSUME('POST', 'login',
                {},
                {
                    login,
                    password
                }
            );

            if (!response.ok || !response.data) {
                return res.status(401).json({ error: response.message || 'Invalid login credentials' });
            }

            const payload = response.data;

            if (!payload.token || !payload.user) {
                return res.status(401).json({ error: 'Invalid response from server' });
            }

            return res.status(200).json(payload);

        } catch (error) {
            console.error('Login API error:', error instanceof Error ? error.message : String(error));
            return res.status(500).json({ error: 'Internal Server Error' });
        }
    } else {
        res.setHeader('Allow', ['POST']);
        res.status(405).end(`Method ${req.method} Not Allowed`);
    }
}
