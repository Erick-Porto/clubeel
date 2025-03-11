import type { NextApiRequest, NextApiResponse } from 'next';

const isTokenValid = async (req: NextApiRequest, res: NextApiResponse) => {
    try {
        const { api, token } = req.body;
        const response = await fetch('http://192.168.100.205:8000/api/verify-token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${api}`,
                'Session': token
            },
        });

        console.log('Response status:', response.status);
        if (response.status === 200) {
            res.status(200).json({ valid: true });
        } else {
            res.status(401).json({ valid: false });
        }
    } catch (error) {
        console.error('Token validation failed:', error);
        res.status(500).json({ valid: false });
    }
}

export default isTokenValid;