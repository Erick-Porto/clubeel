'use client'

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { toast } from "react-toastify";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
    faArrowRight,
    faCalendarCheck,
    faChampagneGlasses,
    faChevronRight,
    faMagnifyingGlass,
    faTableTennisPaddleBall,
    faVideo,
} from "@fortawesome/free-solid-svg-icons";
import globalStyle from "../styles/page.module.css";
import ui from "../styles/ui.module.css";
import style from "../styles/home.module.css";
import Footer from "./components/Common/footer";
import Header from "./components/Common/header";
import { LoadingScreen } from "./components/Common/loading";
import API_CONSUME from "../services/api-consume";
import HomeLightingBanner from "./components/Lighting/HomeLightingBanner";
import ReplayNotice from "./components/Replay/ReplayNotice";
import { Media, MediaTag, PageHeader, SearchBar, areaStyle, matchesSearch, type Area } from "./components/UI/ui";
import { fetchSocialGroups } from "../services/social-api";
import { placeImageUrl } from "../utils/lighting";

// O mapa interativo (MapBanner), a seção "Social" antiga e o tutorial da home
// continuam desligados (ver docs/resumo-modulos/04-agendamento-quadras.md).

interface Point { x: number; y: number; }
interface Place {
    id: number;
    name: string; icon: string; image_vertical: string;
    image_horizontal: string; vertices: Point[]; category: string;
}

interface ApiPlaceData {
    id?: string | number;
    vertices: string | number[][];
    [key: string]: unknown;
}

/** Um cartão da home: um esporte (leva às quadras) ou um grupo de espaço social. */
interface HomeItem {
    key: string;
    name: string;
    image: string | null;
    href: string;
    social: boolean;
}

const SHORTCUTS: { href: string; title: string; text: string; icon: typeof faVideo; area: Area }[] = [
    { href: '/profile?tab=schedules', title: 'Meus agendamentos', text: 'Carrinho, horários confirmados e anteriores', icon: faCalendarCheck, area: 'perfil' },
    { href: '/meus-videos', title: 'Meus vídeos', text: 'Replays gravados nas suas reservas', icon: faVideo, area: 'replay' },
    { href: '/espacos-sociais/reservas', title: 'Minhas reservas sociais', text: 'Análise, pagamento e convidados', icon: faChampagneGlasses, area: 'social' },
];

const Home = () => {
    const [places, setPlaces] = useState<Place[]>([]);
    const [placesLoaded, setPlacesLoaded] = useState(false);
    // Espaços sociais entram no fim da mesma grade, um cartão por grupo
    // (Churrasqueiras, Salões...), levando à vitrine deles.
    const [socialItems, setSocialItems] = useState<HomeItem[]>([]);
    const [query, setQuery] = useState("");

    const { data: session, status } = useSession();

    useEffect(() => {
        const fetchPlaces = async () => {
            if (status !== 'authenticated' || !session?.accessToken) {
                toast.error("Sessão inválida. Por favor, faça login novamente.");
                return;
            }

            try {
                const response = await API_CONSUME("GET", "places/group");

                if (!response.ok || !response.data) {
                    toast.error("Erro ao buscar locais: " + response.message);
                }

                const rawPlacesArray = Object.values(response.data) as ApiPlaceData[];

                const transformedPlaces = rawPlacesArray.map((apiPlace): Place => {
                    let parsedVertices: number[][] = [];

                    if (typeof apiPlace.vertices === 'string') {
                        try {
                            parsedVertices = JSON.parse(apiPlace.vertices) as number[][];
                        } catch {}
                    } else if (Array.isArray(apiPlace.vertices)) {
                        parsedVertices = apiPlace.vertices as number[][];
                    }

                    return {
                        ...(apiPlace as unknown as Place),
                        id: Number(apiPlace.id),
                        vertices: parsedVertices.map(v => ({ x: v[0], y: v[1] }))
                    };
                });
                setPlaces(transformedPlaces);
            } catch (error) {
                toast.error("Erro ao processar locais: " + (error instanceof Error ? error.message : String(error)));
            } finally {
                setPlacesLoaded(true);
            }
        };
        if (status === 'authenticated') fetchPlaces();
    }, [session, status]);

    useEffect(() => {
        if (status !== 'authenticated') return;
        // Os grupos sociais vêm de outro endpoint (social/groups — as rotas de
        // quadra não listam espaço social). Falha aqui não atrapalha a home:
        // a grade segue só com os esportes.
        fetchSocialGroups().then((result) => {
            if (!result.ok) return;
            setSocialItems(
                result.data.map((group) => ({
                    key: `social-${group.id}`,
                    name: group.name,
                    image: placeImageUrl(group.image_horizontal) ?? placeImageUrl(group.image_vertical),
                    href: '/espacos-sociais',
                    social: true,
                }))
            );
        });
    }, [status]);

    const items = useMemo<HomeItem[]>(() => {
        const sports = places
            .filter((place) => place.category === "esportiva")
            .map((place) => ({
                key: `sport-${place.id}`,
                name: place.name,
                image: place.image_horizontal || place.image_vertical || null,
                href: `/places/${place.name.replace(/\s+/g, '-').toLowerCase()}-${place.id}`,
                social: false,
            }));
        return [...sports, ...socialItems];
    }, [places, socialItems]);

    const visible = items.filter((item) => matchesSearch(query, item.name, item.social ? 'espaço social' : 'esporte quadra'));

    if (status === "loading") return <LoadingScreen />;

    const firstName = session?.user?.name?.split(' ')[0];

    return (
        <div className={globalStyle.page}>
            <Header />

            <main className={`${globalStyle.main} ${ui.page}`}>
                <PageHeader
                    title={firstName ? <>Olá, <span className={style.name}>{firstName.toLowerCase()}</span></> : "Início"}
                    lead={socialItems.length > 0
                        ? "Escolha um esporte para reservar horário ou um espaço social para o seu evento."
                        : "Escolha um esporte para ver as quadras e os horários livres."}
                />

                <HomeLightingBanner />

                <section className={ui.section} aria-labelledby="home-areas">
                    <div className={style.searchRow}>
                        <SearchBar id="busca-home" value={query} onChange={setQuery} placeholder="Buscar esporte ou espaço" />
                        <span className={ui.label} id="home-areas">
                            {socialItems.length > 0 ? "Áreas esportivas e sociais" : "Áreas esportivas"}
                        </span>
                    </div>

                    {placesLoaded && items.length === 0 ? (
                        <ReplayNotice
                            icon={faTableTennisPaddleBall}
                            title="Nenhum local para exibir"
                            description="Não há esportes disponíveis para reserva no momento."
                        />
                    ) : visible.length === 0 && query ? (
                        <ReplayNotice
                            icon={faMagnifyingGlass}
                            title={`Nada encontrado para “${query}”`}
                            description="Confira a grafia ou limpe a busca."
                        />
                    ) : (
                        <div className={ui.grid}>
                            {visible.map((item) => (
                                <Link key={item.key} href={item.href} className={`${ui.card} ${style.spotCard}`}>
                                    <Media
                                        src={item.image}
                                        alt={`Foto de ${item.name}`}
                                        area={item.social ? 'social' : 'quadras'}
                                        icon={item.social ? faChampagneGlasses : faTableTennisPaddleBall}
                                    >
                                        {item.social && <MediaTag icon={faChampagneGlasses}>Espaço social</MediaTag>}
                                    </Media>
                                    <div className={ui.cardBody}>
                                        <h3 className={ui.cardTitle}>{item.name}</h3>
                                    </div>
                                    <div className={ui.cardFoot}>
                                        <span className={style.cardAction}>
                                            {item.social ? "Ver espaços" : "Ver quadras e horários"}
                                        </span>
                                        <span className={ui.spacer} />
                                        <FontAwesomeIcon icon={faArrowRight} className={ui.muted} />
                                    </div>
                                </Link>
                            ))}
                        </div>
                    )}
                </section>

                <section className={ui.section} aria-labelledby="home-atalhos">
                    <h2 className={ui.sectionTitle} id="home-atalhos">Atalhos</h2>
                    <div className={ui.grid}>
                        {SHORTCUTS.map((shortcut) => (
                            <Link key={shortcut.href} href={shortcut.href} className={`${ui.card} ${style.shortcut}`} style={areaStyle(shortcut.area)}>
                                <span className={style.shortcutGlyph}>
                                    <FontAwesomeIcon icon={shortcut.icon} />
                                </span>
                                <span className={style.shortcutText}>
                                    <strong>{shortcut.title}</strong>
                                    <span>{shortcut.text}</span>
                                </span>
                                <FontAwesomeIcon icon={faChevronRight} className={ui.muted} />
                            </Link>
                        ))}
                    </div>
                </section>
            </main>

            <Footer />
        </div>
    );
}

export default Home;
