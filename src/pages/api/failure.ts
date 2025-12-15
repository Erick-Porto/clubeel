import type { NextApiRequest, NextApiResponse } from "next";
import { toast } from "react-toastify";

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  toast.error("❌ Pagamento falhou: " + JSON.stringify(req.query));
  res.redirect("/checkout?status=failure");
}