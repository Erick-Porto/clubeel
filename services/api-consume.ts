// services/api-consume.ts

interface Headers {
    // Authorization: string;
    Session: string | null;
}

const API_CONSUME = async (
    method: string,
    route: string,
    headers: Headers | null,
    body: object | null,
) => {
    try {
        const response = await fetch(`${process.env.NEXT_PUBLIC_LARA_API}/api/${route}`, {
            method: method,
            headers: Object.fromEntries(
                Object.entries({
                    'ngrok-skip-browser-warning': 'true',
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${process.env.NEXT_PUBLIC_LARA_API_TOKEN}`,
                    'Session': headers.Session,
                })
                    .filter(([_, value]) => value != null)
                    .map(([key, value]) => [key, String(value)])
            ),
            body: body ? JSON.stringify(body) : undefined,
        });

        // 🔹 Tratamento específico para 404
        if (response.status === 404) {
            console.warn(`API route not found: ${route}`);
            return {
                error: true,
                status: 404,
                message: "Rota não encontrada.",
            };
        }

        // 🔹 Tratamento para outros erros (400, 401, 500 etc.)
        if (!response.ok) {
            const errorText = await response.text();
            try {
                const errorData = JSON.parse(errorText);
                return {
                    error: true,
                    status: response.status,
                    message: errorData.message || `API Error: ${response.status}`,
                    details: errorData,
                };
            } catch {
                return {
                    error: true,
                    status: response.status,
                    message: `API Error: ${response.status} - ${errorText}`,
                };
            }
        }

        // 🔹 Sucesso → retorna JSON
        const data = await response.json();
        console.log('Successful API response:', data);
        return data;

    } catch (err) {
        console.error('Error in API_CONSUME:', err);

        if (err instanceof Error) {
            return {
                error: true,
                status: 500,
                message: err.message,
            };
        } else {
            return {
                error: true,
                status: 500,
                message: 'An unknown error occurred in API_CONSUME',
            };
        }
    }
};

export default API_CONSUME;
