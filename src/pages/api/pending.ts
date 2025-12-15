import type { NextApiRequest, NextApiResponse } from 'next';
import { toast } from 'react-toastify';

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  toast.info("⏳ Pagamento pendente: " + JSON.stringify(req.query));
  res.redirect("/checkout?status=pending")
}