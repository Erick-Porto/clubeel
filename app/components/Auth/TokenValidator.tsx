'use client';

import { useEffect, useCallback } from 'react';
import { useSession, signOut } from 'next-auth/react';
import API_CONSUME from '@/services/api-consume';
import { usePathname } from 'next/navigation';

export default function TokenValidator() {
  const { data: session, status } = useSession();
  const pathname = usePathname();

  const validateBackendToken = useCallback(async () => {
    if (status === 'authenticated' && !session?.accessToken) {
      await signOut({ callbackUrl: '/login', redirect: true });
      return;
    }

    const response = await API_CONSUME('GET', '/verify-token', {}, null, { skipAuthCheck: true });

    if (!response.ok || response.status === 401 || response.status === 403) {
      console.log("Token Validator: Token inválido ou expirado detectado. Deslogando...");
      await signOut({ callbackUrl: '/login', redirect: true });
    }
  }, [status, session]);

  useEffect(() => {
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