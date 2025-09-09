'use client'
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ComponentType } from 'react';
import { LoadingScreen } from './loading';
import API_CONSUME from '@/services/api-consume';
import { useUser } from '@/context/UserContext';

const withAuth = (WrappedComponent: ComponentType<{ User: string }>) => {
    const AuthComponent: React.FC<{ User: string }> = (props) => {
        const { accessToken, setAccessToken, setUser, setCart, cart } = useUser();
        const [isLoading, setIsLoading] = useState(true);
        const router = useRouter();

        useEffect(() => {
            let intervalId: number | undefined;
            const checkToken = async () => {
                try {
                    const storedToken = localStorage.getItem('___cfcsn-access-token');
                    const storedUser = localStorage.getItem('___cfcsn-user-data');

                    if (!storedToken || !storedUser) {
                        console.log('No token or user data found, redirecting to login');
                        router.push('/login');
                        return;
                    }

                    const data = await API_CONSUME(
                        'GET',
                        'verify-token',
                        {
                            Authorization: `Bearer ${process.env.NEXT_PUBLIC_API_TOKEN}`,
                            Session: storedToken,
                        },
                        null
                    );

                    if (data && data[0]) {
                        console.log('Token is valid');
                        setAccessToken(storedToken);
                        const parsedUser = JSON.parse(storedUser);
                        setUser(parsedUser);
                        setIsLoading(false);

                        // 1) Mescla cart do localStorage com o contexto (se existir)
                        try {
                            const storedCart = localStorage.getItem('___cfcsn-cart');
                            if (storedCart) {
                                const parsed = JSON.parse(storedCart);
                                const incoming = Array.isArray(parsed) ? parsed : [];
                                setCart((prevCart: any) => {
                                    const base = Array.isArray(prevCart) ? prevCart : Array.isArray(cart) ? cart : [];
                                    const map: Record<string, any> = {};
                                    const pushToMap = (item: any) => {
                                        const key = `${item.start_schedule}_${item.place_id ?? item.place}`;
                                        map[key] = item;
                                    };
                                    base.forEach(pushToMap);
                                    incoming.forEach(pushToMap);
                                    const merged = Object.values(map);
                                    try {
                                        localStorage.setItem('___cfcsn-cart', JSON.stringify(merged));
                                    } catch (e) {
                                        console.warn('Could not persist merged cart to localStorage', e);
                                    }
                                    return merged;
                                });
                            }
                        } catch (e) {
                            console.warn('Failed to parse stored cart, ignoring', e);
                        }

                        // 2) Buscar carrinho/agendamentos do servidor e mesclar (atualiza conforme login-aside.tsx)
                        try {
                            const cartResp = await API_CONSUME(
                                'GET',
                                `schedule/member/${parsedUser.id}`,
                                {
                                    Authorization: `Bearer ${process.env.NEXT_PUBLIC_API_TOKEN}`,
                                    Session: storedToken,
                                },
                                null
                            );

                            const schedule = cartResp?.schedules ?? [];
                            const effectiveCart = Array.isArray(schedule)
                                ? schedule.filter((item: any) => String(item.status) === '3' || Number(item.status) === 3)
                                : [];

                            // get current persisted cart keys
                            let currentCartArr: any[] = [];
                            try {
                                const storedCartNow = localStorage.getItem('___cfcsn-cart');
                                currentCartArr = storedCartNow ? JSON.parse(storedCartNow) : [];
                            } catch (e) {
                                currentCartArr = Array.isArray(cart) ? cart : [];
                            }
                            const currentKeys = new Set((currentCartArr || []).map((it: any) => `${it.start_schedule}_${it.place_id ?? it.place}`));

                            // build server keys
                            const serverItems = Array.isArray(effectiveCart) ? effectiveCart : [];
                            const serverKeys = serverItems.map((it: any) => `${it.start_schedule}_${it.place_id}`);

                            // check if there's any difference
                            const hasDifference = serverKeys.length !== currentKeys.size || serverKeys.some(k => !currentKeys.has(k));

                            if (hasDifference) {
                                // Only fetch place info for server items that are missing in current cart
                                const newItems = await Promise.all(serverItems.map(async (item: any) => {
                                    const key = `${item.start_schedule}_${item.place_id}`;
                                    // If item exists in current cart, reuse the stored one (keeps place_name/place_image)
                                    const existing = currentCartArr.find((c: any) => `${c.start_schedule}_${c.place_id ?? c.place}` === key);
                                    if (existing) {
                                        return existing;
                                    }

                                    let placeInfo: any = {};
                                    try {
                                        placeInfo = await API_CONSUME("GET", `place/${item.place_id}`, {
                                            'Authorization': 'Bearer ' + process.env.NEXT_PUBLIC_API_TOKEN,
                                            'Session': storedToken
                                        }, null) || {};
                                    } catch (e) {
                                        console.warn('place fetch failed for', item.place_id, e);
                                    }

                                    return {
                                        start_schedule: item.start_schedule,
                                        end_schedule: item.end_schedule,
                                        owner: item.member_id,
                                        status: item.status,
                                        price: item.price,
                                        place_id: item.place_id,
                                        place_name: placeInfo?.name ?? null,
                                        place_image: placeInfo?.image ?? null
                                    };
                                }));

                                // Overwrite cart with the server-derived list (reusing existing enriched items when present)
                                const finalCart = newItems.filter(Boolean);
                                try {
                                    localStorage.setItem('___cfcsn-cart', JSON.stringify(finalCart));
                                } catch (e) {
                                    console.warn('Could not persist server cart to localStorage', e);
                                }
                                try { setCart(finalCart); } catch (e) { console.warn('setCart failed', e); }
                            }
                            // if no difference, keep current cart as-is
                        } catch (e) {
                            console.warn('Failed to fetch/merge server cart', e);
                        }
                    } else {
                        console.log('Invalid token, removing token and redirecting to login');
                        localStorage.removeItem('___cfcsn-access-token');
                        localStorage.removeItem('___cfcsn-user-data');
                        setAccessToken(null);
                        setUser(null);
                        router.push('/login');
                    }
                } catch (error) {
                    console.error('Error checking token:', error);
                    localStorage.removeItem('___cfcsn-access-token');
                    localStorage.removeItem('___cfcsn-user-data');
                    setAccessToken(null);
                    setUser(null);
                    router.push('/login');
                }
            };

            // run immediately then every 5 minutes
            checkToken();
            intervalId = window.setInterval(() => {
                checkToken();
            }, 5 * 1000);

            return () => {
                if (intervalId) {
                    clearInterval(intervalId);
                }
            };
        }, []);

        if (isLoading) {
            return <LoadingScreen />;
        }

        return <WrappedComponent {...props} />;
    };

    AuthComponent.displayName = 'AuthComponent';

    return AuthComponent;
};

export default withAuth;