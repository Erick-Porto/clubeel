'use client'

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ComponentType } from 'react';

const withAuth = (WrappedComponent: ComponentType) => {
    return (props: any) => {
        const [isLoading, setIsLoading] = useState(true);
        const router = useRouter();

        useEffect(() => {
            const checkToken = async () => {
                const token = localStorage.getItem('___cfcsn-access-token');
                if (!token) {
                    console.log('No token found, redirecting to login');
                    router.push('/login'); // Redirect to login if token is not present
                } else {
                    const response = await fetch('/api/authorization', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({ 
                            api: process.env.API_TOKEN,
                            token 
                        }),
                    });

                    const data = await response.json();
                    
                    console.log('Token validation status:', data.valid);

                    if (data.valid) {
                        setIsLoading(false); // Token is valid, can render the page
                    } else {
                        console.log('Invalid token, removing token and redirecting to login');
                        localStorage.removeItem('___cfcsn-access-token'); // Remove invalid token
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
            return <div>Loading...</div>; // Show loading while checking token
        }

        return <WrappedComponent {...props} />;
    };
};

export default withAuth;