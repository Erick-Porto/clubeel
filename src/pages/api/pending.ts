import type { NextApiRequest, NextApiResponse } from "next"

export default function handler(req: any, res: any) {
  console.log("⏳ Pagamento pendente:", req.query)
  res.redirect("/checkout?status=pending")
}