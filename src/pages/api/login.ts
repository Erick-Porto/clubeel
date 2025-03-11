import type { NextApiRequest, NextApiResponse } from 'next';
import CryptoJS from "crypto-js"; // Import CryptoJS

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method === 'POST') {
        const { login, password } = req.body;

        if (!login || !password) {
            return res.status(400).json({ error: 'Missing login or password' });
        }

        try {
            // Make a request to another API
            const apiResponse = await fetch('http://192.168.100.205/api/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ login, password: CryptoJS.AES.encrypt(password, 'secret-key').toString() }),
            });

            if (!apiResponse.ok) {
                const errorData = await apiResponse.json();
                throw new Error(errorData.message || 'Failed to authenticate');
            }

            const data = await apiResponse.json();
            localStorage.setItem('authentication', data.token);

            return res.status(200).json(data);
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