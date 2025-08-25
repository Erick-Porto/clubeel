'use client'
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ComponentType } from 'react';
import LoadingScreen from './loading';
import API_CONSUME from '@/services/api-consume';
import { useUser } from '@/context/UserContext';

const withAuth = (WrappedComponent: ComponentType<{ User: string }>) => {
    const AuthComponent: React.FC<{ User: string }> = (props) => {
        const { accessToken, setAccessToken, setUser, setCart } = useUser();
        const [isLoading, setIsLoading] = useState(true);
        const router = useRouter();

        useEffect(() => {
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
                        setAccessToken(storedToken); // Atualiza o token no contexto
                        setUser(JSON.parse(storedUser)); // Atualiza o usuário no contexto
                        setIsLoading(false); // Token é válido, para o carregamento

                        // Recupera o carrinho do localStorage
                        const storedCart = localStorage.getItem('___cfcsn-cart');
                        if (storedCart) {
                            setCart(JSON.parse(storedCart));
                        }
                    } else {
                        console.log('Invalid token, removing token and redirecting to login');
                        localStorage.removeItem('___cfcsn-access-token');
                        localStorage.removeItem('___cfcsn-user-data');
                        setAccessToken(null);
                        setUser(null);
                        setCart([]); // Limpa o carrinho em caso de token inválido
                        router.push('/login');
                    }
                } catch (error) {
                    console.error('Error checking token:', error);
                    localStorage.removeItem('___cfcsn-access-token');
                    localStorage.removeItem('___cfcsn-user-data');
                    setAccessToken(null);
                    setUser(null);
                    setCart([]); // Limpa o carrinho em caso de erro
                    router.push('/login');
                }
            };

            checkToken();
        }, []);

        if (isLoading) {
            return <LoadingScreen />; // Mostra a tela de carregamento enquanto verifica o token
        }

        return <WrappedComponent {...props} />;
    };

    AuthComponent.displayName = 'AuthComponent';

    return AuthComponent;
};

export default withAuth;