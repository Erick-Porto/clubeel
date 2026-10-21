'use client';

/**
 * Recusar o documento: motivo opcional (até 255) e confirmação explícita,
 * porque recusar encerra o documento para TODOS os signatários.
 */

import { useEffect, useRef, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner, faTriangleExclamation } from '@fortawesome/free-solid-svg-icons';
import styles from '../../../../styles/assinatura.module.css';
import { Note } from '../../../components/UI/ui';
import { api } from '../cliente';
import type { Recusa } from '../tipos';

interface Props {
  aoFechar: () => void;
  tratar: (recusa: Recusa) => boolean;
  aoRecusar: (mensagem: string | null) => void;
}

export default function RecusarDocumento({ aoFechar, tratar, aoRecusar }: Props) {
  const [motivo, setMotivo] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const primeiroRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    primeiroRef.current?.focus();
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key === 'Escape') aoFechar();
    };
    window.addEventListener('keydown', aoTeclar);
    return () => window.removeEventListener('keydown', aoTeclar);
  }, [aoFechar]);

  async function recusar() {
    setOcupado(true);
    setErro(null);
    const texto = motivo.trim();
    const resposta = await api<{ ok: boolean; message?: string }>('recusar', {
      json: texto ? { reason: texto } : {},
    });
    setOcupado(false);
    if (resposta.ok) {
      aoRecusar(resposta.data.message ?? null);
      return;
    }
    if (tratar(resposta.recusa)) return;
    setErro(resposta.recusa.error);
  }

  return (
    <div className={styles.fundoModal} onClick={aoFechar}>
      <div
        className={styles.modal}
        role="dialog"
        aria-modal="true"
        aria-labelledby="titulo-recusar"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="titulo-recusar" className={styles.subtitulo}>Recusar o documento?</h2>
        <div className={styles.aviso}>
          <Note tone="warn" icon={faTriangleExclamation}>
            Recusar encerra este documento para todos que iam assiná-lo. Não dá para desfazer.
          </Note>
        </div>

        <div className={styles.campo}>
          <label htmlFor="motivo-recusa" className={styles.campoTitulo}>
            Motivo <span className={styles.campoObrigatorio}>(opcional)</span>
          </label>
          <textarea
            ref={primeiroRef}
            id="motivo-recusa"
            rows={3}
            maxLength={255}
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
          />
        </div>

        {erro && (
          <div className={styles.aviso} role="alert">
            <Note tone="danger" icon={faTriangleExclamation}>{erro}</Note>
          </div>
        )}

        <div className={styles.acoesLinha}>
          <button type="button" className={`${styles.botao} ${styles.botaoSecundario}`} onClick={aoFechar} disabled={ocupado}>
            Voltar
          </button>
          <button type="button" className={`${styles.botao} ${styles.botaoPerigoSolido}`} onClick={recusar} disabled={ocupado}>
            {ocupado && <FontAwesomeIcon icon={faSpinner} spin />}
            Recusar documento
          </button>
        </div>
      </div>
    </div>
  );
}
