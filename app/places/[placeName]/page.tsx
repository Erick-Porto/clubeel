"use client"
import globalStyle from "@/styles/page.module.css";
import style from "@/styles/places.module.css"
import Footer from '@/components/footer';
import Header from '@/components/header';
import { useParams } from 'next/navigation';
import { useEffect, useState } from "react";
import API_CONSUME from "@/services/api-consume";
import Link from "next/link";
import withAuth from "@/components/auth";
import { useUser } from '@/context/UserContext';
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faChevronLeft, faChevronRight } from "@fortawesome/free-solid-svg-icons";

const PlacesPage = () => {
    const { accessToken } = useUser();
    const params = useParams();
    const placeName = params?.placeName as string | " ";
    const [places, setPlaces] = useState<{ name: string; image: string; id: string; schedule_rules: Array<any> }[]>([]);
    const [group, setGroup] = useState<{ name: string; image_horizontal: string } | null>(null);
    const placeId = placeName.split("%3A")[1]

    const [days, setDays] = useState(0);
    const [selectedDate, setSelectedDate] = useState(new Date());
    const [thisWeek, setThisWeek] = useState([new Date()]);
    const [currentTime, setCurrentTime] = useState(new Date().toLocaleString('pt-BR', { hour: '2-digit', minute: '2-digit' }));
    const [currentDate, setCurrentDate] = useState(new Date());
    const [maxAntecedence, setMaxAntecedence] = useState(0);

    // Função extraída para reutilização no timer
    const fetchPlaces = async () => {
        try {
            const response = await API_CONSUME("GET", `places/${placeId}`, {'Authorization': 'Bearer ' + process.env.NEXT_PUBLIC_API_TOKEN,'Session': accessToken}, null);
            const placesArray = Object.values(response.places) as { name: string; image: string; id: string; schedule_rules: Array<any> }[];

            setGroup(response.group);
            setPlaces(placesArray);
            setCurrentDate(new Date(Date.now()));

            let localMaxAntecedence = 0; 
            placesArray.forEach((item) => {
                item.schedule_rules.forEach((rule) => {
                    if (rule.antecedence > localMaxAntecedence) {
                        localMaxAntecedence = rule.antecedence; 
                    }
                });
            });
            setMaxAntecedence(localMaxAntecedence); 
            
            const updatedThisWeek: Date[] = [];
            for (let i = days - 7; i <= days + localMaxAntecedence; i++) {
                updatedThisWeek.push(new Date(Date.now() + i * 24 * 60 * 60 * 1000));
            }
            setThisWeek(updatedThisWeek);
        } catch (error) {
            console.error("Error fetching places:", error);
        }
    };

    useEffect(() => {
        fetchPlaces();
    }, [placeId, accessToken, days]);

    // Timer para atualizar regras a cada 30 segundos
    useEffect(() => {
        const interval = setInterval(() => {
            fetchPlaces();
        }, 30000);
        return () => clearInterval(interval);
    }, [placeId, accessToken, days]);
    
    useEffect(() => {
        setSelectedDate(new Date(Date.now()));

        const interval = setInterval(() => {
            setCurrentTime(new Date().toLocaleString('pt-BR', { hour: '2-digit', minute: '2-digit' }));
        }, 60000);

        return () => clearInterval(interval);
    }, []);

    function handlerDateSelection(date: Date) {
        setSelectedDate(date);
    }

    function handlerDateSelectionArrow(index: number, to: string) {
        const dateSelectionView = document.querySelector(`.${style.dateSelection}`);
        if (dateSelectionView) {
            dateSelectionView.style.transition = "transform 0.8s cubic-bezier(0.25, 0.8, 0.25, 1)";
            dateSelectionView.style.transform = `translateX(${to === 'next' ? '-2148px' : '0px'})`;

            setTimeout(() => {
                setDays(days + (to === 'next' ? +index : -index));
            }, 801);
            
            setTimeout(() => {
                dateSelectionView.style.transition = "none";
                dateSelectionView.style.transform = `translateX(-1074px)`;
            }, 801);
        }
    }
    return (
        <div className={globalStyle.page}>
            <Header options={null} surgeIn={0} onlyScroll={false}/>
            <section className={globalStyle.Section} style={{ paddingBottom: "20px" }}>
                <div
                    className={style.placeBanner}
                    style={{backgroundImage: `url(${group?.image_horizontal || ''})`}}
                >
                    <div className={style.placeBannerCover}>
                        <h1>{group?.name || 'Carregando...'}</h1>
                    </div>
                </div>

                <div className={style.dateSelectionContainer}>
                    <div
                        className={style.dateSelectionArrow}
                        onClick={() => { days >= 7 ? handlerDateSelectionArrow(7,"prev"): ''}}
                        style={days === 0 ? { opacity: 0, cursor: "default" } : {}}
                    >
                        <FontAwesomeIcon icon={faChevronLeft} />
                    </div>
                    <div className={style.dateSelectionContentView}>
                        <ul className={style.dateSelection} style={{ transform: "translateX(-1074px)" }}>
                            {thisWeek.map((item, index) => (
                                <li
                                    key={index}
                                    className={
                                        `${style.dateSelectionItem} ${selectedDate === item ? style.dateSelectedItem : ''}`
                                    }
                                    onClick={() => handlerDateSelection(item)}
                                >
                                    <span>{item.toLocaleDateString('pt-BR', {month:'2-digit', day:'2-digit'}).split('.')}</span>
                                    <span> - </span>
                                    <span>{item.toLocaleDateString('pt-BR',{weekday:'short'})}</span>
                                </li>
                            ))}
                        </ul>
                    </div>
                    <div 
                        className={style.dateSelectionArrow}
                        onClick={() => {maxAntecedence > 7 ? handlerDateSelectionArrow(7, "next"): ''}}
                        style={maxAntecedence <= 7 ? { opacity: 0, cursor: "default" } : {}}
                    >
                        <FontAwesomeIcon icon={faChevronRight} />
                    </div>
                </div>

                <div className={style.placeList}>
                    {
                    places.map((item, index)=>{
                        let itemIsValid = true;
                        item.schedule_rules.forEach((rule) => {
                            const endDate = new Date(rule.end_date);
                            const newSelectedDate = selectedDate
                            const startDate = new Date(rule.start_date);

                            let validRule = false
                            let weekdays = [null]

                            if (rule.weekdays !== null){
                                weekdays.shift()
                                rule.weekdays.forEach((item)=>{weekdays.push(item.name)})                                
                            }
                                

                            if(newSelectedDate >= startDate || newSelectedDate <= endDate)
                                validRule = true
                            else
                                validRule = false

                            if(validRule){
                                if(rule.type === 'exclude'){
                                    if(!weekdays.includes(null)){
                                        if (weekdays.includes(newSelectedDate.toLocaleDateString('en-AM', { weekday: 'long' }).toLowerCase().split('-')[0]))
                                            itemIsValid = false
                                        else
                                            itemIsValid = true
                                    }
                                    else
                                        itemIsValid = false
                                }

                                else if(rule.type === 'include'){
                                    if(rule.antecedence > 0){
                                        const limitDate = new Date(currentDate.getTime() + rule.antecedence * 24 * 60 * 60 * 1000);
                                        
                                        if (selectedDate.getTime() > limitDate.getTime())
                                            itemIsValid = false
                                        else
                                            itemIsValid = true
                                    }
                                    
                                    else if(selectedDate.getTime() > currentDate.getTime()){
                                        itemIsValid = false
                                    }

                                    if(itemIsValid){
                                        if(!weekdays.includes(null)){
                                            if (weekdays.includes(selectedDate.toLocaleDateString('en-AM', { weekday: "long" }).toLowerCase().split('-')[0]))
                                                itemIsValid = true
                                            else
                                                itemIsValid = false
                                        } else{
                                            itemIsValid = true
                                        }
                                    }

                                }
                            }
                        })

                        return (
                        <div key={index} className={`${style.placeCard} ${item.schedule_rules.length > 0 ? '' : style.placeCardDisabled} ${ itemIsValid ? '' : style.placeCardDisabled}`}>
                            <div
                                className={style.placeCardImage}
                                style={{backgroundImage: `url(${item.image})`}}></div>
                            <div className={style.placeCardInfo}>
                                <p>
                                    {item.name}
                                </p>
                                {item.schedule_rules.length === 0 || !itemIsValid ? 
                                    (
                                        <span>INDISPONÍVEL</span>
                                    ):
                                    (
                                        <Link 
                                            href={{
                                                pathname: `/place/${item.name.split(' ').join('-').toLowerCase()}-${item.id}`,
                                                query: { date: selectedDate.toISOString() }
                                            }}
                                        >
                                            RESERVAR
                                        </Link>
                                    )
                                }
                            </div>
                        </div>
                    )})}
                </div>
            </section>
            
            <Footer/>
        </div>
    );
};

export default withAuth(PlacesPage);