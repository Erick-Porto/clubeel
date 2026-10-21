'use client';

/**
 * Etapa 5 — leitura. O PDF que a pessoa vai assinar (bytes da Lara, repassados
 * pelo Next) desenhado pelo PDF.js, página a página, na largura da tela.
 *
 * Mede o tempo com o documento na tela (só com a aba visível) e se a pessoa
 * rolou até o fim. Os números vão para a Lara em `visualizado` e de novo no
 * `assinar`; o front não exige um mínimo — isso é regra da Lara, se houver.
 *
 * O PDF fica só na memória da aba (nada de cache, blob salvo ou download) e é
 * buscado de novo quando `pdf_version` muda (depois das respostas).
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faArrowDown,
  faCheck,
  faMagnifyingGlassMinus,
  faMagnifyingGlassPlus,
  faRotateRight,
  faSpinner,
  faTriangleExclamation,
} from '@fortawesome/free-solid-svg-icons';
import type { PDFDocumentProxy, RenderTask } from 'pdfjs-dist/legacy/build/pdf.mjs';
import styles from '../../../../styles/assinatura.module.css';
import { Note } from '../../../components/UI/ui';
import { baixarPdf } from '../cliente';
import { carregarPdfJs } from '../pdf';
import type { Recusa } from '../tipos';

export interface Leitura {
  segundos: number;
  fim: boolean;
}

interface Props {
  versao: string | null;
  inicial: Leitura;
  tratar: (recusa: Recusa) => boolean;
  /** Ao sair da leitura (Continuar): o pai registra o `visualizado`. */
  aoContinuar: (leitura: Leitura) => Promise<void>;
  ocupado: boolean;
  erroAoContinuar: string | null;
}

const ZOOMS = [1, 1.5, 2] as const;

export default function EtapaLeitura({ versao, inicial, tratar, aoContinuar, ocupado, erroAoContinuar }: Props) {
  const [estado, setEstado] = useState<'carregando' | 'pronto' | 'erro'>('carregando');
  const [erro, setErro] = useState<string | null>(null);
  const [paginas, setPaginas] = useState(0);
  const [desenhadas, setDesenhadas] = useState(0);
  const [zoom, setZoom] = useState<number>(1);
  const [largura, setLargura] = useState(0);
  const [fim, setFim] = useState(inicial.fim);
  const [tentativa, setTentativa] = useState(0);

  const documentoRef = useRef<PDFDocumentProxy | null>(null);
  const caixaRef = useRef<HTMLDivElement>(null);
  const canvasRefs = useRef<(HTMLCanvasElement | null)[]>([]);
  const fimRef = useRef<HTMLDivElement>(null);
  const segundosRef = useRef(inicial.segundos);

  // Carrega o PDF (de novo quando a versão muda ou a pessoa pede).
  useEffect(() => {
    let cancelado = false;
    setEstado('carregando');
    setErro(null);
    setPaginas(0);
    setDesenhadas(0);

    (async () => {
      const resposta = await baixarPdf();
      if (cancelado) return;
      if (!resposta.ok) {
        if (tratar(resposta.recusa)) return;
        setErro(resposta.recusa.error);
        setEstado('erro');
        return;
      }
      try {
        const pdfjs = await carregarPdfJs();
        const documento = await pdfjs.getDocument({
          data: new Uint8Array(resposta.data),
          isEvalSupported: false,
        }).promise;
        if (cancelado) {
          void documento.destroy();
          return;
        }
        documentoRef.current?.destroy();
        documentoRef.current = documento;
        setPaginas(documento.numPages);
        setEstado('pronto');
      } catch {
        if (cancelado) return;
        setErro('Não foi possível abrir o documento neste aparelho. Tente de novo.');
        setEstado('erro');
      }
    })();

    return () => {
      cancelado = true;
    };
  }, [versao, tentativa, tratar]);

  // Libera a memória do documento ao sair da etapa.
  useEffect(() => () => {
    documentoRef.current?.destroy();
    documentoRef.current = null;
  }, []);

  // Largura disponível (muda ao girar o celular).
  useEffect(() => {
    const caixa = caixaRef.current;
    if (!caixa) return;
    const medir = () => setLargura(Math.floor(caixa.clientWidth));
    medir();
    const observador = new ResizeObserver(() => medir());
    observador.observe(caixa);
    return () => observador.disconnect();
  }, []);

  // Desenha as páginas, uma de cada vez.
  useEffect(() => {
    const documento = documentoRef.current;
    if (estado !== 'pronto' || !documento || !largura || !paginas) return;
    let cancelado = false;
    let tarefa: RenderTask | null = null;
    setDesenhadas(0);

    (async () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 3);
      for (let numero = 1; numero <= paginas; numero += 1) {
        if (cancelado) return;
        const pagina = await documento.getPage(numero);
        const base = pagina.getViewport({ scale: 1 });
        const escala = (largura / base.width) * zoom;
        const viewport = pagina.getViewport({ scale: escala * dpr });
        const canvas = canvasRefs.current[numero - 1];
        const contexto = canvas?.getContext('2d');
        if (!canvas || !contexto) continue;
        canvas.width = Math.floor(viewport.width);
        canvas.height = Math.floor(viewport.height);
        canvas.style.width = `${Math.floor(viewport.width / dpr)}px`;
        canvas.style.height = `${Math.floor(viewport.height / dpr)}px`;
        tarefa = pagina.render({ canvasContext: contexto, viewport });
        try {
          await tarefa.promise;
        } catch {
          return; // cancelado por novo zoom/largura
        }
        if (!cancelado) setDesenhadas(numero);
      }
    })();

    return () => {
      cancelado = true;
      tarefa?.cancel();
    };
  }, [estado, paginas, largura, zoom]);

  // Tempo de leitura: só conta com a aba visível e o documento na tela.
  useEffect(() => {
    if (estado !== 'pronto') return;
    const relogio = window.setInterval(() => {
      if (document.visibilityState === 'visible') segundosRef.current += 1;
    }, 1000);
    return () => window.clearInterval(relogio);
  }, [estado]);

  // Rolou até o fim: a marca depois da última página apareceu na tela.
  useEffect(() => {
    const marca = fimRef.current;
    if (!marca || estado !== 'pronto' || desenhadas < paginas || paginas === 0) return;
    const observador = new IntersectionObserver((entradas) => {
      if (entradas.some((e) => e.isIntersecting)) setFim(true);
    });
    observador.observe(marca);
    return () => observador.disconnect();
  }, [estado, desenhadas, paginas]);

  const continuar = useCallback(() => {
    void aoContinuar({ segundos: segundosRef.current, fim });
  }, [aoContinuar, fim]);

  const indiceZoom = ZOOMS.indexOf(zoom as (typeof ZOOMS)[number]);

  return (
    <section className={styles.cartao} aria-labelledby="titulo-leitura">
      <h1 id="titulo-leitura" className={styles.titulo}>Leia o documento</h1>
      <p className={styles.lead}>
        Leia com atenção até o fim. Se a letra estiver pequena, use os botões de aumentar.
      </p>

      <div className={styles.pdfBarra}>
        <span>
          {estado === 'pronto' ? `${paginas} ${paginas === 1 ? 'página' : 'páginas'}` : ' '}
        </span>
        <div className={styles.zoom}>
          <button
            type="button"
            onClick={() => setZoom(ZOOMS[Math.max(0, indiceZoom - 1)])}
            disabled={indiceZoom <= 0}
            aria-label="Diminuir"
          >
            <FontAwesomeIcon icon={faMagnifyingGlassMinus} />
          </button>
          <button
            type="button"
            onClick={() => setZoom(ZOOMS[Math.min(ZOOMS.length - 1, indiceZoom + 1)])}
            disabled={indiceZoom >= ZOOMS.length - 1}
            aria-label="Aumentar"
          >
            <FontAwesomeIcon icon={faMagnifyingGlassPlus} />
          </button>
        </div>
      </div>

      <div ref={caixaRef} className={styles.pdf} data-testid="pdf">
        {estado === 'carregando' && (
          <div className={styles.carregando} role="status">
            <FontAwesomeIcon icon={faSpinner} spin /> Carregando o documento…
          </div>
        )}
        {estado === 'erro' && (
          <>
            <div className={styles.aviso} role="alert">
              <Note tone="danger" icon={faTriangleExclamation}>{erro}</Note>
            </div>
            <button
              type="button"
              className={`${styles.botao} ${styles.botaoSecundario}`}
              onClick={() => setTentativa((n) => n + 1)}
            >
              <FontAwesomeIcon icon={faRotateRight} /> Tentar de novo
            </button>
          </>
        )}
        {estado === 'pronto' &&
          Array.from({ length: paginas }, (_, i) => (
            <canvas
              key={`${versao}-${i}`}
              ref={(el) => {
                canvasRefs.current[i] = el;
              }}
              className={styles.pdfPagina}
              role="img"
              aria-label={`Página ${i + 1} de ${paginas}`}
            />
          ))}
        <div ref={fimRef} className={styles.pdfFim} aria-hidden="true" />
      </div>

      {estado === 'pronto' && (
        <p className={styles.lead} role="status" data-testid="fim-leitura">
          {fim ? (
            <><FontAwesomeIcon icon={faCheck} /> Você chegou ao fim do documento.</>
          ) : (
            <><FontAwesomeIcon icon={faArrowDown} /> Role até o fim para ler o documento inteiro.</>
          )}
        </p>
      )}

      {erroAoContinuar && (
        <div className={styles.aviso} role="alert">
          <Note tone="danger" icon={faTriangleExclamation}>{erroAoContinuar}</Note>
        </div>
      )}

      <button
        type="button"
        className={`${styles.botao} ${styles.botaoPrincipal}`}
        onClick={continuar}
        disabled={estado !== 'pronto' || ocupado}
      >
        {ocupado && <FontAwesomeIcon icon={faSpinner} spin />}
        Li o documento, continuar
      </button>
    </section>
  );
}
