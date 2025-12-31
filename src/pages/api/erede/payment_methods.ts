import { NextApiRequest, NextApiResponse } from "next";

const REDE_CLIENT_ID = process.env.INTERNAL_EREDE_CLIENT_ID;
const REDE_CLIENT_SECRET = process.env.INTERNAL_EREDE_SECRET_ID;
const BASE_URL = process.env.INTERNAL_EREDE_API_URL;
const AUTH_URL = process.env.INTERNAL_EREDE_AUTH_URL;

// 1. Definimos a interface para substituir o 'any' do payload
interface ERedePayload {
    capture: boolean;
    reference: string;
    amount: number;
    kind?: string; // "Pix", "debit" ou "credit"
    qrCode?: {
        dateTimeExpiration: string;
    };
    cardNumber?: string;
    cardHolderName?: string;
    expirationMonth?: number;
    expirationYear?: number;
    securityCode?: string;
    installments?: number;
    softDescriptor?: string;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST');
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        const { method, cardData, amount } = req.body;

        if (!REDE_CLIENT_ID || !REDE_CLIENT_SECRET || !AUTH_URL || !BASE_URL) {
            return res.status(500).json({ error: "Credenciais não configuradas." });
        }

        // 1. Auth
        const credentials = Buffer.from(`${REDE_CLIENT_ID}:${REDE_CLIENT_SECRET}`).toString('base64');
        const params = new URLSearchParams();
        params.append('grant_type', 'client_credentials');

        const authResponse = await fetch(AUTH_URL, {
            method: 'POST',
            headers: {
                'Authorization': `Basic ${credentials}`,
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: params.toString()
        });

        if (!authResponse.ok) {
            throw new Error(`Auth Error: ${authResponse.status}`);
        }

        const { access_token } = await authResponse.json();

        // 2. Payload
        const reference = `ORD-${Date.now()}`;
        
        // CORREÇÃO: Substituído 'any' pela interface ERedePayload
        const payload: ERedePayload = {
            capture: true,
            reference: reference,
            amount: amount, 
        };

        if (method === 'pix') {
            payload.kind = "Pix";
            const expirationDate = new Date(Date.now() + 30 * 60000); // +30 min
            const expirationString = expirationDate.toISOString().split('.')[0];

            payload.qrCode = {
                dateTimeExpiration: expirationString
            };
        } else {
            payload.kind = method === 'debit' ? 'debit' : 'credit';
            let expMonth = 0;
            let expYear = 0;
            if (cardData.expiry?.includes('/')) {
                const parts = cardData.expiry.split('/');
                expMonth = parseInt(parts[0], 10);
                expYear = parseInt(`20${parts[1]}`, 10);
            }
            payload.cardNumber = cardData.number?.replace(/\s/g, '');
            payload.cardHolderName = cardData.holder;
            payload.expirationMonth = expMonth;
            payload.expirationYear = expYear;
            payload.securityCode = cardData.cvv;
            payload.installments = 1; 
            payload.softDescriptor = "Espacos CFCSN"; 
        }

        // 3. Transação
        const transactionResponse = await fetch(`${BASE_URL}/transactions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${access_token}`
            },
            body: JSON.stringify(payload)
        });

        const transactionData = await transactionResponse.json();

        if (!transactionResponse.ok) {
            return res.status(400).json({ error: transactionData.returnMessage || 'Erro', details: transactionData });
        }

        return res.status(200).json(transactionData);

    // CORREÇÃO: Substituído 'error: any' por 'error: unknown' e tratamento seguro
    } catch (error: unknown) {
        console.error(error);
        const message = error instanceof Error ? error.message : 'Erro desconhecido';
        return res.status(500).json({ error: message });
    }
}