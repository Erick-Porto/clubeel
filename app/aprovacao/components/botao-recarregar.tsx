'use client';

/**
 * Recarrega os dados do servidor. `router.refresh()` refaz a renderização no
 * servidor — que é onde a chamada à Lara acontece — sem recarregar a página
 * inteira e sem que o navegador fale com a API.
 */

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import styles from '../../../styles/aprovacao.module.css';

export default function BotaoRecarregar({ rotulo = 'Tentar novamente' }: { rotulo?: string }) {
  const router = useRouter();
  const [pendente, iniciar] = useTransition();

  return (
    <button
      type="button"
      className={styles.botaoSecundario}
      disabled={pendente}
      onClick={() => iniciar(() => router.refresh())}
    >
      {pendente ? 'Carregando...' : rotulo}
    </button>
  );
}
