'use client'

import React, { createContext, useState, ReactNode, useContext, useEffect, useRef } from 'react';
import API_CONSUME from '@/services/api-consume'; // <-- add API helper import
import { useRouter } from 'next/navigation';

interface User {
  name: string;
  email: string;
  cpf: string;
  title: string;
  barcode: string;
  birthdate: string;
  telephone: string;
  id:number;
}

interface UserContextProps {
  User: User | null;
  setUser: React.Dispatch<React.SetStateAction<User | null>>;
  accessToken: string | null;
  setAccessToken: React.Dispatch<React.SetStateAction<string | null>>;
  cart: CartItem[] | null;
  setCart: React.Dispatch<React.SetStateAction<CartItem[] | null>>;
  logout: () => void;
}

interface CartItem {
    start_schedule: string; // ISO date string
    end_schedule: string;   // ISO date string
    start?: string;         // ISO date string (same as start_schedule)
    end?: string;           // ISO date string (same as end_schedule)
    member_id: number;
    status_id: number;
    place_id: number;
    price: number;
    place_name?: string | null;
    place_image?: string | null;
}

export const UserContext = createContext<UserContextProps | undefined>(undefined);

export const UserProvider = ({ children }: { children: ReactNode }) => {
  const [User, setUserState] = useState<User | null>(null);
  const [accessToken, setAccessTokenState] = useState<string | null>(null);
  const [cart, setCartState] = useState<CartItem[] | null>(null);

  // refs to hold latest values to allow equality checks without stale closures
  const userRef = useRef<User | null>(User);
  const tokenRef = useRef<string | null>(accessToken);
  const cartRef = useRef<CartItem[] | null>(cart);

  // keep refs in sync with state
  useEffect(() => { userRef.current = User; }, [User]);
  useEffect(() => { tokenRef.current = accessToken; }, [accessToken]);
  useEffect(() => { cartRef.current = cart; }, [cart]);

  const router = useRouter();

  // simple deep-equality helper (safe for these plain objects/arrays)
  const isEqual = (a: any, b: any) => {
    if (a === b) return true;
    try {
      return JSON.stringify(a) === JSON.stringify(b);
    } catch {
      return false;
    }
  };

  // safer setUser: avoids setting identical value and supports updater function
  const setUser: React.Dispatch<React.SetStateAction<User | null>> = (value) => {
    if (typeof value === 'function') {
      setUserState(prev => {
        const next = (value as (prev: User | null) => User | null)(prev);
        if (isEqual(prev, next)) return prev;
        userRef.current = next;
        return next;
      });
    } else {
      if (isEqual(userRef.current, value)) return;
      userRef.current = value;
      setUserState(value);
    }
  };

  // safer setAccessToken
  const setAccessToken: React.Dispatch<React.SetStateAction<string | null>> = (value) => {
    if (typeof value === 'function') {
      setAccessTokenState(prev => {
        const next = (value as (prev: string | null) => string | null)(prev);
        if (isEqual(prev, next)) return prev;
        tokenRef.current = next;
        return next;
      });
    } else {
      if (isEqual(tokenRef.current, value)) return;
      tokenRef.current = value;
      setAccessTokenState(value);
    }
  };

  // wrapped setter to help trace unexpected calls (e.g. setState during render)
  const setCart: React.Dispatch<React.SetStateAction<CartItem[] | null>> = (value) => {
    // keep previously implemented deferred behavior and trace, but operate on state only (no localStorage)
    try {
      if (typeof window !== 'undefined' && (window as any).__rendering_component) {
        console.warn(`Deferred setCart called while rendering ${(window as any).__rendering_component}; scheduling after render.`);
        console.trace('Deferred setCart stacktrace:', value);
        setTimeout(() => {
          if (typeof value === 'function') {
            setCartState(prev => {
              const next = (value as (prev: CartItem[] | null) => CartItem[] | null)(prev);
              if (isEqual(prev, next)) return prev;
              cartRef.current = next;
              return next;
            });
          } else {
            if (isEqual(cartRef.current, value)) return;
            cartRef.current = value;
            setCartState(value as any);
          }
        }, 0);
        return;
      }
    } catch (e) {
      console.trace('setCart called (trace failed)', value);
    }

    if (typeof value === 'function') {
      setCartState(prev => {
        const next = (value as (prev: CartItem[] | null) => CartItem[] | null)(prev);
        if (isEqual(prev, next)) return prev;
        cartRef.current = next;
        return next;
      });
    } else {
      if (isEqual(cartRef.current, value)) return;
      cartRef.current = value;
      setCartState(value as any);
    }
  };

  // NEW: fetch cart (server-side) and populate state
  const refreshCart = async (): Promise<CartItem[]> => {
    try {
      const user = userRef.current;
      const token = tokenRef.current;
      if (!user || !user.id || !token) {
        // no user/token -> empty cart
        setCart([]);
        return [];
      }

      let cartResp: any;
      try {
        cartResp = await API_CONSUME(
          'GET',
          `schedule/member/${user.id}`,
          {
            Session: token,
          },
          null
        );
      } catch (e: any) {
        if (e?.status === 404) {
          setCart([]);
          return [];
        }
        console.warn('refreshCart failed fetching schedules', e);
        setCart([]);
        return [];
      }

      const schedule = cartResp?.schedules ?? [];
      const effectiveCart = Array.isArray(schedule)
        ? schedule.filter((item: any) => String(item.status_id) === '3' || Number(item.status_id) === 3)
        : [];

      // enrich with place info in parallel
      const enriched = await Promise.all(effectiveCart.map(async (item: any) => {
        let placeInfo: any = {};
        try {
          placeInfo = await API_CONSUME('GET', `place/${item.place_id}`, {
            Session: token
          }, null) || {};
        } catch (e) {
          console.warn('place fetch failed for', item.place_id, e);
        }
        return {
          start_schedule: item.start_schedule,
          end_schedule: item.end_schedule,
          start: item.start_schedule,
          end: item.end_schedule,
          member_id: item.member_id,
          status_id: item.status_id,
          price: item.price,
          place_id: item.place_id,
          place_name: placeInfo?.name ?? null,
          place_image: placeInfo?.image ?? null
        } as CartItem;
      }));

      setCart(enriched);
      return enriched;
    } catch (e) {
      console.error('Unexpected error in refreshCart', e);
      setCart([]);
      return [];
    }
  };

  // initial load: restore user/token from localStorage if present (keep this behavior)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const storedUser = localStorage.getItem('___cfcsn-user-data');
      const storedToken = localStorage.getItem('___cfcsn-access-token');

      if (storedUser) setUser(JSON.parse(storedUser));
      if (storedToken) setAccessToken(storedToken);
      // NOTE: removed reading/storing cart from localStorage per new behavior
    }
  }, []);

  // persist User and accessToken (unchanged)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      if (User) {
        localStorage.setItem('___cfcsn-user-data', JSON.stringify(User));
      } else {
        localStorage.removeItem('___cfcsn-user-data');
      }
    }
  }, [User]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      if (accessToken) {
        localStorage.setItem('___cfcsn-access-token', accessToken);
      } else {
        localStorage.removeItem('___cfcsn-access-token');
      }
    }
  }, [accessToken]);

  // Removed: cart persistence to localStorage. Cart now always comes from server via refreshCart.

  // auto-refresh cart whenever user or token change
  useEffect(() => {
    (async () => {
      try {
        await refreshCart();
      } catch (e) {
        console.warn('auto refreshCart failed', e);
      }
    })();
  }, [User, accessToken]);

  const logout = () => {
    router.push('/login');
    setUser(null);
    setAccessToken(null);
    setCart(null);
    
    if (typeof window !== 'undefined') {
      try {
        localStorage.removeItem('___cfcsn-user-data');
        localStorage.removeItem('___cfcsn-access-token');
      } catch (e) {
        console.warn('Error clearing localStorage keys on logout', e);
      }
    }
   };
 
   return (
     <UserContext.Provider value={{
      User, setUser, accessToken, setAccessToken, cart, setCart, logout,
      refreshCart // expose refreshCart to consumers
     }}>
       {children}
     </UserContext.Provider>
   );
 };
 
 export const useUser = () => {
   const context = useContext(UserContext);
   if (context === undefined) {
     throw new Error('useUser must be used within a UserProvider');
   }
   return context;
 };