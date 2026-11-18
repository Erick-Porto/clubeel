/**
 * Fotos dos espaços sociais (galeria montada pela equipe no painel da Lara).
 *
 * As fotos são arquivos estáticos da Lara (`images/galeria/...`), e o
 * navegador do sócio não alcança a Lara. Por isso a tela nunca usa `url` nem
 * `thumb_url` (que trazem o host da Lara): monta o endereço da rota
 * `/espacos-sociais/fotos/<path>`, que busca o arquivo do lado do servidor
 * (app/espacos-sociais/fotos/[...path]/route.ts).
 *
 * O validador fica aqui, e não só na rota, para que tela e rota recusem o
 * mesmo conjunto de caminhos: um `path` fora do padrão nem vira `<img>`.
 */

import { comBase } from "./base-path";

/** Prefixo da rota que entrega as fotos (sem o basePath). */
const ROTA_FOTOS = "/espacos-sociais/fotos";

/** Cada pedaço do caminho: letras, números, ponto, hífen e sublinhado. */
const SEGMENTO = /^[A-Za-z0-9._-]+$/;
const EXTENSAO = /\.(jpe?g|png|webp)$/i;

/**
 * Só `images/...` com extensão de imagem, sem `..`: assim a rota não vira um
 * proxy aberto para a Lara. Devolve os segmentos ou `null`.
 */
export function segmentosDeFoto(caminho: string | string[] | null | undefined): string[] | null {
    if (!caminho) return null;
    const segmentos = Array.isArray(caminho) ? caminho : caminho.replace(/^\/+/, "").split("/");
    if (segmentos.length < 2 || segmentos.length > 8) return null;
    if (segmentos[0] !== "images") return null;
    for (const segmento of segmentos) {
        if (!SEGMENTO.test(segmento) || segmento === "." || segmento === "..") return null;
    }
    if (!EXTENSAO.test(segmentos[segmentos.length - 1])) return null;
    return segmentos;
}

/** `images/galeria/12/abc.jpg` → `/espacos-sociais/fotos/images/galeria/12/abc.jpg` (com basePath). */
export function fotoSrc(caminho: string | null | undefined): string | null {
    const segmentos = segmentosDeFoto(caminho);
    if (!segmentos) return null;
    return comBase(`${ROTA_FOTOS}/${segmentos.map(encodeURIComponent).join("/")}`);
}

/** Foto da galeria, como a Lara manda (já na ordem certa e só as visíveis). */
export interface SocialPhoto {
    id: number;
    /** Caminho relativo na Lara (`images/galeria/12/abc.jpg`). É o que a tela usa. */
    path: string;
    thumb_path: string | null;
    /** Endereço com o host da Lara: só para conferência, nunca vai para o HTML. */
    url: string | null;
    width: number | null;
    height: number | null;
    caption: string | null;
}

/**
 * Origem da Lara como ela mesma se anunciou nas fotos (`url` = origem + `/` +
 * `path`). Serve só para reconhecer, na capa, um endereço que aponta para a
 * Lara. `null` se nenhuma foto permitir deduzir.
 */
function origemDaLara(fotos: SocialPhoto[]): string | null {
    for (const foto of fotos) {
        if (!foto.url) continue;
        const sufixo = `/${foto.path}`;
        if (foto.url.endsWith(sufixo)) return foto.url.slice(0, -sufixo.length);
    }
    return null;
}

/**
 * Endereço da capa (`image` do espaço) para a tela.
 *
 * A capa pode ser link externo (imgur, postimg), que o navegador abre direto,
 * ou um arquivo da própria Lara, que precisa passar pela rota de fotos. Quando
 * o endereço começa pela origem da Lara (deduzida das fotos), ele é trocado
 * pelo da rota; caso contrário é usado como veio, como sempre foi.
 */
export function capaSrc(imagem: string | null, fotos: SocialPhoto[]): string | null {
    if (!imagem) return null;
    const origem = origemDaLara(fotos);
    if (origem && imagem.startsWith(`${origem}/`)) {
        return fotoSrc(imagem.slice(origem.length + 1).split(/[?#]/)[0]);
    }
    return /^(https?:)?\/\//i.test(imagem) || imagem.startsWith("/") ? imagem : null;
}
