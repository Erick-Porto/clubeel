interface Headers {
    Authorization: string;
    Session: string | null;
}

const API_CONSUME = async (
    method: string,
    route: string,
    headers: Headers,
    body: object | null,
) => {
    
    const ip = "192.168.100.128:8000"

    try {
        const response = await fetch(`http://${ip}/api/${route}`, {
            method: method,
            headers: Object.fromEntries(
                Object.entries({
                    'Content-Type': 'application/json',
                    'Authorization': headers.Authorization,
                    'Session': headers.Session,
                }).filter(([_, value]) => value != null)
                .map(([key, value]) => [key, String(value)])
            ),
            body: body ? JSON.stringify(body) : undefined,
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || 'Failed to fetch');
        }

        const data = await response.json();
        return data
    } catch (err) {
        if (err instanceof Error) {
            console.error(err.message);
        } else {
            console.error(err);
        }
    }
}

export default API_CONSUME;