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
import { faCalendarCheck, faCircleExclamation, faRotateRight, faChampagneGlasses } from "@fortawesome/free-solid-svg-icons";
import globalStyle from "../../styles/page.module.css";
import replayStyle from "../../styles/replay.module.css";
import style from "../../styles/social.module.css";
import Header from "../components/Common/header";
import Footer from "../components/Common/footer";
import { Loading, LoadingScreen } from "../components/Common/loading";
import ReplayNotice from "../components/Replay/ReplayNotice";
import SocialPlaceFacts from "../components/Social/SocialPlaceFacts";
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
        body = groups.map(({ group, places, rules }) => {
            const banner = placeImageUrl(group.image_horizontal);
            return (
                <section key={group.id} className={style.groupBlock}>
                    <div
                        className={style.groupBanner}
                        style={banner ? { backgroundImage: `url(${banner})` } : undefined}
                    >
                        <div className={style.groupBannerText}>
                            <h2>{group.name}</h2>
                            <span>
                                {places.length} espaço{places.length === 1 ? "" : "s"} · reserva de dia inteiro
                            </span>
                        </div>
                    </div>

                    {rules && (
                        <details className={style.rules}>
                            <summary>Regras do clube para {group.name}</summary>
                            <p className={style.rulesText}>{rules}</p>
                        </details>
                    )}

                    <div className={style.placeGrid}>
                        {places.map((place) => {
                            const image = placeImageUrl(place.image);
                            return (
                                <article key={place.id} className={style.placeCard}>
                                    <div
                                        className={style.placeImage}
                                        style={image ? { backgroundImage: `url(${image})` } : undefined}
                                        role="img"
                                        aria-label={`Foto de ${place.name}`}
                                    >
                                        <span className={style.priceTag}>{formatBRL(place.price)} / diária</span>
                                    </div>
                                    <div className={style.placeBody}>
                                        <h3 className={style.placeName}>{place.name}</h3>
                                        <SocialPlaceFacts place={place} />
                                        <Link
                                            href={`/espacos-sociais/${socialSlug(group.name, group.id)}/${socialSlug(place.name, place.id)}`}
                                            className={style.placeAction}
                                        >
                                            Ver datas e reservar
                                        </Link>
                                    </div>
                                </article>
                            );
                        })}
                    </div>
                </section>
            );
        });
    }

    return (
        <div className={globalStyle.page}>
            <Header options={null} surgeIn={0} onlyScroll={false} />

            <section className={replayStyle.replaySection}>
                <div className={replayStyle.replayHeader}>
                    <h1 className={replayStyle.replayTitle}>Espaços sociais</h1>
                    <p className={replayStyle.replayLead}>
                        Churrasqueiras e salões para o seu evento, reservados pelo <strong>dia inteiro</strong>. Você
                        escolhe a data e envia a pré-reserva; a secretaria analisa, faz o contrato com você e libera o
                        pagamento por aqui.
                    </p>
                    <div className={style.headerActions}>
                        <Link href="/espacos-sociais/reservas" className={style.secondaryButton}>
                            <FontAwesomeIcon icon={faCalendarCheck} /> Minhas reservas sociais
                        </Link>
                    </div>
                </div>

                {body}
            </section>

            <Footer />
        </div>
    );
}
