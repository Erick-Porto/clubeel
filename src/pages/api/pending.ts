import type { NextApiRequest, NextApiResponse } from 'next';

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  console.log("⏳ Pagamento pendente:", req.query)
  res.redirect("/checkout?status=pending")
}