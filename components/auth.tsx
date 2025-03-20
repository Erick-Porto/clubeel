'use client'
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ComponentType } from 'react';
import LoadingScreen from './loading';
import API_CONSUME from '@/services/api-consume';

const withAuth = (WrappedComponent: ComponentType) => {
    return (props: any) => {
        const [isLoading, setIsLoading] = useState(true);
        const router = useRouter();
        useEffect(() => {
            const checkToken = async () => {
                const token = localStorage.getItem('___cfcsn-access-token')

                if (!token) {
                    console.log('No token found, redirecting to login');
                    router.push('/login'); // Redirect to login if token is not present
                } else {
                    

                    const data = await API_CONSUME(
                        'GET',
                        'verify-token',
                        {
                            Authorization: `Bearer ${process.env.NEXT_PUBLIC_API_TOKEN}`,
                            Session: token,
                        },
                        null
                    );

                    if (data[0]) {
                        setIsLoading(false); // Token is valid, can render the page
                    } else {
                        console.log('Invalid token, removing token and redirecting to login');
                        localStorage.removeItem('___cfcsn-access-token');
                        router.push('/login'); // Redirect to login if token is not valid
                    }
                }
            };

            checkToken().catch(error => {
                console.error("Error checking token:", error);
                router.push('/login'); // Redirect to login on error
            });
        }, [router]);

        if (isLoading) {
            return <LoadingScreen/>; // Show loading while checking token
        }

        return <WrappedComponent {...props} />;
    };
};

export default withAuth;