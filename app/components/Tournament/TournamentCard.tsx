"use client";

import Link from "next/link";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faArrowRight, faCalendarDays, faPenToSquare, faTrophy } from "@fortawesome/free-solid-svg-icons";
import ui from "../../../styles/ui.module.css";
import style from "../../../styles/tournament.module.css";
import { Media, MediaTag, Pill } from "../UI/ui";
import type { Tournament } from "../../../services/tournament-api";
import { formatDayRange, formatInstant, tournamentHref, tournamentStatusLabel } from "../../../utils/tournament";

/** Selo do torneio: inscrições abertas (pela Lara), em andamento ou encerrado. */
export function TournamentStatusPill({ tournament }: { tournament: Tournament }) {
    let pill: React.ReactNode = null;
    if (tournament.registration_open) pill = <Pill kind="ok" icon={faPenToSquare}>Inscrições abertas</Pill>;
    else if (tournament.status === "in_progress") pill = <Pill kind="info">{tournamentStatusLabel(tournament.status)}</Pill>;
    else if (tournament.status === "finished") pill = <Pill kind="off">{tournamentStatusLabel(tournament.status)}</Pill>;
    // O invólucro impede o selo de esticar dentro de cartões em coluna.
    return pill ? <span className={style.pillSlot}>{pill}</span> : null;
}

/** Cartão do torneio na lista e na home: imagem, nome, modalidade, datas e selo. */
export default function TournamentCard({ tournament }: { tournament: Tournament }) {
    return (
        <Link href={tournamentHref(tournament.title, tournament.id)} className={ui.card}>
            <Media src={tournament.image_url} alt={`Imagem de ${tournament.title}`} area="torneios" icon={faTrophy}>
                {tournament.place_group && <MediaTag>{tournament.place_group.name}</MediaTag>}
            </Media>
            <div className={ui.cardBody}>
                <TournamentStatusPill tournament={tournament} />
                <h3 className={ui.cardTitle}>{tournament.title}</h3>
                <div className={style.cardMeta}>
                    {tournament.starts_on && (
                        <span>
                            <FontAwesomeIcon icon={faCalendarDays} />
                            <span className={style.mono}>{formatDayRange(tournament.starts_on, tournament.ends_on)}</span>
                        </span>
                    )}
                    {tournament.registration_open && tournament.registration_ends_at && (
                        <span>
                            <FontAwesomeIcon icon={faPenToSquare} />
                            Inscrições até <span className={style.mono}>{formatInstant(tournament.registration_ends_at)}</span>
                        </span>
                    )}
                </div>
            </div>
            <div className={ui.cardFoot}>
                <span className={style.cardAction}>
                    {tournament.registration_open ? "Ver categorias e inscrever-se" : "Ver torneio"}
                </span>
                <span className={ui.spacer} />
                <FontAwesomeIcon icon={faArrowRight} className={ui.muted} />
            </div>
        </Link>
    );
}
