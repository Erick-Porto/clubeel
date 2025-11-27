import type { NextApiRequest, NextApiResponse } from "next"

export default function handler(req: any, res: any) {
  console.log("❌ Pagamento falhou:", req.query)
  res.redirect("/checkout?status=failure")
}
