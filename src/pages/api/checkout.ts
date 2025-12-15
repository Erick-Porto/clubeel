import type { NextApiRequest, NextApiResponse } from 'next';

const MP_TOKEN = process.env.MP_ACCESS_TOKEN || process.env.NEXT_PUBLIC_MP_ACCESS_TOKEN || '';
if (!MP_TOKEN) {
  console.warn('Mercado Pago access token não configurado (env MP_ACCESS_TOKEN ou NEXT_PUBLIC_MP_ACCESS_TOKEN)');
}

interface PreferenceItem {
  id?: string;
  title: string;
  currency_id?: string;
  picture_url?: string;
  description?: string;
  category_id?: string;
  quantity: number;
  unit_price: number;
  [key: string]: unknown;
}

interface PreferenceBody {
  items: PreferenceItem[];
  back_urls?: {
    success: string;
    failure: string;
    pending: string;
  };
  auto_return?: string;
  [key: string]: unknown; // Allow other properties for flexibility
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { items } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Carrinho vazio' });
    }

    // Typed body
    const baseBody: PreferenceBody = {
      items,
      back_urls: {
        success: `${process.env.NEXT_PUBLIC_MP_URL}/success` || 'http://localhost:3000/success',
        failure: `${process.env.NEXT_PUBLIC_MP_URL}/failure` || 'http://localhost:3000/failure',
        pending: `${process.env.NEXT_PUBLIC_MP_URL}/pending` || 'http://localhost:3000/pending',
      },
      // não enviar auto_return por padrão para evitar validações estranhas em alguns ambientes
      // auto_return: 'approved',
    };

    // função para criar preferência via REST with typed argument
    const createPreference = async (body: PreferenceBody) => {
      const mpRes = await fetch('https://api.mercadopago.com/checkout/preferences', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${MP_TOKEN}`,
        },
        body: JSON.stringify(body),
      });
      const data = await mpRes.json().catch(() => null);
      return { ok: mpRes.ok, status: mpRes.status, data };
    };

    // primeiro intento: com baseBody (sem auto_return)
    let result = await createPreference(baseBody);

    // se erro específico de auto_return, tentar novamente com auto_return removido/ajustado
    if (!result.ok && result.data) {
      const msg = (result.data && result.data.message) || '';
      const errorStr = result.data.error ? String(result.data.error) : '';

      if (msg.toLowerCase().includes('auto_return') || errorStr.toLowerCase().includes('auto_return')) {
        console.warn('Erro relacionado a auto_return detectado, tentando criar preferência sem auto_return:', result.data);
        // garantir que não exista auto_return e tentar novamente
        const fallbackBody = { ...baseBody };
        delete fallbackBody.auto_return;
        result = await createPreference(fallbackBody);
      }
    }

    if (!result.ok) {
      console.error('Erro ao criar preferência Mercado Pago (final):', result);
      return res.status(result.status || 500).json({ error: result.data || 'Erro ao criar preferência' });
    }

    return res.status(200).json({ preferenceId: result.data && result.data.id });
  } catch (error: unknown) {
    // Type narrowing for error
    console.error('Erro no checkout (catch):', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro interno';
    return res.status(500).json({ error: errorMessage });
  }
}