"use client";

/**
 * Vitrine dos espaços sociais (churrasqueiras, salões, áreas de festa).
 *
 * Diferente das quadras: a unidade é o DIA inteiro e a reserva passa por
 * análise da secretaria antes do pagamento. Esta tela só mostra o catálogo
 * que a Lara devolve (`social/groups` e `social/groups/{id}/places`) — preço,
 * capacidade, convidados e regras como vieram.
 */

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
    faArrowRight,
    faChampagneGlasses,
    faCircleExclamation,
    faMagnifyingGlass,
    faRotateRight,
} from "@fortawesome/free-solid-svg-icons";
import globalStyle from "../../styles/page.module.css";
import ui from "../../styles/ui.module.css";
import replayStyle from "../../styles/replay.module.css";
import style from "../../styles/social.module.css";
import Header from "../components/Common/header";
import Footer from "../components/Common/footer";
import { Loading, LoadingScreen } from "../components/Common/loading";
import ReplayNotice from "../components/Replay/ReplayNotice";
import SocialPlaceFacts from "../components/Social/SocialPlaceFacts";
import { SocialCover } from "../components/UI/covers";
import { Media, MediaTag, PageHeader, SearchBar, matchesSearch } from "../components/UI/ui";
import {
    fetchSocialGroupPlaces,
    fetchSocialGroups,
    type SocialFailure,
    type SocialGroup,
    type SocialPlace,
} from "../../services/social-api";
import { formatBRL, socialSlug } from "../../utils/social";
import { placeImageUrl } from "../../utils/lighting";

interface GroupWithPlaces {
    group: SocialGroup;
    places: SocialPlace[];
    /** Regras do grupo: as do endpoint de espaços, senão as da lista de grupos. */
    rules: string | null;
}

export default function SocialSpacesPage() {
    const { status } = useSession();
    const [groups, setGroups] = useState<GroupWithPlaces[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<SocialFailure | null>(null);
    const [query, setQuery] = useState("");

    const load = useCallback(async () => {
        setLoading(true);
        setError(null);

        const groupsResult = await fetchSocialGroups();
        if (!groupsResult.ok) {
            setError(groupsResult);
            setLoading(false);
            return;
        }

        // Poucos grupos: busca os espaços de todos de uma vez.
        const withPlaces = await Promise.all(
            groupsResult.data.map(async (group): Promise<GroupWithPlaces> => {
                const placesResult = await fetchSocialGroupPlaces(group.id);
                return placesResult.ok
                    ? { group, places: placesResult.data.places, rules: placesResult.data.group?.rules ?? group.rules }
                    : { group, places: [], rules: group.rules };
            })
        );

        setGroups(withPlaces.filter((entry) => entry.places.length > 0));
        setLoading(false);
    }, []);

    useEffect(() => {
        if (status === "authenticated") load();
    }, [status, load]);

    if (status === "loading") return <LoadingScreen />;

    // Busca pelo grupo (mostra todos os espaços dele) ou pelo nome do espaço.
    const visibleGroups = groups
        .map((entry) =>
            matchesSearch(query, entry.group.name)
                ? entry
                : { ...entry, places: entry.places.filter((place) => matchesSearch(query, place.name)) }
        )
        .filter((entry) => entry.places.length > 0);

    let body: React.ReactNode;
    if (loading) {
        body = <Loading />;
    } else if (error) {
        body = (
            <ReplayNotice
                icon={faCircleExclamation}
                title="Não conseguimos carregar os espaços"
                description={error.error}
                tone="alert"
                action={
                    <button type="button" className={replayStyle.replayButton} onClick={() => load()}>
                        <FontAwesomeIcon icon={faRotateRight} /> Tentar novamente
                    </button>
                }
            />
        );
    } else if (groups.length === 0) {
        body = (
            <ReplayNotice
                icon={faChampagneGlasses}
                title="Nenhum espaço disponível para reserva agora"
                description="Fale com a secretaria para saber quando os espaços sociais voltam a ser oferecidos."
            />
        );
    } else {
        body = (
            <>
                <SearchBar id="busca-espacos" value={query} onChange={setQuery} placeholder="Buscar churrasqueira, salão ou espaço" />
                {visibleGroups.length === 0 ? (
                    <ReplayNotice
                        icon={faMagnifyingGlass}
                        title={`Nada encontrado para “${query}”`}
                        description="Confira a grafia ou limpe a busca."
                    />
                ) : (
                    visibleGroups.map(({ group, places, rules }) => (
                        <section key={group.id} className={style.groupBlock} aria-labelledby={`grupo-${group.id}`}>
                            <div className={style.groupHead}>
                                <h2 className={ui.sectionTitle} id={`grupo-${group.id}`}>{group.name}</h2>
                                <span className={ui.muted}>
                                    {places.length} espaço{places.length === 1 ? "" : "s"} · reserva de dia inteiro
                                </span>
                            </div>

                            {rules && (
                                <details className={style.rules}>
                                    <summary>Regras do clube para {group.name}</summary>
                                    <p className={style.rulesText}>{rules}</p>
                                </details>
                            )}

                            <div className={style.placeGrid}>
                                {places.map((place) => (
                                    <article key={place.id} className={style.placeCard}>
                                        <Media
                                            src={placeImageUrl(place.image)}
                                            alt={`Foto de ${place.name}`}
                                            area="social"
                                            icon={faChampagneGlasses}
                                            ratio="wide"
                                        >
                                            <MediaTag>
                                                <span className={ui.mono}>{formatBRL(place.price)}</span>&nbsp;/ diária
                                            </MediaTag>
                                        </Media>
                                        <div className={style.placeBody}>
                                            <h3 className={style.placeName}>{place.name}</h3>
                                            <SocialPlaceFacts place={place} />
                                        </div>
                                        <div className={style.placeFoot}>
                                            <Link
                                                href={`/espacos-sociais/${socialSlug(group.name, group.id)}/${socialSlug(place.name, place.id)}`}
                                                className={style.placeAction}
                                            >
                                                Ver datas e reservar <FontAwesomeIcon icon={faArrowRight} />
                                            </Link>
                                        </div>
                                    </article>
                                ))}
                            </div>
                        </section>
                    ))
                )}
            </>
        );
    }

    return (
        <div className={globalStyle.page}>
            <Header />
            <SocialCover />

            <main className={`${globalStyle.main} ${ui.page}`}>
                <PageHeader
                    title="Espaços sociais"
                    lead={
                        <>
                            Churrasqueiras e salões para o seu evento, reservados pelo <strong>dia inteiro</strong>. Você
                            escolhe a data e envia a pré-reserva; a secretaria analisa, faz o contrato com você e libera o
                            pagamento por aqui.
                        </>
                    }
                />

                {body}
            </main>

            <Footer />
        </div>
    );
}
