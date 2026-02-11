'use client';

import { useEffect } from 'react';
import { useSession, signOut } from 'next-auth/react';
import API_CONSUME from '@/services/api-consume';

export default function TokenValidator() {
  const { data: session, status } = useSession();

  useEffect(() => {
    if (status === 'authenticated') {
      validateBackendToken();
    }
  }, [status, session]);

  const validateBackendToken = async () => {
    const response = await API_CONSUME('GET', '/verify-token', {}, null, { skipAuthCheck: true });

    if (!response.ok || response.status === 401 || response.status === 403) {
      console.log("Token Validator: Token inválido detectado. Deslogando...");
      
      await signOut({ callbackUrl: '/login', redirect: true });
    }
  };

  return null;
}