import type { NextApiRequest, NextApiResponse } from "next";
import MercadoPagoConfig, { Preference } from "mercadopago";

const client = new MercadoPagoConfig({
  accessToken: process.env.MP_ACCESS_TOKEN!,
});

interface CartItem {
  id?: string | number; 
  title: string;
  quantity: number;
  unit_price: number;
  [key: string]: unknown;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Método não permitido" });
  }

  try {
    const { items, schedule_ids } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: "Itens inválidos." });
    }

    const baseUrl = process.env.NEXT_PUBLIC_MP_URL;
    
    const schedulesString = Array.isArray(schedule_ids) ? schedule_ids.join(',') : '';

    const preference = new Preference(client);

    const result = await preference.create({
      body: {
        items: items.map((item: CartItem) => ({
          id: item.id ? String(item.id) : "item-id", 
          title: String(item.title).substring(0, 255),
          quantity: Number(item.quantity) || 1,
          unit_price: Number(item.unit_price) || 0,
          currency_id: "BRL",
        })),
        statement_descriptor: "CLUBE DOS FUNCIONARIOS",
        metadata: {
            schedules: schedulesString,
            source: "web_checkout"
        },
        back_urls: {
          success: `${baseUrl}/api/success`,
          failure: `${baseUrl}/api/failure`,
          pending: `${baseUrl}/api/pending`,
        },
        auto_return: "approved",
        notification_url: `${baseUrl}/api/webhook`,
      },
    });
    console.log("✅ create_preference:");
    return res.status(200).json({ id: result.id });
  } catch (err: unknown) {
    console.error("❌ Erro no create_preference:", err);
    return res.status(500).json({ error: "Erro ao criar preferência" });
  }
}