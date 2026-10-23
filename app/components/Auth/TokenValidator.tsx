'use client';

import { useEffect, useCallback } from 'react';
import { useSession, signOut } from 'next-auth/react';
import API_CONSUME from '../../../services/api-consume';
import { usePathname } from 'next/navigation';
import { comBase } from '../../../utils/base-path';

export default function TokenValidator() {
  const { data: session, status } = useSession();
  const pathname = usePathname();

  const validateBackendToken = useCallback(async () => {
    if (status === 'authenticated' && !session?.accessToken) {
      await signOut({ callbackUrl: comBase('/login'), redirect: true });
      return;
    }

    const response = await API_CONSUME('GET', '/verify-token', {}, null, { skipAuthCheck: true });

    if (!response.ok || response.status === 401 || response.status === 403) {
      console.log("Token Validator: Token inválido ou expirado detectado. Deslogando...");
      await signOut({ callbackUrl: comBase('/login'), redirect: true });
    }
  }, [status, session]);

  useEffect(() => {
    // A área de aprovação de compras (/aprovacao) tem sessão própria, sem
    // relação com a de sócio. Sem este guard, um sócio com token vencido no
    // mesmo navegador arrastaria o aprovador para /login no meio do trabalho,
    // porque validateBackendToken chama signOut({ callbackUrl: '/login' }).
    // Não altera nada no fluxo de agendamento: só desliga o validador fora dele.
    if (pathname?.startsWith('/aprovacao')) return;
    // Mesma coisa na tela da equipe do torneio (/torneios/<id>/equipe): ela usa
    // o código de lançamento, não o login de sócio, e é usada na beira da
    // quadra — um login de sócio vencido no mesmo celular não pode tirá-la dali.
    if (/^\/torneios\/[^/]+\/equipe(\/|$)/.test(pathname ?? '')) return;

    if (status === 'authenticated') {
      validateBackendToken();

      const interval = setInterval(() => {
        validateBackendToken();
      }, 5 * 60 * 1000);

      return () => clearInterval(interval);
    }
  }, [status, pathname, validateBackendToken]);

  return null;
}