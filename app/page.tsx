'use client'

import { useEffect, useState, useRef } from "react";
import style from "@/styles/page.module.css";
import Footer from "@/components/footer";
import Header, { HeaderOption } from "@/components/header";
import MobileNavBar from "./components/mobileNavBar";
import SportiveSquare from "@/components/sportive-square";
import MapBanner from "@/components/map-banner";
import API_CONSUME from "@/services/api-consume";
import { useSession } from "next-auth/react";
import { useIsMobile } from "./hooks/useIsMobile";
import TutorialOverlay, { TutorialStep } from "@/components/tutorial-overlay";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faHandPointer } from "@fortawesome/free-solid-svg-icons";

interface Point { x: number; y: number; }
interface Place {
    id: number; // FIX: Changed from string to number to match SportiveSquare
    name: string; icon: string; image_vertical: string;
    image_horizontal: string; vertices: Point[]; category: string;
}

interface ApiPlaceData {
    id?: string | number; // Explicitly define id to avoid 'any' casting
    vertices: string | number[][];
    [key: string]: unknown; // Permite outras propriedades
}

const NAV_OPTIONS: HeaderOption[] = [
    { text: "Mapa", id: "mapa" },
    { text: "Esportes", id: "esportivas" },
    // { text: "Social", id: "sociais" }
];

// 2. Configuração dos Passos
const TUTORIAL_STEPS: TutorialStep[] = [
    {
        targetId: 'map-section',
        title: 'Explore o Clube',
        description: ( <p><FontAwesomeIcon icon={faHandPointer} /> Use o zoom para navegar pelo mapa.</p> ),
        offset: -700,
        mOffset: -450
    },
    {
        targetId: 'hotspot-0',
        title: 'Encontre Disponibilidade',
        description: ( <p> Ícones piscantes indicam quadras disponíveis. Clique em um para ver o local.</p> ),
        offset: -50,
        mOffset: -30,
        waitForAction: true // O botão "Próximo" some, forçando o usuário a clicar no mapa/link real
    },
    {
        targetId: 'popup-places', // Continua no mapa
        title: 'Inicie a Reserva',
        description: 'Clique em "Ver Detalhes e Reservar" no popup da quadra para avançar para a próxima etapa.',
        offset: 150,
        mOffset: 5,
        waitForAction: true // O botão "Próximo" some, forçando o usuário a clicar no mapa/link real
    }
];

const Home = () => {
    const [activeSection, setActiveSection] = useState<'mapa' | 'esportivas' | 'sociais'>('mapa');
    const [places, setPlaces] = useState<Place[]>([]);
    const isClicking = useRef(false);
    
    const { data: session, status } = useSession();
    const isMobile = useIsMobile();

    const pageContainerRef = useRef<HTMLDivElement>(null);
    const mainContainerRef = useRef<HTMLDivElement>(null);
    const mapRef = useRef<HTMLDivElement>(null);
    const sportsRef = useRef<HTMLDivElement>(null);
    // const socialRef = useRef<HTMLDivElement>(null);

    // Fetch Data (Mantido)
    useEffect(() => {
        const fetchPlaces = async () => {
            if (status !== 'authenticated' || !session?.accessToken) return;
            try {
                const response = await API_CONSUME("GET", "places/group/", {
                    'Session': session?.accessToken || '',
                });
                const rawPlacesArray = Object.values(response || {}) as ApiPlaceData[];
                
                const transformedPlaces = rawPlacesArray.map((apiPlace): Place => {
                    // CORREÇÃO: Tipagem explícita para array de arrays de números
                    let parsedVertices: number[][] = [];
                    
                    if (typeof apiPlace.vertices === 'string') {
                        // CORREÇÃO: Removido 'e' não utilizado no catch
                        try { 
                            parsedVertices = JSON.parse(apiPlace.vertices) as number[][]; 
                        } catch {}
                    } else if (Array.isArray(apiPlace.vertices)) {
                        parsedVertices = apiPlace.vertices as number[][];
                    }
                    
                    // Asserção de tipo segura para o restante das props, assumindo que apiPlace tem o formato correto
                    return { 
                        ...(apiPlace as unknown as Place), 
                        id: Number(apiPlace.id), // FIX: Use explicitly defined optional id
                        vertices: parsedVertices.map(v => ({ x: v[0], y: v[1] })) 
                    };
                });
                setPlaces(transformedPlaces);
            } catch (error) { console.error("Error fetching places:", error); }
        };
        fetchPlaces();
    }, [session, status]);

    // ... (Efeitos de scroll e navegação mantidos iguais) ...
    
    // Foco Inicial Mobile
    // useEffect(() => {
    //     if (isMobile && mainContainerRef.current && places.length > 0) {
    //          setTimeout(() => {
    //             const width = window.innerWidth;
    //             mainContainerRef.current?.scrollTo({ left: width, behavior: 'auto' });
    //         }, 200);
    //     }
    // }, [isMobile, places.length]);

    // Scroll Spy
    useEffect(() => {
        const container = isMobile ? mainContainerRef.current : pageContainerRef.current;
        const target = isMobile ? mainContainerRef.current : null; 

        if (!container) return;

        const options = {
            root: target, 
            threshold: 0.4
        };

        const observer = new IntersectionObserver((entries) => {
            if (isClicking.current) return;

            entries.forEach((entry) => {
                if (entry.isIntersecting) {
                    const id = entry.target.id;
                    if (id === 'mapa') setActiveSection('mapa');
                    if (id === 'esportes') setActiveSection('esportivas');
                    // if (id === 'social') setActiveSection('sociais');
                }
            });
        }, options);

        if (mapRef.current) observer.observe(mapRef.current);
        if (sportsRef.current) observer.observe(sportsRef.current);
        // if (socialRef.current) observer.observe(socialRef.current);

        return () => observer.disconnect();
    }, [isMobile, places]);

    const handleNavigation = (id: string) => {
        isClicking.current = true;
        setActiveSection(id as 'mapa' | 'esportivas' | 'sociais');

        let targetRef = null;
        if (id === 'mapa') targetRef = mapRef;
        if (id === 'esportivas') targetRef = sportsRef;
        // if (id === 'sociais') targetRef = socialRef;

        if (targetRef?.current) {
            targetRef.current.scrollIntoView({
                behavior: 'smooth',
                block: 'start',
                inline: 'start'
            });
        }

        setTimeout(() => { isClicking.current = false; }, 1000);
    };

    if (status === "loading") return <div>Carregando...</div>;

    return (
        <div className={`${style.page} ${isMobile ? style.homePage : ''}`} ref={pageContainerRef}> 
            
            <TutorialOverlay steps={TUTORIAL_STEPS} pageKey="v1_home_guide" />

            <Header 
                options={NAV_OPTIONS} 
                surgeIn={0} 
                onlyScroll={true}
                activeSection={activeSection}
                onNavigate={handleNavigation}
            />

            <div className={style.main} ref={mainContainerRef}>
                
                {/* 4. Adicionado ID 'map-section' para o tutorial encontrar */}
                <section className={`${style.Section} ${style.sectionMap}`} ref={mapRef} id="mapa">
                    <div id="map-section" style={{width: '100%', height: '100%', display:'flex', flexDirection:'column', alignItems:'center'}}>
                         {!isMobile && <h1 className={style.sectionTitle}>Mapa do Clube</h1>}
                        <div className={style.contentWrapper}>
                            {/* FIX: Convert ID to string for MapBanner which expects Hotspot[] (id: string) */}
                            <MapBanner places={places.filter(p => p.vertices && p.vertices.length > 0).map(p => ({ ...p, id: String(p.id) }))} />
                        </div>
                    </div>
                </section>
                
                <section className={`${style.Section} ${style.sectionSports}`} ref={sportsRef} id="esportes">
                    <div className={style.contentWrapper}>
                        <h1 className={style.sectionTitle}>Áreas Esportivas</h1>
                        <SportiveSquare places={places.filter(p => p.category === "esportiva")}/>
                    </div>
                </section>

                {/* <section className={`${style.Section} ${style.sectionSocial}`} ref={socialRef} id="social">
                    <div className={style.contentWrapper}>
                        <h1 className={style.sectionTitle}>Áreas Sociais</h1>
                        <SportiveSquare places={places.filter(p => p.category === "social")}/>
                        {places.filter(p => p.category === "social").length === 0 && (
                            <div style={{opacity: 0.5, marginTop: 20}}>Áreas sociais em breve</div>
                        )}
                    </div>
                </section> */}

                <div className={style.footerContainer}>
                    <Footer/>
                </div>

            </div>
            
            {isMobile && (
                <MobileNavBar 
                    onNavigate={(id) => handleNavigation(id)} 
                    activeSection={activeSection} 
                />
            )}
        </div>
    );
}

export default Home;