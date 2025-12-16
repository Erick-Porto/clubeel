// pages/api/webhook.ts (Next.js)
import type { NextApiRequest, NextApiResponse } from "next";
import MercadoPagoConfig, { Payment } from "mercadopago";

const client = new MercadoPagoConfig({ accessToken: process.env.MP_ACCESS_TOKEN || "" });

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // console.log("📩 WEBHOOK - query:", req.query);
  // console.log("📩 WEBHOOK - body:", req.body);

  const id = req.query.id || req.query.payment_id || req.body?.data?.id || req.body?.id;
  if (id) {
    try {
      const payment = new Payment(client);
      
      // CORREÇÃO 1: Removemos "const detail =" pois não é usada
      // Mantemos o await para garantir que a chamada à API ocorra
      await payment.get({ id: String(id) });
      
      // console.log("✅ PAYMENT DETAILS:", detail);
      console.log("✅ PAYMENT");
    } catch { 
      // CORREÇÃO 2: Removemos "(err)" do catch (Optional Catch Binding)
      // console.error("❌ Erro consultando pagamento:", err);
      console.error("❌ Erro consultando pagamento");
    }
  }

  res.status(200).send("ok");
}