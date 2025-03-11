'use client'

import { useEffect, useState } from 'react';
import { redirect } from 'next/navigation';
import { ComponentType } from 'react';

// Function to validate the token
const isTokenValid = async (token: string): Promise<boolean> => {
    try {
        // Placeholder for actual token validation logic
        return token === "valid-token"; // Replace with real validation
    } catch (error) {
        console.error("Token validation error:", error);
        return false;
    }
};

const withAuth = (WrappedComponent: ComponentType) => {
    return (props: any) => {
        const [isLoading, setIsLoading] = useState(true);

        useEffect(() => {
            const checkToken = async () => {
                const token = localStorage.getItem('accessToken');
                if (!token) {
                    redirect('/login'); // Redirect to login if token is not present
                } else {
                    const isValid = await isTokenValid(token);
                    if (!isValid) {
                        localStorage.removeItem('accessToken'); // Remove invalid token
                        redirect('/login'); // Redirect to login if token is not valid
                    } else {
                        setIsLoading(false); // Token is valid, can render the page
                    }
                }
            };

            checkToken().catch(error => {
                console.error("Error checking token:", error);
                redirect('/login'); // Redirect to login on error
            });
        }, [redirect]);

        if (isLoading) {
            return <div>Loading...</div>; // Show loading while checking token
        }

        return <WrappedComponent {...props} />;
    };
};

export default withAuth;