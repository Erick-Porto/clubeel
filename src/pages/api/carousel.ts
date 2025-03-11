import type { NextApiRequest, NextApiResponse } from 'next';
import path from 'path';
import fs from 'fs';

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  const directoryPath = path.join(process.cwd(), 'public/images/carousel'); // Corrigido o caminho das imagens
  const files = fs.readdirSync(directoryPath);
  res.status(200).json(files);
}
