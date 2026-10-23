import type { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from "next-auth";
import { authOptions } from "../auth/[...nextauth]";
import { guardRequest } from "../../../utils/sanitize";

interface SessionWithToken {
    accessToken?: string;
}

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '4mb',
    },
  },
};

const API_URL = process.env.INTERNAL_LARA_API_URL;

// Endpoints que podem ser chamados SEM sessão (fluxos pré-login).
const PUBLIC_ENDPOINTS: RegExp[] = [
    /^login$/,
    /^register$/,
    /^check-member$/,
    /^change-password$/,
    // Replay: a galeria da quadra é aberta a qualquer visitante, por decisão de
    // negócio (o replay é do jogo, e o jogo aconteceu em espaço coletivo). A
    // Lara não devolve identificação de sócio nesses dois endpoints.
    /^replay\/places$/,
    /^replay\/places\/\d+\/videos$/,
    // Torneios: lista, detalhe e chaveamento divulgado são abertos a qualquer
    // visitante (a Lara só devolve o que está publicado; rascunho e cancelado
    // respondem 404). O filtro `place_group_id` fica na query, fora do `path`.
    /^tournaments$/,
    /^tournaments\/\d+$/,
    /^tournaments\/\d+\/categories\/\d+\/bracket$/,
    // Lançamento de resultados pela equipe do clube: não usa login de sócio —
    // a autorização é o código de lançamento do torneio, que vai no header
    // `Tournament-Code` (repassado só nestas rotas; ver STAFF_ENDPOINTS).
    /^tournaments\/\d+\/staff\/check$/,
    /^tournaments\/\d+\/staff\/matches$/,
    /^tournaments\/\d+\/staff\/matches\/\d+\/result$/,
];

// Rotas da equipe do torneio: recebem o `Tournament-Code` e NÃO recebem o
// Session de um sócio que por acaso esteja logado no mesmo navegador.
const STAFF_ENDPOINT = /^tournaments\/\d+\/staff\//;
// 8 letras e números, mostrado como ABCD-EFGH (maiúsculas, espaço e hífen
// não importam para a Lara). Qualquer outra coisa não é repassada.
const TOURNAMENT_CODE = /^[A-Za-z0-9 -]{1,20}$/;

// Endpoints que exigem sessão autenticada.
const AUTHENTICATED_ENDPOINTS: RegExp[] = [
    /^verify-token$/,
    /^schedule(\/.*)?$/,
    /^place\/[^/]+$/,
    /^places(\/.*)?$/,
    /^member\/update$/,
    // "Meus vídeos" é do sócio logado: exige o header Session, que só sai daqui
    // com sessão válida.
    /^replay\/my-videos$/,
    // Luz da quadra: o sócio é sempre o dono do Session — nenhum desses
    // endpoints recebe id de sócio. Lista fechada, um caminho por regex.
    /^lighting\/availability$/,
    /^lighting\/groups$/,
    /^lighting\/groups\/\d+\/places$/,
    /^lighting\/places\/\d+\/activate$/,
    /^lighting\/release$/,
    /^lighting\/activations$/,
    // Espaços sociais (churrasqueiras, salões): o dono da reserva é sempre o
    // Session — nenhum endpoint recebe id/CPF de sócio, e reserva de outro
    // sócio responde 404. A query (`place_id`, `month`, `place_group_id`) não
    // entra no teste da regex: ela fica fora do `path`.
    /^social\/groups$/,
    /^social\/groups\/\d+\/places$/,
    /^social\/availability$/,
    /^social\/beverages$/,
    /^social\/furniture$/,
    /^social\/limits$/,
    /^social\/bookings$/,
    /^social\/bookings\/\d+$/,
    /^social\/bookings\/\d+\/guests$/,
    // Torneios (sócio): o inscrito, o capitão e o convidado são sempre o dono
    // do Session — nenhum corpo leva id/CPF de sócio (a Lara ignora). A busca
    // de convidado recebe `title`/`cpf` na query e devolve uma `ref` opaca.
    // `tournaments/payment` fica FORA de propósito: só o servidor chama
    // (pages/api/success.ts), depois de verificar a transação na eRede.
    /^tournaments\/\d+\/eligibility$/,
    /^tournaments\/\d+\/registrations$/,
    /^tournaments\/my-registrations$/,
    /^tournaments\/registrations\/\d+$/,
    /^tournaments\/my-teams$/,
    /^tournaments\/categories\/\d+\/teams$/,
    /^tournaments\/member-lookup$/,
    /^tournaments\/teams\/\d+\/invites$/,
    /^tournaments\/invites\/\d+$/,
    /^tournaments\/my-invites$/,
    /^tournaments\/invites\/\d+\/accept$/,
    /^tournaments\/invites\/\d+\/decline$/,
];

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    const appToken = process.env.INTERNAL_LARA_API_TOKEN;

    const { path } = req.query;
    const segments = Array.isArray(path) ? path : path ? [String(path)] : [];

    // Bloqueia path traversal e segmentos vazios.
    if (segments.length === 0 || segments.some((s) => s === '' || s === '.' || s === '..' || s.includes('..') || s.includes('/') || s.includes('\\'))) {
        return res.status(400).json({ error: "Path inválido." });
    }

    const pathString = segments.join('/');

    // Allowlist: rejeita qualquer endpoint não previsto.
    const isPublic = PUBLIC_ENDPOINTS.some((re) => re.test(pathString));
    const isAuthenticated = AUTHENTICATED_ENDPOINTS.some((re) => re.test(pathString));
    if (!isPublic && !isAuthenticated) {
        return res.status(403).json({ error: "Endpoint não permitido." });
    }

    // Endpoints autenticados EXIGEM sessão válida — sem sessão, não repassa o
    // token privilegiado da aplicação.
    const session = await getServerSession(req, res, authOptions);
    const accessToken = (session as unknown as SessionWithToken | null)?.accessToken;
    if (isAuthenticated && !accessToken) {
        return res.status(401).json({ error: "Não autorizado." });
    }

    // Barreira anti-injeção: rejeita prototype pollution, chaves de operador
    // (NoSQL), bytes de controle/NUL e payloads absurdos antes de repassar.
    if (!guardRequest(req, res)) return;

    const queryParams = { ...req.query };
    delete queryParams.path;

    const searchParams = new URLSearchParams();
    Object.entries(queryParams).forEach(([key, value]) => {
        if (Array.isArray(value)) {
            value.forEach((v) => searchParams.append(key, v));
        } else if (typeof value === 'string') {
            searchParams.append(key, value);
        }
    });

    const queryString = searchParams.toString();
    const destUrl = `${API_URL}/api/${pathString}${queryString ? `?${queryString}` : ''}`;

    const headers = new Headers();
    headers.set("Content-Type", "application/json");
    headers.set("Accept", "application/json");
    headers.set("Authorization", `Bearer ${appToken}`);

    if (STAFF_ENDPOINT.test(pathString)) {
        const rawCode = req.headers["tournament-code"];
        const code = Array.isArray(rawCode) ? rawCode[0] : rawCode;
        if (code && TOURNAMENT_CODE.test(code)) headers.set("Tournament-Code", code);
    } else if (accessToken) {
        headers.set("Session", accessToken);
    }

    let body: BodyInit | null = null;
    if (req.method !== 'GET' && req.method !== 'HEAD' && req.body) {
        body = typeof req.body === 'object' ? JSON.stringify(req.body) : req.body;
    }

    try {
        const response = await fetch(destUrl, {
            method: req.method,
            headers: headers,
            body: body,
        });

        const contentType = response.headers.get("content-type");
        const isJson = contentType && contentType.includes("application/json");

        if (isJson) {
            const data = await response.json();
            return res.status(response.status).json(data);
        } 
        
        const textData = await response.text();
        
        if (!response.ok) {
            return res.status(response.status).json({
                message: "Erro na API Backend (Retorno não-JSON)",
                raw_response: textData.substring(0, 100)
            });
        }

        return res.status(response.status).send(textData);

    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";        
        return res.status(502).json({ 
            message: "Proxy Connection Failed", 
            error: errorMessage 
        });
    }
}