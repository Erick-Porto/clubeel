'use client';

/**
 * Quadro de assinatura com o dedo (etapas 7 e 8: assinatura e visto).
 *
 * Pointer events (dedo, caneta e mouse com o mesmo código) e
 * `touch-action: none` no canvas, para o arrastar do dedo desenhar em vez de
 * rolar a página. Guarda cada traço com os pontos (`x`, `y` em pixels CSS do
 * canvas, `t` em ms desde o primeiro toque): a Lara usa os pontos como
 * evidência e confere o mínimo (30 na assinatura, 8 no visto — um toque não é
 * assinatura). O botão Continuar só habilita a partir desse mínimo.
 *
 * A imagem sai em PNG com fundo transparente. O "papel" (`--pad`) e a tinta
 * (`--pad-ink`) não trocam no tema escuro: o traço vai para dentro do PDF, que
 * é branco.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faEraser } from '@fortawesome/free-solid-svg-icons';
import styles from '../../../../styles/assinatura.module.css';
import type { Desenho, Ponto, Traco } from '../tipos';

interface Props {
  titulo: string;
  instrucao: string;
  minimo: number;
  visto?: boolean;
  inicial: Desenho | null;
  aoContinuar: (desenho: Desenho) => void;
}

const ESPESSURA = 2.6;

function arredondar(n: number): number {
  return Math.round(n * 10) / 10;
}

export default function QuadroAssinatura({ titulo, instrucao, minimo, visto, inicial, aoContinuar }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const tracosRef = useRef<Traco[]>(inicial?.tracos.map((t) => ({ points: [...t.points] })) ?? []);
  const atualRef = useRef<Traco | null>(null);
  const inicioRef = useRef<number | null>(null);
  const [pontos, setPontos] = useState(() => tracosRef.current.reduce((s, t) => s + t.points.length, 0));

  const contexto = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return null;
    const tinta = getComputedStyle(canvas).getPropertyValue('--pad-ink').trim() || 'black';
    ctx.strokeStyle = tinta;
    ctx.fillStyle = tinta;
    ctx.lineWidth = ESPESSURA;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    return ctx;
  }, []);

  const desenharTraco = useCallback((ctx: CanvasRenderingContext2D, traco: Traco) => {
    const p = traco.points;
    if (p.length === 0) return;
    if (p.length === 1) {
      ctx.beginPath();
      ctx.arc(p[0].x, p[0].y, ESPESSURA / 2, 0, Math.PI * 2);
      ctx.fill();
      return;
    }
    ctx.beginPath();
    ctx.moveTo(p[0].x, p[0].y);
    for (let i = 1; i < p.length; i += 1) ctx.lineTo(p[i].x, p[i].y);
    ctx.stroke();
  }, []);

  /** Ajusta o canvas ao tamanho na tela (nítido em tela de alta densidade) e redesenha. */
  const preparar = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const caixa = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    canvas.width = Math.max(1, Math.round(caixa.width * dpr));
    canvas.height = Math.max(1, Math.round(caixa.height * dpr));
    const ctx = contexto();
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, caixa.width, caixa.height);
    for (const traco of tracosRef.current) desenharTraco(ctx, traco);
  }, [contexto, desenharTraco]);

  useEffect(() => {
    preparar();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const observador = new ResizeObserver(() => preparar());
    observador.observe(canvas);
    return () => observador.disconnect();
  }, [preparar]);

  function pontoDe(evento: { clientX: number; clientY: number }): Ponto {
    const caixa = canvasRef.current!.getBoundingClientRect();
    const agora = performance.now();
    if (inicioRef.current === null) inicioRef.current = agora;
    return {
      x: arredondar(evento.clientX - caixa.left),
      y: arredondar(evento.clientY - caixa.top),
      t: Math.round(agora - inicioRef.current),
    };
  }

  function aoBaixar(evento: React.PointerEvent<HTMLCanvasElement>) {
    if (evento.pointerType === 'mouse' && evento.button !== 0) return;
    evento.preventDefault();
    evento.currentTarget.setPointerCapture(evento.pointerId);
    const traco: Traco = { points: [pontoDe(evento)] };
    atualRef.current = traco;
    tracosRef.current.push(traco);
    const ctx = contexto();
    if (ctx) desenharTraco(ctx, traco);
    setPontos((n) => n + 1);
  }

  function aoMover(evento: React.PointerEvent<HTMLCanvasElement>) {
    const traco = atualRef.current;
    if (!traco) return;
    evento.preventDefault();
    const nativo = evento.nativeEvent;
    const eventos = typeof nativo.getCoalescedEvents === 'function' ? nativo.getCoalescedEvents() : [];
    const novos = (eventos.length ? eventos : [nativo]).map(pontoDe);
    const ctx = contexto();
    if (ctx) {
      const anterior = traco.points[traco.points.length - 1];
      ctx.beginPath();
      ctx.moveTo(anterior.x, anterior.y);
      for (const p of novos) ctx.lineTo(p.x, p.y);
      ctx.stroke();
    }
    traco.points.push(...novos);
    setPontos((n) => n + novos.length);
  }

  function aoSoltar() {
    atualRef.current = null;
  }

  function limpar() {
    tracosRef.current = [];
    atualRef.current = null;
    inicioRef.current = null;
    setPontos(0);
    preparar();
  }

  function continuar() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    aoContinuar({
      png: canvas.toDataURL('image/png'),
      tracos: tracosRef.current.map((t) => ({ points: t.points.map((p) => ({ ...p })) })),
    });
  }

  const pronto = pontos >= minimo;

  return (
    <section className={styles.cartao} aria-labelledby="titulo-quadro">
      <h1 id="titulo-quadro" className={styles.titulo}>{titulo}</h1>
      <p className={styles.lead}>{instrucao}</p>

      <div className={styles.quadro}>
        <canvas
          ref={canvasRef}
          className={`${styles.quadroCanvas} ${visto ? styles.quadroVisto : ''}`}
          onPointerDown={aoBaixar}
          onPointerMove={aoMover}
          onPointerUp={aoSoltar}
          onPointerCancel={aoSoltar}
          onLostPointerCapture={aoSoltar}
          role="img"
          aria-label={visto ? 'Quadro para o visto' : 'Quadro para a assinatura'}
          data-testid="quadro"
        />
        <div className={styles.quadroLinha} aria-hidden="true" />
        {pontos === 0 && (
          <div className={styles.quadroDica} aria-hidden="true">
            {visto ? 'Faça seu visto aqui' : 'Assine aqui'}
          </div>
        )}
      </div>

      {!pronto && pontos > 0 && (
        <p className={styles.contadorPontos} role="status">
          Continue o traço: {visto ? 'o visto' : 'a assinatura'} ainda está curto demais.
        </p>
      )}

      <div className={styles.acoesLinha}>
        <button
          type="button"
          className={`${styles.botao} ${styles.botaoSecundario}`}
          onClick={limpar}
          disabled={pontos === 0}
        >
          <FontAwesomeIcon icon={faEraser} /> Limpar
        </button>
        <button
          type="button"
          className={`${styles.botao} ${styles.botaoPrincipal}`}
          onClick={continuar}
          disabled={!pronto}
        >
          Continuar
        </button>
      </div>
    </section>
  );
}
