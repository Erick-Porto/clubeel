import styles from '@/styles/map-location.module.css'


export default function MapLocation(){
    return(

        <div className={styles.mapLocation}>
            <div>
                <h1>Nossa Localização</h1>
                <a target='_blank' href='https://www.google.com/maps/dir//Clube+dos+Funcion%C3%A1rios+da+CSN+Rua+Hiroshi+Matsuda+Filho,+S%2FN+-+Vila+Santa+Cec%C3%ADlia+Volta+Redonda+-+RJ+27261-260/@-22.5287877,-44.1097089,18z/data=!4m5!4m4!1m0!1m2!1m1!1s0x9e986e0605bb79:0x84c8b48f044ac024'>Rua Hiroshi Matsuda Filho, S/N - Vila Santa Cecília Volta Redonda/RJ - CEP: 27261-260 (Antiga Rua 90)</a>
            </div>
            <iframe
                className={styles.map}
                frameBorder="0"
                src="
                https://www.google.com/maps/embed/v1/place?q=Clube+dos+Funcionários+da+CSN+-+Rua+Hiroshi+Matsuda+Filho+-+Vila+Santa+Cecília,+Volta+Redonda+-+RJ,+Brasil&key=AIzaSyBFw0Qbyq9zTFTd-tUY6dZWTgaQzuU17R8"
            ></iframe>
        </div>
    )}