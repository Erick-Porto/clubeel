'use client'

import React, { createContext, useState, ReactNode, useContext, useEffect } from 'react';

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
    status: number;
    place_id: number;
    price: number;
    place_name?: string | null;
    place_image?: string | null;
}

export const UserContext = createContext<UserContextProps | undefined>(undefined);

export const UserProvider = ({ children }: { children: ReactNode }) => {
  const [User, setUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [cart, setCartState] = useState<CartItem[] | null>(null);

  // wrapped setter to help trace unexpected calls (e.g. setState during render)
  const setCart: React.Dispatch<React.SetStateAction<CartItem[] | null>> = (value) => {
    // log a trace to help locate caller
    try {
      if (typeof window !== 'undefined' && (window as any).__rendering_component) {
        console.warn(`Deferred setCart called while rendering ${(window as any).__rendering_component}; scheduling after render.`);
        console.trace('Deferred setCart stacktrace:', value);
        // defer update to avoid setState during render
        setTimeout(() => {
          setCartState(value as any);
        }, 0);
        return;
      }
      console.trace('setCart called', value);
    } catch (e) {
      console.trace('setCart called (trace failed)', value);
    }
    setCartState(value as any);
  };

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const storedUser = localStorage.getItem('___cfcsn-user-data');
      const storedToken = localStorage.getItem('___cfcsn-access-token');
      const storedCart = localStorage.getItem('___cfcsn-cart');

      if (storedUser) setUser(JSON.parse(storedUser));
      if (storedToken) setAccessToken(storedToken);
      if (storedCart) {
        try {
          const parsed = JSON.parse(storedCart);
          if (Array.isArray(parsed)) setCart(parsed as CartItem[]);
        } catch (e) {
          console.warn('Failed to parse stored cart', e);
        }
      }
    }
  }, []);

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

  // persist cart to localStorage whenever it changes
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      if (Array.isArray(cart) && cart.length > 0) {
        localStorage.setItem('___cfcsn-cart', JSON.stringify(cart));
      } else {
        localStorage.removeItem('___cfcsn-cart');
      }
    } catch (e) {
      console.warn('Failed to persist cart to localStorage', e);
    }
  }, [cart]);


  const logout = () => {
    setUser(null);
    setAccessToken(null);
    
    if (typeof window !== 'undefined') {
      try {
        localStorage.removeItem('___cfcsn-user-data');
        localStorage.removeItem('___cfcsn-access-token');
        localStorage.removeItem('___cfcsn-cart');
      } catch (e) {
        console.warn('Error clearing localStorage keys on logout', e);
      }
    }
  };

  return (
    <UserContext.Provider value={{
  User, setUser, accessToken, setAccessToken, cart, setCart, logout
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