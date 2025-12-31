import { NextApiRequest, NextApiResponse } from "next";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST');
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        const eredeRes = await fetch('https://rl7-sandbox-api.useredecloud.com.br/oauth2/token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Authorization': 'Basic ' + Buffer.from(`${process.env.INTERNAL_EREDE_CLIENT_ID}:${process.env.INTERNAL_EREDE_SECRET_ID}`).toString('base64'),
            },
            body: new URLSearchParams({
                grant_type: 'client_credentials',
            }),
        });
        const data = await eredeRes.json();

        if (!eredeRes.ok) {
            return res.status(eredeRes.status).json({ error: data });
        }

        return res.status(200).json(data);
    } catch (error) {
        console.error('Error creating eRede OAuth2 token:', error);
        return res.status(500).json({ error: 'Internal Server Error' });
    }
};
