'use client';

/**
 * Provedores do site de reservas (sessão de sócio, carrinho, validador de
 * token) — montados em todo o app, EXCETO na área de assinatura remota.
 *
 * Em /assinar quem chega veio pelo link do e-mail e não tem relação nenhuma
 * com a sessão de sócio. Sem este corte, o `SessionProvider` buscaria
 * /api/auth/session (lendo o login de sócio do navegador) e o `CartProvider`
 * buscaria o carrinho na Lara para um sócio que porventura estivesse logado no
 * mesmo aparelho.
 *
 * `usePathname` vem sem o basePath (/homolog), então a comparação vale nos
 * dois ambientes. Ninguém navega entre a área e o site (não há links), então a
 * troca de árvore nunca acontece no meio de uma visita.
 */

import { usePathname } from 'next/navigation';
import TokenValidator from './Auth/TokenValidator';
import { NextAuthProvider } from './provider';
import { CartProvider } from '../../context/CartContext';

export function areaDeAssinatura(pathname: string | null): boolean {
  return pathname === '/assinar' || (pathname ?? '').startsWith('/assinar/');
}

export default function CascaDoSite({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  if (areaDeAssinatura(pathname)) return <>{children}</>;

  return (
    <NextAuthProvider>
      <CartProvider>
        <TokenValidator />
        {children}
      </CartProvider>
    </NextAuthProvider>
  );
}
