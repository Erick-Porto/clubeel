import type { NextApiRequest, NextApiResponse } from 'next';
import path from 'path';
import fs from 'fs';

export default function CarouselHandler(req: NextApiRequest, res: NextApiResponse) {
  const directoryPath = path.join(process.cwd(), 'public/images/carousel');
  const files = fs.readdirSync(directoryPath);
  res.status(200).json(files);
}
