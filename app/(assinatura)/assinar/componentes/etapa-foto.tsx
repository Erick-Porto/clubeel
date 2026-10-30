'use client';

/**
 * Etapa 9 — foto. Câmera frontal ao vivo; a pessoa toca em "Tirar foto",
 * conta 3 s e captura. Mesmo formato do tablet do balcão: quadrado de 600×600,
 * JPEG a 0,82. A câmera é desligada logo depois da captura (e ao sair da
 * etapa, de qualquer jeito).
 *
 * A foto fica só na memória da aba até o envio.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCamera, faRotateRight, faSpinner, faTriangleExclamation } from '@fortawesome/free-solid-svg-icons';
import styles from '../../../../styles/assinatura.module.css';
import { Note } from '../../../components/UI/ui';

const LADO = 600;
const QUALIDADE = 0.82;
const CONTAGEM = 3;
const MAXIMO_BYTES = 4 * 1024 * 1024;

interface Props {
  inicial: string | null;
  aoContinuar: (foto: string) => void;
}

/**
 * O navegador interno de um aplicativo pode não dar acesso à câmera. "Abrir no
 * navegador" levaria só /assinar, sem o cookie do link: por isso copiar o link.
 */
const OUTRO_NAVEGADOR =
  'Se você abriu o link por dentro de um aplicativo, como o WhatsApp, copie o link da mensagem e cole no navegador do celular (Chrome ou Safari).';

function mensagemDeErro(erro: unknown): string {
  const nome = erro instanceof DOMException ? erro.name : '';
  if (nome === 'NotAllowedError' || nome === 'SecurityError') {
    return `O acesso à câmera foi negado. Libere a câmera para este site nas configurações do navegador e toque em "Tentar de novo". ${OUTRO_NAVEGADOR}`;
  }
  if (nome === 'NotFoundError' || nome === 'OverconstrainedError') {
    return `Não encontramos uma câmera. ${OUTRO_NAVEGADOR} Se o aparelho não tiver câmera, abra o link em outro que tenha.`;
  }
  if (nome === 'NotReadableError') {
    return 'A câmera está sendo usada por outro aplicativo. Feche-o e toque em "Tentar de novo".';
  }
  return `Não foi possível ligar a câmera. Toque em "Tentar de novo". ${OUTRO_NAVEGADOR}`;
}

export default function EtapaFoto({ inicial, aoContinuar }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [foto, setFoto] = useState<string | null>(inicial);
  const [estado, setEstado] = useState<'ligando' | 'aovivo' | 'contando' | 'pronta' | 'erro'>(
    inicial ? 'pronta' : 'ligando'
  );
  const [contagem, setContagem] = useState(CONTAGEM);
  const [erro, setErro] = useState<string | null>(null);

  const desligar = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  const ligar = useCallback(async () => {
    desligar();
    setErro(null);
    setEstado('ligando');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 960 } },
        audio: false,
      });
      streamRef.current = stream;
      const video = videoRef.current;
      if (video) {
        video.srcObject = stream;
        await video.play().catch(() => undefined);
      }
      setEstado('aovivo');
    } catch (e) {
      setErro(mensagemDeErro(e));
      setEstado('erro');
    }
  }, [desligar]);

  useEffect(() => {
    if (!inicial) void ligar();
    return desligar;
  }, [inicial, ligar, desligar]);

  const capturar = useCallback(() => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) {
      setErro('A câmera ainda não está pronta. Tente de novo.');
      setEstado('erro');
      return;
    }
    // Recorte quadrado no centro, reduzido a 600×600.
    const lado = Math.min(video.videoWidth, video.videoHeight);
    const sx = (video.videoWidth - lado) / 2;
    const sy = (video.videoHeight - lado) / 2;
    const canvas = document.createElement('canvas');
    canvas.width = LADO;
    canvas.height = LADO;
    canvas.getContext('2d')?.drawImage(video, sx, sy, lado, lado, 0, 0, LADO, LADO);
    const dados = canvas.toDataURL('image/jpeg', QUALIDADE);
    desligar();

    if ((dados.length * 3) / 4 > MAXIMO_BYTES) {
      setErro('A foto ficou grande demais. Tente de novo.');
      setEstado('erro');
      return;
    }
    setFoto(dados);
    setEstado('pronta');
  }, [desligar]);

  // Contagem regressiva de 3 s antes da captura.
  useEffect(() => {
    if (estado !== 'contando') return;
    if (contagem <= 0) {
      capturar();
      return;
    }
    const t = window.setTimeout(() => setContagem((n) => n - 1), 1000);
    return () => window.clearTimeout(t);
  }, [estado, contagem, capturar]);

  function tirar() {
    setContagem(CONTAGEM);
    setEstado('contando');
  }

  function outra() {
    setFoto(null);
    void ligar();
  }

  return (
    <section className={styles.cartao} aria-labelledby="titulo-foto">
      <h1 id="titulo-foto" className={styles.titulo}>Sua foto</h1>
      <p className={styles.lead}>
        Olhe para a câmera, com o rosto no quadro e em um lugar iluminado. Ao tocar em
        &quot;Tirar foto&quot;, a foto é tirada em 3 segundos.
      </p>

      <div className={styles.camera}>
        {estado === 'pronta' && foto ? (
          // eslint-disable-next-line @next/next/no-img-element -- data URL local, sem otimização possível
          <img className={styles.cameraFoto} src={foto} alt="Sua foto" />
        ) : (
          <video
            ref={videoRef}
            className={styles.cameraVideo}
            playsInline
            muted
            autoPlay
            aria-label="Imagem da câmera"
          />
        )}
        {estado === 'contando' && contagem > 0 && (
          <div className={styles.contagem} aria-live="assertive">{contagem}</div>
        )}
        {estado === 'ligando' && (
          <div className={styles.contagem} role="status">
            <FontAwesomeIcon icon={faSpinner} spin />
          </div>
        )}
      </div>

      {erro && (
        <div className={styles.aviso} role="alert">
          <Note tone="danger" icon={faTriangleExclamation}>{erro}</Note>
        </div>
      )}

      {estado === 'pronta' && foto ? (
        <div className={styles.acoesLinha}>
          <button type="button" className={`${styles.botao} ${styles.botaoSecundario}`} onClick={outra}>
            <FontAwesomeIcon icon={faRotateRight} /> Tirar outra
          </button>
          <button
            type="button"
            className={`${styles.botao} ${styles.botaoPrincipal}`}
            onClick={() => aoContinuar(foto)}
          >
            Usar esta foto e assinar
          </button>
        </div>
      ) : estado === 'erro' ? (
        <button type="button" className={`${styles.botao} ${styles.botaoSecundario}`} onClick={() => void ligar()}>
          <FontAwesomeIcon icon={faRotateRight} /> Tentar de novo
        </button>
      ) : (
        <button
          type="button"
          className={`${styles.botao} ${styles.botaoPrincipal}`}
          onClick={tirar}
          disabled={estado !== 'aovivo'}
        >
          <FontAwesomeIcon icon={faCamera} /> Tirar foto
        </button>
      )}
    </section>
  );
}
