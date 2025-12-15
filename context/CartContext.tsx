'use client'

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useSession } from 'next-auth/react';
import API_CONSUME from '@/services/api-consume';
import { toast } from 'react-toastify';

export interface CartItem {
    id: number;
    place_id: number;
    place:any;
    place_name?: string;
    place_image?: string;
    start_schedule: string; 
    end_schedule: string;
    price: number; 
    member_id?: number;
    status_id?: number;
}

interface CartContextType {
    cart: CartItem[];
    isLoading: boolean;
    refreshCart: () => Promise<void>;
    clearCart: () => void;
    removeCartItem: (id: number) => Promise<void>;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

// --- FUNÇÃO CORRIGIDA ---
const normalizeToBrasilia = (dateStr: string): string => {
    if (!dateStr) return "";

    const isoLike = dateStr.includes('Z') || dateStr.includes('+') 
        ? dateStr 
        : dateStr.replace(' ', 'T') + 'Z';

    const date = new Date(isoLike);
    if (isNaN(date.getTime())) return dateStr;

    const brasiliaDate = new Intl.DateTimeFormat('pt-BR', {
        timeZone: 'America/Sao_Paulo',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
    }).format(date);

    // CORREÇÃO: Remove a vírgula que pode aparecer após a data (ex: "03/12/2025, 19:00")
    // E converte de "dd/mm/yyyy" para "yyyy-mm-dd"
    return brasiliaDate
        .replace(',', '') 
        .replace(/(\d{2})\/(\d{2})\/(\d{4})/, '$3-$2-$1');
};

export const CartProvider = ({ children }: { children: React.ReactNode }) => {
    const { data: session, status } = useSession();
    const [cart, setCart] = useState<CartItem[]>([]);
    const [isLoading, setIsLoading] = useState(true); 
    
    const hasFetchedInitial = useRef(false);

const fetchCartData = useCallback(async (token: string, userId: string | number) => {
        try {
            const response = await API_CONSUME("GET", `schedule/member/${userId}`, {
                'Session': token
            });

            // 1. Validação de Sucesso
            if (!response.ok || !response.data) {
                // Se der erro, não faz nada ou limpa o carrinho dependendo da regra
                console.warn("Falha ao buscar carrinho:", response.message);
                return;
            }

            // 2. O payload real agora está em response.data
            const apiData = response.data;
            let rawData: any[] = [];
            
            // Ajuste da lógica para ler de apiData
            if (Array.isArray(apiData)) {
                rawData = apiData;
            } else if (apiData?.schedules) {
                if (Array.isArray(apiData.schedules)) {
                    rawData = apiData.schedules;
                } else if (typeof apiData.schedules === 'object') {
                    // Lógica para tratar agrupamento por data, se houver
                    Object.values(apiData.schedules).forEach((dateGroup: any) => {
                        if (typeof dateGroup === 'object') {
                            Object.values(dateGroup).forEach((itemsArray: any) => {
                                if (Array.isArray(itemsArray)) rawData.push(...itemsArray);
                            });
                        }
                    });
                }
            } else if (apiData?.data && Array.isArray(apiData.data)) {
                // Caso o Laravel retorne paginado ou envolvido em 'data'
                rawData = apiData.data; 
            }

            const cleanCartItems: CartItem[] = rawData
                .filter((item: any) => String(item.status_id) === '3') // Status 3 = Carrinho/Pendente
                .map((item: any) => ({
                    ...item,
                    id: Number(item.id),
                    place_id: Number(item.place_id),
                    price: Number(item.price) || 0, 
                    status_id: Number(item.status_id),
                    start_schedule: normalizeToBrasilia(item.start_schedule),
                    end_schedule: normalizeToBrasilia(item.end_schedule)
                }));

            setCart(prev => {
                if (JSON.stringify(prev) === JSON.stringify(cleanCartItems)) return prev;
                return cleanCartItems;
            });

        } catch (error) {
            console.error("Erro crítico ao processar carrinho:", error);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        if (status === 'authenticated' && session?.accessToken && session?.user?.id) {
            if (!hasFetchedInitial.current) {
                fetchCartData(session.accessToken, session.user.id);
                hasFetchedInitial.current = true;
            }
        } else if (status === 'unauthenticated') {
            setCart([]);
            setIsLoading(false);
            hasFetchedInitial.current = false;
        }
    }, [status, session, fetchCartData]);

    const refreshCart = useCallback(async () => {
        if (session?.accessToken && session?.user?.id) {
            await fetchCartData(session.accessToken, session.user.id);
        }
    }, [session, fetchCartData]);

    const clearCart = useCallback(() => {
        setCart([]);
    }, []);

const removeCartItem = useCallback(async (scheduleId: number) => {
        if (!session?.accessToken) return;

        // Otimismo: Remove da UI antes
        const previousCart = [...cart]; 
        setCart(current => current.filter(item => item.id !== scheduleId));

        try {
            const response = await API_CONSUME("DELETE", `schedule/delete-pending`, {
                'Session': session.accessToken
            },{
                id: scheduleId
            });

            // 1. Verificação correta
            if (!response.ok) {
                // Lança erro para cair no catch e reverter o estado
                throw new Error(response.message || "Erro no backend ao deletar");
            }

            toast.success("Item removido.");
            
            // Opcional: Recarregar dados reais para garantir sincronia
            if (session.user?.id) {
                // Não precisa de await aqui para não travar a UI
                fetchCartData(session.accessToken, session.user.id);
            }

        } catch (error) {
            console.error("Erro ao excluir no servidor:", error);
            toast.error("Erro ao remover item.");
            // Reverte o estado em caso de erro
            setCart(previousCart);
        }
    }, [cart, session, fetchCartData]);

    const value = useMemo(() => ({
        cart,
        isLoading,
        refreshCart,
        clearCart,
        removeCartItem 
    }), [cart, isLoading, refreshCart, clearCart, removeCartItem]);

    return (
        <CartContext.Provider value={value}>
            {children}
        </CartContext.Provider>
    );
};

export const useCart = () => {
    const context = useContext(CartContext);
    if (!context) {
        throw new Error('useCart deve ser usado dentro de um CartProvider');
    }
    return context;
};