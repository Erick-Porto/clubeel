async function isTokenValid(token: string): Promise<boolean> {
    try {
        const response = await fetch('http://192.168.100.205/api/verify-token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ token })
        });

        if (response.status === 200) {
            return true;
        } else {
            return false;
        }
    } catch (error) {
        console.error('Token validation failed:', error);
        return false;
    }
}