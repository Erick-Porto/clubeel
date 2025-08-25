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
}

interface UserContextProps {
  User: User | null;
  setUser: React.Dispatch<React.SetStateAction<User | null>>;
  accessToken: string | null;
  setAccessToken: React.Dispatch<React.SetStateAction<string | null>>;
  cart: any[];
  setCart: React.Dispatch<React.SetStateAction<any[]>>;
  logout: () => void;
}

export const UserContext = createContext<UserContextProps | undefined>(undefined);

export const UserProvider = ({ children }: { children: ReactNode }) => {
  const [User, setUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [cart, setCart] = useState<any[]>([]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const storedUser = localStorage.getItem('___cfcsn-user-data');
      const storedToken = localStorage.getItem('___cfcsn-access-token');
      const storedCart = localStorage.getItem('___cfcsn-cart');

      if (storedUser) setUser(JSON.parse(storedUser));
      if (storedToken) setAccessToken(storedToken);
      if (storedCart) setCart(JSON.parse(storedCart));
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

  const updateCart: React.Dispatch<React.SetStateAction<any[]>> = (newCart) => {
    const resolvedCart = typeof newCart === 'function' ? newCart(cart) : newCart;
    setCart(resolvedCart); // Atualiza o estado do carrinho
    if (typeof window !== 'undefined') {
      if (resolvedCart.length > 0) {
        localStorage.setItem('___cfcsn-cart', JSON.stringify(resolvedCart)); // Sincroniza com o localStorage
      } else {
        localStorage.removeItem('___cfcsn-cart'); // Remove o carrinho do localStorage se estiver vazio
      }
    }
  };

  const logout = () => {
    setUser(null);
    setAccessToken(null);
    setCart([]);
    if (typeof window !== 'undefined') {
      localStorage.clear(); // Clear all localStorage data
    }
  };

  return (
    <UserContext.Provider value={{
      User, setUser, accessToken, setAccessToken, cart, setCart: updateCart, logout
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