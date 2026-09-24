"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
    faArrowLeft,
    faCircleExclamation,
    faLightbulb,
    faRotateRight,
} from "@fortawesome/free-solid-svg-icons";
import replayStyle from "../../../styles/replay.module.css";
import placesStyle from "../../../styles/places.module.css";
import style from "../../../styles/lighting.module.css";
import ReplaySportSection from "../Replay/ReplaySportSection";
import ReplayNotice from "../Replay/ReplayNotice";
import { Loading } from "../Common/loading";
import DurationStepper, { useDurationChoice } from "./DurationStepper";
import {
    fetchGroupPlaces,
    fetchGroups,
    type LightingAvailability,
    type LightingFailure,
    type LightingGroup,
    type LightingPlace,
} from "../../../services/lighting-api";
import { sportImage } from "../../../utils/replay";
import {
    describeOpening,
    durationOptions,
    expectedLitUntil,
    formatClock,
    formatDuration,
    placeImageUrl,
    windowOccasion,
} from "../../../utils/lighting";

interface LightingPickerProps {
    availability: LightingAvailability;
    serverNow: number;
    pending: boolean;
    /** Faz o POST. Devolve a recusa (para a lista reagir pelo `reason`) ou null. */
    onActivate: (place: LightingPlace, minutes: number) => Promise<LightingFailure | null>;
}

interface Selection {
    group: LightingGroup;
    place: LightingPlace;
}

/**
 * Estado "alguma quadra aberta, sócio sem acionamento": esporte → quadra →
 * quanto tempo. Cada quadra tem o próprio horário, e ele vem na lista: a tela
 * não conclui nada pelo horário geral do clube.
 *
 * Quadra acesa aparece normalmente, com o horário e o botão "Prolongar": é
 * assim que o sócio mantém a luz do jogo que já está rolando, mesmo sem ter
 * sido ele quem acendeu.
 */
export default function LightingPicker({ availability, serverNow, pending, onActivate }: LightingPickerProps) {
    const [groups, setGroups] = useState<LightingGroup[] | null>(null);
    const [groupsError, setGroupsError] = useState<string | null>(null);
    const [openGroup, setOpenGroup] = useState<number | null>(null);
    const [places, setPlaces] = useState<Record<number, LightingPlace[]>>({});
    const [placesError, setPlacesError] = useState<Record<number, string>>({});
    const [selection, setSelection] = useState<Selection | null>(null);

    // A quadra escolhida é sempre a da última leitura da lista, não a da hora do
    // toque: o tempo dela encolhe, ela fecha, outro sócio acende.
    const selectedPlace = selection
        ? places[selection.group.id]?.find((place) => place.id === selection.place.id) ?? selection.place
        : null;

    // Mínimo e passo são do clube; o máximo é o `available_minutes` da quadra.
    const options =
        selectedPlace && selectedPlace.open
            ? durationOptions(availability.min_minutes, availability.step_minutes, selectedPlace.available_minutes)
            : [];
    const [minutes, setMinutes] = useDurationChoice(options);

    const loadGroups = useCallback(async () => {
        setGroupsError(null);
        const result = await fetchGroups();
        if (result.ok) setGroups(result.data);
        else if (result.kind !== "unauthorized") setGroupsError(result.error);
    }, []);

    const loadPlaces = useCallback(async (groupId: number) => {
        const result = await fetchGroupPlaces(groupId);
        if (result.ok) {
            setPlaces((current) => ({ ...current, [groupId]: result.data }));
            setPlacesError((current) => {
                const next = { ...current };
                delete next[groupId];
                return next;
            });
        } else if (result.kind !== "unauthorized") {
            setPlacesError((current) => ({ ...current, [groupId]: result.error }));
        }
    }, []);

    useEffect(() => {
        loadGroups();
    }, [loadGroups]);

    // A cada nova leitura da disponibilidade, a quadra aberta também é relida:
    // outra pessoa pode ter acendido ou prolongado.
    const openGroupRef = useRef(openGroup);
    openGroupRef.current = openGroup;
    useEffect(() => {
        if (openGroupRef.current !== null) loadPlaces(openGroupRef.current);
    }, [availability.now, loadPlaces]);

    const toggleGroup = (groupId: number) => {
        if (openGroup === groupId) {
            setOpenGroup(null);
            return;
        }
        setOpenGroup(groupId);
        loadPlaces(groupId);
    };

    const confirm = async () => {
        if (!selection || !selectedPlace || pending) return;
        const refusal = await onActivate(selectedPlace, minutes);
        if (!refusal) return;

        // A tela reage pelo `reason`; o texto quem mostra é a página (o `error`).
        if (refusal.reason === "window_closed" || refusal.reason === "window_ending") {
            // O horário DESTA quadra mudou: relê para ela aparecer fechada.
            loadPlaces(selection.group.id);
        } else if (refusal.reason === "place_reserved") {
            setSelection(null);
            loadPlaces(selection.group.id);
        } else if (refusal.reason === "place_not_eligible") {
            setSelection(null);
            setOpenGroup(null);
            setPlaces({});
            loadGroups();
        }
    };

    /* ---------------------------------------------------- Passo 3: tempo */

    if (selection && selectedPlace) {
        const { group } = selection;
        const place = selectedPlace;
        const lightUntil = expectedLitUntil(place.lit ? place.lit_until : null, serverNow, minutes);
        const alreadyLonger = place.lit && lightUntil > serverNow + minutes * 60_000;
        const occasion = windowOccasion(place.window);
        return (
            <div className={style.pickerStep}>
                <Steps current={3} />

                <button type="button" className={style.backLink} onClick={() => setSelection(null)} disabled={pending}>
                    <FontAwesomeIcon icon={faArrowLeft} /> Trocar de quadra
                </button>

                <div className={style.durationCard}>
                    <p className={style.durationPlace}>
                        {group.name} · <strong>{place.name}</strong>
                    </p>
                    <p className={style.durationStatus}>
                        {place.lit && place.lit_until ? (
                            <>
                                <FontAwesomeIcon icon={faLightbulb} /> Acesa agora, até {formatClock(place.lit_until)}.
                                Acionar de novo prolonga a luz — conta a partir de agora.
                            </>
                        ) : (
                            <>Apagada agora.</>
                        )}
                        {place.open && place.window && (
                            <>
                                {" "}
                                Esta quadra fica liberada até {place.window.end}
                                {occasion ? <> · {occasion}</> : null}.
                            </>
                        )}
                    </p>

                    {!place.open ? (
                        <p className={style.actionHint}>
                            Esta quadra está fora do horário agora
                            {place.next_window ? <> — {describeOpening(place.next_window, availability.now)}</> : null}.
                        </p>
                    ) : options.length > 0 ? (
                        <>
                            <h2 className={style.actionTitle}>Por quanto tempo?</h2>
                            <DurationStepper options={options} value={minutes} onChange={setMinutes} disabled={pending} />
                            <p className={style.actionHint}>
                                {alreadyLonger ? (
                                    <>
                                        Outro sócio já deixou a luz acesa até <strong>{formatClock(lightUntil)}</strong>;
                                        seu acionamento vai até cerca de{" "}
                                        {formatClock(serverNow + minutes * 60_000)} e a luz não apaga antes disso.
                                    </>
                                ) : (
                                    <>
                                        A luz fica acesa até cerca de <strong>{formatClock(lightUntil)}</strong>.
                                    </>
                                )}
                            </p>

                            <div className={style.notReserved}>
                                <strong>Acender não reserva a quadra.</strong> Ninguém fica com o espaço garantido e
                                ninguém é bloqueado: quem chegar primeiro joga. A luz é só a luz.
                            </div>

                            <button type="button" className={style.primaryButton} onClick={confirm} disabled={pending}>
                                {pending
                                    ? "Enviando…"
                                    : `${place.lit ? "Prolongar" : "Acender"} por ${formatDuration(minutes)}`}
                            </button>
                        </>
                    ) : (
                        <p className={style.actionHint}>
                            O horário desta quadra está terminando, e não dá mais para acender hoje
                            {place.next_window ? <> — {describeOpening(place.next_window, availability.now)}</> : null}.
                        </p>
                    )}
                </div>
            </div>
        );
    }

    /* ------------------------------------------ Passos 1 e 2: esporte e quadra */

    return (
        <div className={style.pickerStep}>
            <Steps current={openGroup === null ? 1 : 2} />

            {groupsError ? (
                <ReplayNotice
                    icon={faCircleExclamation}
                    title="Não conseguimos carregar as quadras"
                    description={groupsError}
                    tone="alert"
                    action={
                        <button type="button" className={replayStyle.replayButton} onClick={loadGroups}>
                            <FontAwesomeIcon icon={faRotateRight} /> Tentar novamente
                        </button>
                    }
                />
            ) : groups === null ? (
                <Loading />
            ) : groups.length === 0 ? (
                <ReplayNotice
                    icon={faLightbulb}
                    title="Nenhuma quadra liberada no momento"
                    description="Nenhuma quadra está liberada para acender a luz pelo app. Se precisar de luz, fale com um funcionário do clube."
                />
            ) : (
                <div className={replayStyle.groupList}>
                    {groups.map((group) => {
                        const groupPlaces = places[group.id];
                        const litCount = groupPlaces?.filter((place) => place.lit).length ?? 0;
                        const closedCount = groupPlaces?.filter((place) => !place.open).length ?? 0;
                        const error = placesError[group.id];

                        return (
                            <ReplaySportSection
                                key={group.id}
                                name={group.name}
                                meta={
                                    (group.places === 1 ? "1 quadra liberada" : `${group.places} quadras liberadas`) +
                                    (litCount > 0 ? ` · ${litCount === 1 ? "1 acesa" : `${litCount} acesas`} agora` : "") +
                                    (closedCount > 0
                                        ? ` · ${closedCount === 1 ? "1 fora do horário" : `${closedCount} fora do horário`}`
                                        : "")
                                }
                                openLabel="Ver quadras"
                                isOpen={openGroup === group.id}
                                onToggle={() => toggleGroup(group.id)}
                                panelId={`luz-grupo-${group.id}`}
                            >
                                {error ? (
                                    <p className={style.inlineError}>
                                        {error}{" "}
                                        <button type="button" className={style.textButton} onClick={() => loadPlaces(group.id)}>
                                            Tentar de novo
                                        </button>
                                    </p>
                                ) : !groupPlaces ? (
                                    <Loading small />
                                ) : groupPlaces.length === 0 ? (
                                    <p className={style.inlineEmpty}>Nenhuma quadra deste esporte está liberada agora.</p>
                                ) : (
                                    <div className={style.placeGrid}>
                                        {groupPlaces.map((place) => (
                                            <PlaceCard
                                                key={place.id}
                                                place={place}
                                                minMinutes={availability.min_minutes}
                                                nowIso={availability.now}
                                                fallbackImage={sportImage(group.name)}
                                                onChoose={() => setSelection({ group, place })}
                                            />
                                        ))}
                                    </div>
                                )}
                            </ReplaySportSection>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

/* -------------------------------------------------------------------------- */

/**
 * Cada quadra com o próprio estado, que vem inteiro da lista:
 *  - `open: false` → desabilitada (não escondida), com "abre às X" da `next_window` dela;
 *  - aberta sem tempo que caiba no mínimo → desabilitada, "horário terminando";
 *  - `lit: true` → "Prolongar", com o `lit_until` — acesa não é indisponível;
 *  - senão → "Acender a luz", com o horário dela ("até 23:00").
 */
function PlaceCard({
    place,
    minMinutes,
    nowIso,
    fallbackImage,
    onChoose,
}: {
    place: LightingPlace;
    minMinutes: number;
    nowIso: string;
    fallbackImage: string | null;
    onChoose: () => void;
}) {
    const image = placeImageUrl(place.image) ?? fallbackImage;
    const litLabel = place.lit && place.lit_until ? `Acesa até ${formatClock(place.lit_until)}` : null;
    const fits = minMinutes > 0 && place.available_minutes >= minMinutes;
    const actionable = place.open && fits;

    let badge: string;
    let action: string;
    if (!place.open) {
        const opening = place.next_window ? describeOpening(place.next_window, nowIso) : null;
        badge = litLabel ?? "Fechada agora";
        action = opening ? opening.charAt(0).toUpperCase() + opening.slice(1) : "Fora do horário";
    } else if (!fits) {
        badge = litLabel ?? "Apagada";
        action = "Horário terminando";
    } else if (litLabel) {
        badge = litLabel;
        action = `Prolongar — ${litLabel.toLowerCase()}`;
    } else {
        badge = place.window ? `Apagada · até ${place.window.end}` : "Apagada";
        action = "Acender a luz";
    }

    return (
        <div className={`${placesStyle.placeCard} ${actionable ? "" : style.placeCardClosed}`}>
            <div className={`${placesStyle.placeCardImageContainer} ${style.placeCardImageShort}`}>
                <div
                    className={`${placesStyle.placeCardImage} ${image ? "" : style.placeImagePlain}`}
                    style={image ? { backgroundImage: `url(${image})` } : undefined}
                    role="img"
                    aria-label={`Imagem de ${place.name}`}
                />
                <span
                    className={`${placesStyle.statusBadge} ${
                        place.lit ? style.badgeLit : actionable ? placesStyle.available : placesStyle.unavailable
                    }`}
                >
                    {badge}
                </span>
            </div>

            <div className={placesStyle.placeCardInfo}>
                <h3 className={placesStyle.placeCardTitle}>{place.name}</h3>
                <button
                    type="button"
                    className={`${placesStyle.placeAction} ${placesStyle.btnReserve} ${style.placeActionButton}`}
                    onClick={onChoose}
                    disabled={!actionable}
                >
                    {action}
                </button>
            </div>
        </div>
    );
}

function Steps({ current }: { current: 1 | 2 | 3 }) {
    const steps = ["Esporte", "Quadra", "Tempo"];
    return (
        <ol className={style.steps} aria-label="Etapas">
            {steps.map((label, index) => {
                const step = index + 1;
                return (
                    <li
                        key={label}
                        className={`${style.step} ${step === current ? style.stepCurrent : ""} ${
                            step < current ? style.stepDone : ""
                        }`}
                        aria-current={step === current ? "step" : undefined}
                    >
                        <span className={style.stepNumber}>{step}</span> {label}
                    </li>
                );
            })}
        </ol>
    );
}
