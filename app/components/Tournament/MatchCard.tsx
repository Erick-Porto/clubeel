"use client";

import type { ReactNode } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCalendarDay, faLocationDot } from "@fortawesome/free-solid-svg-icons";
import style from "../../../styles/tournament.module.css";
import { Pill } from "../UI/ui";
import type { MatchSide, TournamentMatch } from "../../../services/tournament-api";
import { formatMatchTime, formatScore, sideLabel } from "../../../utils/tournament";

interface MatchCardProps {
    match: TournamentMatch;
    /** Times do sócio logado, para destacar no chaveamento. */
    highlight?: Set<number>;
    /** Rótulo acima dos times (ex.: rodada, grupo). */
    label?: ReactNode;
    /** Ações abaixo (ex.: "Lançar", na tela da equipe). */
    footer?: ReactNode;
}

/**
 * Um jogo: os dois lados, sets ganhos, placar por set, data e local. Tudo como
 * a Lara mandou — vencedor é o `winner_team_id`, não um cálculo do placar.
 */
export default function MatchCard({ match, highlight, label, footer }: MatchCardProps) {
    const bye = match.status === "bye";
    const decided = match.status === "finished" || match.status === "walkover";
    const score = formatScore(match);

    const renderSide = (side: MatchSide) => {
        const { text, known } = sideLabel(side);
        const winner = decided && side.team !== null && side.team.id === match.winner_team_id;
        const mine = side.team !== null && highlight?.has(side.team.id);
        const members = side.team?.members.filter(Boolean) ?? [];
        // Nome do time igual aos membros ("Ana / Bruno"): não repete.
        const showMembers = members.length > 0 && members.join(" / ") !== side.team?.name;
        return (
            <div className={`${style.side} ${winner ? style.sideWinner : ""} ${mine ? style.sideMine : ""}`}>
                <span className={`${style.sideName} ${known ? "" : style.sideUnknown}`}>
                    {text}
                    {showMembers && <small>{members.join(", ")}</small>}
                </span>
                {decided && side.sets !== null && <span className={style.sideSets}>{side.sets}</span>}
            </div>
        );
    };

    return (
        <div className={`${style.match} ${bye ? style.matchBye : ""}`}>
            <div className={style.matchHead}>
                {label}
                <span className={style.spacer} />
                {match.status === "pending" ? (
                    <Pill kind="off">{match.status_label || "A jogar"}</Pill>
                ) : match.status === "walkover" ? (
                    <Pill kind="warn">W.O.</Pill>
                ) : bye ? (
                    <Pill kind="off">{match.status_label || "Passou direto"}</Pill>
                ) : (
                    <Pill kind="ok">{match.status_label || "Encerrado"}</Pill>
                )}
            </div>

            {renderSide(match.home)}
            {renderSide(match.away)}

            {score && match.status !== "walkover" && <span className={style.score}>{score}</span>}

            {(match.scheduled_at || match.location) && (
                <div className={style.matchHead}>
                    {match.scheduled_at && (
                        <span>
                            <FontAwesomeIcon icon={faCalendarDay} /> {formatMatchTime(match.scheduled_at)}
                        </span>
                    )}
                    {match.location && (
                        <span>
                            <FontAwesomeIcon icon={faLocationDot} /> {match.location}
                        </span>
                    )}
                </div>
            )}

            {footer && <div className={style.matchFoot}>{footer}</div>}
        </div>
    );
}
