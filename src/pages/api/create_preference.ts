import type { NextApiRequest, NextApiResponse } from "next";
import MercadoPagoConfig, { Preference } from "mercadopago";

// Inicializa cliente Mercado Pago (use sempre a PRIVATE KEY)
const client = new MercadoPagoConfig({
  accessToken: process.env.MP_ACCESS_TOKEN!, // ⚠️ PRIVATE token
});

// Define interface for incoming items to avoid 'any'
interface CartItem {
  id?: string | number; // Add ID to interface
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
    console.log("📩 Body recebido:", req.body);
    const { items } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: "Itens do carrinho inválidos ou vazios." });
    }

    const baseUrl = process.env.NEXT_PUBLIC_MP_URL; // seu ngrok

    const preference = new Preference(client);

    const result = await preference.create({
      body: {
        items: items.map((item: CartItem) => ({
          // Fix: 'id' is required by Mercado Pago SDK types
          id: item.id ? String(item.id) : "item-id", 
          title: String(item.title || "Item"),
          quantity: Number(item.quantity) || 1,
          unit_price: Number(item.unit_price) || 0,
          currency_id: "BRL",
        })),
        back_urls: {
          success: `${baseUrl}/api/success`,
          failure: `${baseUrl}/api/failure`,
          pending: `${baseUrl}/api/pending`,
        },
        auto_return: "approved",
        notification_url: `${baseUrl}/api/webhook`,
      },
    });

    console.log("✅ Preference criada:", result.id);

    return res.status(200).json({ id: result.id });
  } catch (err: unknown) {
    console.error("❌ Erro no create_preference:", err);
    const errorMessage = err instanceof Error ? err.message : "Erro desconhecido";
    return res.status(500).json({ error: errorMessage });
  }
}