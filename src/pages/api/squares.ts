'use server'

import API_CONSUME from '@/services/api-consume';

const handler_squares = (accessToken:string|null) => {
    const response = API_CONSUME(
        "GET",
        "places/groups/sport",
        {
            'Authorization': 'Bearer '+process.env.NEXT_PUBLIC_API_TOKEN,
            'Session': accessToken
        },
        null
    )

    console.log(" => "+response)

    return(
        "a"
    )
}

export default handler_squares;