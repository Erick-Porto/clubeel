import type { NextApiRequest, NextApiResponse } from "next";

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  console.log("❌ Pagamento falhou:", req.query);
  res.redirect("/checkout?status=failure");
}