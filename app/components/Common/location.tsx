import styles from '@/styles/map-location.module.css'

const GOOGLE_MAPS_DIRECTIONS_URL = 'https://www.google.com/maps/dir//Clube+dos+Funcion%C3%A1rios+da+CSN+Rua+Hiroshi+Matsuda+Filho,+S%2FN+-+Vila+Santa+Cec%C3%ADlia+Volta+Redonda+-+RJ+27261-260/@-22.5287877,-44.1097089,18z/data=!4m5!4m4!1m0!1m2!1m1!1s0x9e986e0605bb79:0x84c8b48f044ac024';
const GOOGLE_MAPS_EMBED_BASE_URL = 'https://www.google.com/maps/embed/v1/place?q=Clube+dos+Funcionários+da+CSN+-+Rua+Hiroshi+Matsuda+Filho+-+Vila+Santa+Cecília,+Volta+Redonda+-+RJ,+Brasil';

export default function MapLocation(){
    const mapEmbedUrl = `${GOOGLE_MAPS_EMBED_BASE_URL}&key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}`;

    return(
        <div className={styles.mapLocation}>
            <div>
                <h1>Nossa Localização</h1>
                <a target='_blank' href={GOOGLE_MAPS_DIRECTIONS_URL}>
                    Rua Hiroshi Matsuda Filho, S/N - Vila Santa Cecília Volta Redonda/RJ - CEP: 27261-260 (Antiga Rua 90)
                </a>
            </div>
            <iframe
                className={styles.map}
                frameBorder="0"
                src={mapEmbedUrl}
                title="Mapa da localização do Clube dos Funcionários"
                loading="lazy"
            ></iframe>
        </div>
    )
}