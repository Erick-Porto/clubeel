'use client'

import { KeyboardEvent, Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
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
    faTrophy,
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
import { Media, PageHeader, SearchBar, areaStyle, matchesSearch, type Area } from "./components/UI/ui";
import { fetchSocialGroups } from "../services/social-api";
import { fetchTournaments } from "../services/tournament-api";
import { tournamentHref } from "../utils/tournament";
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

/**
 * Abas da home: esportes (quadras), espaços sociais e torneios. A aba fica na
 * URL (`?area=social`, `?area=torneios`) para dar para mandar o link direto;
 * sem parâmetro, Esportes. Aba sem nada para mostrar (ou cuja leitura falhou)
 * não aparece.
 */
type HomeTab = 'quadras' | 'social' | 'torneios';

const TABS: { key: HomeTab; label: string; icon: typeof faVideo; action: string; search: string }[] = [
    { key: 'quadras', label: 'Esportes', icon: faTableTennisPaddleBall, action: 'Ver quadras e horários', search: 'Buscar esporte' },
    { key: 'social', label: 'Espaços sociais', icon: faChampagneGlasses, action: 'Ver espaços', search: 'Buscar espaço social' },
    { key: 'torneios', label: 'Torneios', icon: faTrophy, action: 'Ver torneio', search: 'Buscar torneio' },
];

/** Um cartão da home: um esporte (leva às quadras), um grupo de espaço social ou um torneio. */
interface HomeItem {
    key: string;
    name: string;
    image: string | null;
    href: string;
    area: HomeTab;
}

const SHORTCUTS: { href: string; title: string; text: string; icon: typeof faVideo; area: Area }[] = [
    { href: '/profile?tab=schedules', title: 'Meus agendamentos', text: 'Carrinho, horários confirmados e anteriores', icon: faCalendarCheck, area: 'perfil' },
    { href: '/meus-videos', title: 'Meus vídeos', text: 'Replays gravados nas suas reservas', icon: faVideo, area: 'replay' },
    { href: '/espacos-sociais/reservas', title: 'Minhas reservas sociais', text: 'Análise, pagamento e convidados', icon: faChampagneGlasses, area: 'social' },
    { href: '/torneios/inscricoes', title: 'Minhas inscrições em torneios', text: 'Pagamento, times e convites', icon: faTrophy, area: 'torneios' },
];

const HomeContent = () => {
    const [places, setPlaces] = useState<Place[]>([]);
    const [placesLoaded, setPlacesLoaded] = useState(false);
    // Espaços sociais ficam na aba própria, um cartão por grupo
    // (Churrasqueiras, Salões...), levando à vitrine deles.
    const [socialItems, setSocialItems] = useState<HomeItem[]>([]);
    const [tournamentItems, setTournamentItems] = useState<HomeItem[]>([]);
    const [query, setQuery] = useState("");

    const { data: session, status } = useSession();
    const router = useRouter();
    const searchParams = useSearchParams();

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
                    area: 'social',
                }))
            );
        });
        // Torneios: a mesma lista pública de /torneios, na ordem da Lara.
        fetchTournaments().then((result) => {
            if (!result.ok) return;
            setTournamentItems(
                result.data.map((tournament) => ({
                    key: `torneio-${tournament.id}`,
                    name: tournament.title,
                    image: tournament.image_url,
                    href: tournamentHref(tournament.title, tournament.id),
                    area: 'torneios',
                }))
            );
        });
    }, [status]);

    const sports = useMemo<HomeItem[]>(() => places
            .filter((place) => place.category === "esportiva")
            .map((place) => ({
                key: `sport-${place.id}`,
                name: place.name,
                image: place.image_horizontal || place.image_vertical || null,
                href: `/places/${place.name.replace(/\s+/g, '-').toLowerCase()}-${place.id}`,
                area: 'quadras' as const,
            })), [places]);

    const itemsOf: Record<HomeTab, HomeItem[]> = { quadras: sports, social: socialItems, torneios: tournamentItems };
    // Esportes sempre; as outras abas só com algo para mostrar. Com uma aba só
    // (nada de social nem de torneio, ou leituras que falharam) não há abas: a
    // home fica só com os esportes, como antes.
    const tabs = TABS.filter((entry) => entry.key === 'quadras' || itemsOf[entry.key].length > 0);
    const hasTabs = tabs.length > 1;
    const requested = searchParams?.get('area');
    const tab: HomeTab = tabs.find((entry) => entry.key === requested)?.key ?? 'quadras';
    const current = TABS.find((entry) => entry.key === tab)!;
    const tabItems = itemsOf[tab];

    const searchText: Record<HomeTab, string> = { quadras: 'esporte quadra', social: 'espaço social', torneios: 'torneio' };
    const matches = (item: HomeItem) => matchesSearch(query, item.name, searchText[item.area]);
    const visible = tabItems.filter(matches);
    // Nada nesta aba, mas a busca acha em outra: oferece trocar.
    const otherTab = query && visible.length === 0
        ? tabs.find((entry) => entry.key !== tab && itemsOf[entry.key].some(matches))
        : undefined;
    const otherMatches = otherTab ? itemsOf[otherTab.key].filter(matches).length : 0;

    const selectTab = (next: HomeTab) => {
        if (next === tab) return;
        // replace: trocar de aba não empilha histórico; o basePath (/homolog) o Next põe sozinho.
        router.replace(next === 'quadras' ? '/' : `/?area=${next}`, { scroll: false });
    };

    // Setas trocam de aba, como pede o padrão de abas (role=tablist).
    const onTabKey = (event: KeyboardEvent<HTMLDivElement>) => {
        if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
        event.preventDefault();
        const index = tabs.findIndex((entry) => entry.key === tab);
        const step = event.key === 'ArrowRight' ? 1 : -1;
        const next = tabs[(index + step + tabs.length) % tabs.length].key;
        selectTab(next);
        document.getElementById(`home-tab-${next}`)?.focus();
    };

    if (status === "loading") return <LoadingScreen />;

    const firstName = session?.user?.name?.split(' ')[0];

    return (
        <div className={globalStyle.page}>
            <Header />

            <main className={`${globalStyle.main} ${ui.page}`}>
                <PageHeader
                    title={firstName ? <>Olá, <span className={style.name}>{firstName.toLowerCase()}</span></> : "Início"}
                    lead={hasTabs
                        ? "Escolha um esporte para reservar horário, um espaço social para o seu evento ou um torneio para se inscrever."
                        : "Escolha um esporte para ver as quadras e os horários livres."}
                />

                <HomeLightingBanner />

                <section className={ui.section} aria-label="Áreas do clube">
                    {hasTabs && (
                        <div className={style.tabs} role="tablist" aria-label="Áreas do clube" onKeyDown={onTabKey}>
                            {tabs.map((entry) => {
                                const active = entry.key === tab;
                                const count = itemsOf[entry.key].length;
                                return (
                                    <button
                                        key={entry.key}
                                        id={`home-tab-${entry.key}`}
                                        type="button"
                                        role="tab"
                                        aria-selected={active}
                                        aria-controls="home-panel"
                                        tabIndex={active ? 0 : -1}
                                        className={`${style.tab} ${active ? style.tabActive : ''}`}
                                        style={areaStyle(entry.key)}
                                        onClick={() => selectTab(entry.key)}
                                    >
                                        <FontAwesomeIcon icon={entry.icon} />
                                        <span>{entry.label}</span>
                                        {(entry.key !== 'quadras' || placesLoaded) && (
                                            <span className={style.tabCount}>{count}</span>
                                        )}
                                    </button>
                                );
                            })}
                        </div>
                    )}

                    <div
                        id="home-panel"
                        className={style.panel}
                        role={hasTabs ? 'tabpanel' : undefined}
                        aria-labelledby={hasTabs ? `home-tab-${tab}` : 'home-areas'}
                    >
                        <div className={style.searchRow}>
                            <SearchBar
                                id="busca-home"
                                value={query}
                                onChange={setQuery}
                                placeholder={current.search}
                            />
                            {hasTabs ? (
                                tab === 'social' ? (
                                    <Link href="/espacos-sociais" className={style.panelLink}>
                                        Ver vitrine completa <FontAwesomeIcon icon={faArrowRight} />
                                    </Link>
                                ) : tab === 'torneios' ? (
                                    <Link href="/torneios" className={style.panelLink}>
                                        Ver todos os torneios <FontAwesomeIcon icon={faArrowRight} />
                                    </Link>
                                ) : null
                            ) : (
                                <span className={ui.label} id="home-areas">Áreas esportivas</span>
                            )}
                        </div>

                        {tab === 'quadras' && placesLoaded && sports.length === 0 ? (
                            <ReplayNotice
                                icon={faTableTennisPaddleBall}
                                title="Nenhum esporte para exibir"
                                description="Não há esportes disponíveis para reserva no momento."
                            />
                        ) : visible.length === 0 && query ? (
                            <ReplayNotice
                                icon={faMagnifyingGlass}
                                title={`Nada encontrado para “${query}”`}
                                description={otherTab
                                    ? `Não está em ${current.label}, mas a busca achou ${otherMatches} em ${otherTab.label}.`
                                    : "Confira a grafia ou limpe a busca."}
                                action={otherTab ? (
                                    <button
                                        type="button"
                                        className={`${ui.btn} ${ui.btnSecondary}`}
                                        onClick={() => selectTab(otherTab.key)}
                                    >
                                        Ver em {otherTab.label}
                                    </button>
                                ) : undefined}
                            />
                        ) : (
                            <div className={ui.grid}>
                                {visible.map((item) => (
                                    <Link key={item.key} href={item.href} className={`${ui.card} ${style.spotCard}`}>
                                        <Media
                                            src={item.image}
                                            alt={`Foto de ${item.name}`}
                                            area={item.area}
                                            icon={TABS.find((entry) => entry.key === item.area)!.icon}
                                        />
                                        <div className={ui.cardBody}>
                                            <h3 className={ui.cardTitle}>{item.name}</h3>
                                        </div>
                                        <div className={ui.cardFoot}>
                                            <span className={style.cardAction}>
                                                {TABS.find((entry) => entry.key === item.area)!.action}
                                            </span>
                                            <span className={ui.spacer} />
                                            <FontAwesomeIcon icon={faArrowRight} className={ui.muted} />
                                        </div>
                                    </Link>
                                ))}
                            </div>
                        )}
                    </div>
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

// useSearchParams (a aba vem da URL) exige um Suspense em volta na página.
const Home = () => (
    <Suspense fallback={<LoadingScreen />}>
        <HomeContent />
    </Suspense>
);

export default Home;
