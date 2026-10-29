'use client';

/**
 * Etapa 2 — CPF. Vem ANTES do documento, de propósito (é a ordem da Lara): o
 * PDF, as perguntas e os anexos só são servidos depois da identidade.
 *
 * O número de tentativas restantes é o que a Lara devolve; o front não conta.
 * O CPF digitado some do estado assim que a etapa termina.
 */

import { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner, faTriangleExclamation } from '@fortawesome/free-solid-svg-icons';
import styles from '../../../../styles/assinatura.module.css';
import { Note } from '../../../components/UI/ui';
import { api } from '../cliente';
import { mascaraCpf, plural } from '../formato';
import type { Recusa } from '../tipos';

interface Props {
  tentativas: number | null;
  /** Recusas que mudam de tela (link travado, sessão caída...). Devolve true se tratou. */
  tratar: (recusa: Recusa) => boolean;
  aoConfirmar: () => void;
}

export default function EtapaCpf({ tentativas, tratar, aoConfirmar }: Props) {
  const [cpf, setCpf] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [restantes, setRestantes] = useState<number | null>(tentativas);

  async function enviar(evento: React.FormEvent) {
    evento.preventDefault();
    setOcupado(true);
    setErro(null);
    const resposta = await api<{ ok: boolean }>('identidade', { json: { cpf } });
    setOcupado(false);

    if (resposta.ok) {
      setCpf('');
      aoConfirmar();
      return;
    }
    if (tratar(resposta.recusa)) return;
    setErro(resposta.recusa.error);
    if (typeof resposta.recusa.attempts_left === 'number') setRestantes(resposta.recusa.attempts_left);
  }

  return (
    <form className={styles.cartao} onSubmit={enviar} noValidate>
      <h1 className={styles.titulo}>Confirme seu CPF</h1>
      <p className={styles.lead}>
        Antes de mostrar o documento, precisamos confirmar que é você. Digite o seu CPF completo.
      </p>

      <div className={styles.campo}>
        <label htmlFor="cpf" className={styles.campoTitulo}>CPF</label>
        <input
          id="cpf"
          name="cpf"
          className={styles.campoCpf}
          inputMode="numeric"
          autoComplete="off"
          placeholder="000.000.000-00"
          value={cpf}
          onChange={(e) => setCpf(mascaraCpf(e.target.value))}
          aria-invalid={erro ? true : undefined}
          aria-describedby={erro ? 'cpf-erro' : undefined}
          maxLength={14}
          autoFocus
        />
      </div>

      {erro && (
        <div className={styles.aviso} role="alert" id="cpf-erro">
          <Note tone="danger" icon={faTriangleExclamation}>
            {erro}
            {typeof restantes === 'number' && (
              <>
                {' '}
                <strong data-testid="tentativas">
                  {restantes > 0
                    ? `Resta${restantes === 1 ? '' : 'm'} ${plural(restantes, 'tentativa', 'tentativas')}.`
                    : 'Não restam tentativas.'}
                </strong>
              </>
            )}
          </Note>
        </div>
      )}

      <button
        type="submit"
        className={`${styles.botao} ${styles.botaoPrincipal}`}
        disabled={ocupado || cpf.replace(/\D/g, '').length === 0}
      >
        {ocupado && <FontAwesomeIcon icon={faSpinner} spin />}
        Confirmar CPF
      </button>
    </form>
  );
}
