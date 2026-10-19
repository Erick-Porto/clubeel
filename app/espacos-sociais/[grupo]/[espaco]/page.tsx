"use client";

/**
 * Página de um espaço social: calendário do mês, limites do sócio no grupo e,
 * ao clicar numa data disponível, a pré-reserva.
 *
 * Nada aqui é decidido no front. O status de cada dia vem de
 * `social/availability`; o limite é só um aviso (`social/limits`) — quem
 * aceita ou recusa é o POST, e a recusa volta com `reason`, que decide o que
 * reler (calendário, limites, bebidas).
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { toast } from "react-toastify";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCircleExclamation, faRotateRight } from "@fortawesome/free-solid-svg-icons";
import globalStyle from "../../../../styles/page.module.css";
import ui from "../../../../styles/ui.module.css";
import { SocialCover } from "../../../components/UI/covers";
import { Media, PageHeader } from "../../../components/UI/ui";
import replayStyle from "../../../../styles/replay.module.css";
import style from "../../../../styles/social.module.css";
import Header from "../../../components/Common/header";
import Footer from "../../../components/Common/footer";
import { Loading, LoadingScreen } from "../../../components/Common/loading";
import ReplayNotice from "../../../components/Replay/ReplayNotice";
import SocialCalendar from "../../../components/Social/SocialCalendar";
import SocialBookingForm, { type SocialCatalog } from "../../../components/Social/SocialBookingForm";
import SocialPlaceFacts from "../../../components/Social/SocialPlaceFacts";
import SocialFlashBox from "../../../components/Social/SocialFlashBox";
import {
    fetchSocialCatalog,
    fetchSocialCalendar,
    fetchSocialGroupPlaces,
    fetchSocialGroups,
    fetchSocialLimits,
    type SocialBooking,
    type SocialCalendar as SocialCalendarData,
    type SocialFailure,
    type SocialGroup,
    type SocialLimits,
    type SocialPlace,
} from "../../../../services/social-api";
import {
    CONTACT_NOTICE,
    currentClubMonth,
    formatBRL,
    idFromSlug,
    refusalFlash,
    shiftMonth,
    type SocialFlash,
} from "../../../../utils/social";
import { placeImageUrl } from "../../../../utils/lighting";

/** Sem antecedência máxima informada, deixa navegar um ano (os dias vêm `out_of_window` mesmo). */
const DEFAULT_MONTHS_AHEAD = 12;

/**
 * Último mês navegável: hoje + `maximum_antecedence` dias. É só o limite das
 * setas — dentro do mês, quem diz o que está fora da janela é a Lara.
 */
function lastNavigableMonth(maximumAntecedence: number): string {
    const start = currentClubMonth();
    if (maximumAntecedence <= 0) return shiftMonth(start, DEFAULT_MONTHS_AHEAD);
    const date = new Date();
    date.setDate(date.getDate() + maximumAntecedence);
    const month = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    return month < start ? start : month;
}

export default function SocialPlacePage() {
    const { status } = useSession();
    const router = useRouter();
    const params = useParams();
    const groupId = idFromSlug(params?.grupo as string | undefined);
    const placeId = idFromSlug(params?.espaco as string | undefined);

    const [group, setGroup] = useState<SocialGroup | null>(null);
    const [groupName, setGroupName] = useState("");
    const [rules, setRules] = useState<string | null>(null);
    const [place, setPlace] = useState<SocialPlace | null>(null);
    const [catalog, setCatalog] = useState<SocialCatalog>({ beverages: [], furniture: [] });
    const [limits, setLimits] = useState<SocialLimits | null>(null);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState<string | null>(null);

    const [month, setMonth] = useState(currentClubMonth);
    const [calendar, setCalendar] = useState<SocialCalendarData | null>(null);
    const [calendarLoading, setCalendarLoading] = useState(false);
    const [selectedDate, setSelectedDate] = useState<string | null>(null);
    // O formulário aparece na primeira data escolhida e não some mais: se a data
    // for recusada, o sócio escolhe outra sem perder o que já preencheu.
    const [formOpen, setFormOpen] = useState(false);
    const [flash, setFlash] = useState<SocialFlash | null>(null);

    const flashRef = useRef<HTMLDivElement>(null);
    const formRef = useRef<HTMLDivElement>(null);
    // Descarta respostas de um mês que o sócio já deixou para trás.
    const calendarRequest = useRef(0);

    const loadLimits = useCallback(async () => {
        if (!groupId) return;
        const result = await fetchSocialLimits(groupId);
        if (result.ok) setLimits(result.data);
    }, [groupId]);

    const loadCatalog = useCallback(async () => {
        // Bebidas e mesas/cadeiras. Catálogo que falhar volta vazio: a
        // pré-reserva segue sem aqueles itens.
        setCatalog(await fetchSocialCatalog());
    }, []);

    const loadPlace = useCallback(async () => {
        if (!groupId || !placeId) {
            setLoadError("Endereço de espaço inválido.");
            setLoading(false);
            return;
        }

        setLoading(true);
        setLoadError(null);

        const [placesResult, groupsResult] = await Promise.all([
            fetchSocialGroupPlaces(groupId),
            fetchSocialGroups(),
            loadLimits(),
            loadCatalog(),
        ]);

        if (!placesResult.ok) {
            setLoadError(placesResult.error);
            setLoading(false);
            return;
        }

        const found = placesResult.data.places.find((item) => item.id === placeId) ?? null;
        const listedGroup = groupsResult.ok ? groupsResult.data.find((item) => item.id === groupId) ?? null : null;

        setPlace(found);
        setGroup(listedGroup);
        setGroupName(placesResult.data.group?.name ?? listedGroup?.name ?? "");
        setRules(placesResult.data.group?.rules ?? listedGroup?.rules ?? null);
        if (!found) setLoadError("Este espaço não está disponível para reserva.");
        setLoading(false);
    }, [groupId, placeId, loadLimits, loadCatalog]);

    const loadCalendar = useCallback(async () => {
        if (!placeId) return;
        const request = ++calendarRequest.current;
        setCalendarLoading(true);
        const result = await fetchSocialCalendar(placeId, month);
        if (request !== calendarRequest.current) return;
        if (result.ok) {
            // A Lara pode não ecoar `month`: o pedido foi deste mês.
            setCalendar({ ...result.data, month });
        } else {
            setCalendar(null);
            if (result.kind !== "unauthorized") toast.error(result.error);
        }
        setCalendarLoading(false);
    }, [placeId, month]);

    useEffect(() => {
        if (status === "authenticated") loadPlace();
    }, [status, loadPlace]);

    useEffect(() => {
        if (status === "authenticated" && place) loadCalendar();
    }, [status, place, loadCalendar]);

    const selectDate = (date: string) => {
        setSelectedDate(date);
        setFormOpen(true);
        setFlash(null);
        // No celular o formulário fica embaixo do calendário.
        requestAnimationFrame(() => formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
    };

    const onCreated = (booking: SocialBooking) => {
        toast.success(`Pré-reserva enviada! ${CONTACT_NOTICE}`, { autoClose: 9000 });
        router.push(booking.id > 0 ? `/espacos-sociais/reservas/${booking.id}` : "/espacos-sociais/reservas");
    };

    /** O `reason` decide o que reler; o texto exibido vem de utils/social.ts + Lara. */
    const onRefusal = (failure: SocialFailure) => {
        if (failure.kind === "unauthorized") return; // o interceptor já levou ao login
        if (failure.kind === "server" && failure.status >= 500) return; // API_CONSUME já avisou

        setFlash(refusalFlash(failure, "Não foi possível enviar a pré-reserva"));
        requestAnimationFrame(() => flashRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }));

        switch (failure.reason) {
            case "date_unavailable":
            case "date_blocked":
            case "out_of_window":
                setSelectedDate(null);
                loadCalendar();
                break;
            case "limit_reached":
                loadLimits();
                break;
            case "beverage_unavailable":
            case "item_limit":
                loadCatalog();
                break;
            case "place_not_social":
                loadPlace();
                break;
        }
    };

    if (status === "loading") return <LoadingScreen />;

    const banner = placeImageUrl(place?.image ?? null) ?? placeImageUrl(group?.image_horizontal ?? null);
    const startMonth = currentClubMonth();
    const lastMonth = lastNavigableMonth(group?.maximum_antecedence ?? 0);
    const activeLimitReached = limits?.active ? limits.active.remaining <= 0 : false;

    let body: React.ReactNode;
    if (loading) {
        body = <Loading />;
    } else if (loadError || !place) {
        body = (
            <ReplayNotice
                icon={faCircleExclamation}
                title="Não conseguimos abrir este espaço"
                description={loadError ?? undefined}
                tone="alert"
                action={
                    <button type="button" className={replayStyle.replayButton} onClick={() => loadPlace()}>
                        <FontAwesomeIcon icon={faRotateRight} /> Tentar novamente
                    </button>
                }
            />
        );
    } else {
        body = (
            <div className={style.placeLayout}>
                <div className={style.detailColumn}>
                    <div className={style.panel}>
                        <h2 className={style.panelTitle}>{formatBRL(place.price)} / diária</h2>
                        <SocialPlaceFacts place={place} />
                    </div>

                    {limits && (limits.active || limits.window) && (
                        <div className={style.panel}>
                            <h2 className={style.panelTitle}>Seus limites neste grupo</h2>
                            {limits.active && (
                                <p className={activeLimitReached ? style.limitWarning : style.limitNote}>
                                    {activeLimitReached ? (
                                        <>
                                            Você já tem {limits.active.used} reserva{limits.active.used === 1 ? "" : "s"}{" "}
                                            ativa{limits.active.used === 1 ? "" : "s"} neste grupo — o limite é{" "}
                                            {limits.active.limit}. Uma nova pré-reserva provavelmente será recusada.
                                        </>
                                    ) : (
                                        <>
                                            Você ainda pode ter <strong>{limits.active.remaining}</strong> reserva
                                            {limits.active.remaining === 1 ? "" : "s"} ativa
                                            {limits.active.remaining === 1 ? "" : "s"} neste grupo (limite de{" "}
                                            {limits.active.limit}).
                                        </>
                                    )}
                                </p>
                            )}
                            {limits.window && (
                                <p className={style.limitNote}>
                                    No máximo <strong>{limits.window.limit}</strong> reserva
                                    {limits.window.limit === 1 ? "" : "s"} a cada {limits.window.days} dias.
                                </p>
                            )}
                        </div>
                    )}

                    {rules && (
                        <details className={style.rules}>
                            <summary>Regras do clube{groupName ? ` para ${groupName}` : ""}</summary>
                            <p className={style.rulesText}>{rules}</p>
                        </details>
                    )}
                </div>

                <div className={style.detailColumn}>
                    <SocialCalendar
                        month={month}
                        calendar={calendar}
                        loading={calendarLoading}
                        selectedDate={selectedDate}
                        onSelect={selectDate}
                        onPrev={() => setMonth((current) => shiftMonth(current, -1))}
                        onNext={() => setMonth((current) => shiftMonth(current, 1))}
                        canPrev={month > startMonth}
                        canNext={month < lastMonth}
                    />

                    <div ref={flashRef}>{flash && <SocialFlashBox flash={flash} onClose={() => setFlash(null)} />}</div>

                    <div ref={formRef}>
                        {formOpen ? (
                            <SocialBookingForm
                                place={place}
                                date={selectedDate}
                                catalog={catalog}
                                onSaved={onCreated}
                                onRefusal={onRefusal}
                            />
                        ) : (
                            <p className={style.notice}>Escolha uma data disponível no calendário para fazer a pré-reserva.</p>
                        )}
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className={globalStyle.page}>
            <Header />
            <SocialCover />

            <main className={`${globalStyle.main} ${ui.page}`}>
                <PageHeader
                    backHref="/espacos-sociais"
                    backLabel="Espaços sociais"
                    kicker={groupName || "Espaço social"}
                    title={place?.name ?? "Espaço social"}
                    lead={place ? <>Diária de <strong className={ui.mono}>{formatBRL(place.price)}</strong>. Escolha uma data disponível no calendário para fazer a pré-reserva.</> : undefined}
                />

                {banner && <Media src={banner} alt={`Foto de ${place?.name ?? "espaço social"}`} area="social" ratio="short" className={style.placeHero} />}

                {body}
            </main>

            <Footer />
        </div>
    );
}
