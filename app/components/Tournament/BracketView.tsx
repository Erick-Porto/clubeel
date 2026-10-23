"use client";

import style from "../../../styles/tournament.module.css";
import ui from "../../../styles/ui.module.css";
import { Pill } from "../UI/ui";
import MatchCard from "./MatchCard";
import type { BracketGroup, BracketStage, TournamentMatch } from "../../../services/tournament-api";

/**
 * Chaveamento de uma categoria, como a Lara montou: fase de grupos (tabela +
 * jogos por rodada) e/ou mata-mata (colunas por rodada, ligadas por
 * `next_match_id`, com o 3º lugar abaixo da final). A classificação já vem na
 * ordem certa; nada é recalculado aqui.
 */
export default function BracketView({ stages, highlight }: { stages: BracketStage[]; highlight?: Set<number> }) {
    return (
        <>
            {stages.map((stage, index) =>
                stage.type === "group" ? (
                    <section key={`g-${index}`} className={style.stage} aria-label="Fase de grupos">
                        <h2 className={ui.sectionTitle}>Fase de grupos</h2>
                        <div className={style.groupGrid}>
                            {stage.groups.map((group) => (
                                <GroupCard key={group.id} group={group} highlight={highlight} />
                            ))}
                        </div>
                    </section>
                ) : (
                    <section key={`k-${index}`} className={style.stage} aria-label="Mata-mata">
                        <h2 className={ui.sectionTitle}>{stages.length > 1 ? "Mata-mata" : "Chave"}</h2>
                        <Knockout matches={stage.matches} highlight={highlight} />
                    </section>
                )
            )}
        </>
    );
}

/** Agrupa preservando a ordem de chegada. */
function groupBy<T>(items: T[], key: (item: T) => string): [string, T[]][] {
    const map = new Map<string, T[]>();
    for (const item of items) {
        const k = key(item);
        map.set(k, [...(map.get(k) ?? []), item]);
    }
    return [...map.entries()];
}

function GroupCard({ group, highlight }: { group: BracketGroup; highlight?: Set<number> }) {
    const rounds = groupBy(
        [...group.matches].sort((a, b) => a.round - b.round || a.position - b.position),
        (match) => match.round_label || `${match.round}ª rodada`
    );

    return (
        <div className={ui.panel}>
            <div className={style.rowBetween}>
                <h3 className={ui.cardTitle}>{group.name}</h3>
                {group.closed && <Pill kind="ok">Classificação final</Pill>}
            </div>

            {group.standings.length > 0 && (
                <div className={style.tableWrap}>
                    <table className={style.standings}>
                        <thead>
                            <tr>
                                <th scope="col" title="Posição">#</th>
                                <th scope="col">Time</th>
                                <th scope="col" title="Jogos">J</th>
                                <th scope="col" title="Vitórias">V</th>
                                <th scope="col" title="Sets ganhos e perdidos">Sets</th>
                                <th scope="col" title="Games ganhos e perdidos">Games</th>
                            </tr>
                        </thead>
                        <tbody>
                            {group.standings.map((row) => (
                                <tr
                                    key={`${row.position}-${row.team?.id ?? "x"}`}
                                    className={row.team && highlight?.has(row.team.id) ? style.standingMine : undefined}
                                >
                                    <td>{row.position}º</td>
                                    <td>{row.team?.name ?? "A definir"}</td>
                                    <td>{row.played}</td>
                                    <td>{row.wins}</td>
                                    <td>
                                        {row.sets_won}-{row.sets_lost}
                                    </td>
                                    <td>
                                        {row.games_won}-{row.games_lost}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {rounds.map(([label, matches]) => (
                <div key={label} className={style.matchStack}>
                    <span className={style.roundLabel}>{label}</span>
                    {matches.map((match) => (
                        <MatchCard key={match.id} match={match} highlight={highlight} />
                    ))}
                </div>
            ))}
        </div>
    );
}

/**
 * Ordena as colunas da chave seguindo `next_match_id` da final para trás, para
 * que os dois jogos que alimentam um jogo fiquem lado a lado (e as linhas
 * fechem). Jogo sem ligação conhecida vai para o fim da sua rodada.
 */
function orderColumns(matches: TournamentMatch[]): { round: number; label: string; matches: TournamentMatch[] }[] {
    const main = matches.filter((match) => !match.third_place);
    const rounds = [...new Set(main.map((match) => match.round))].sort((a, b) => a - b);
    if (rounds.length === 0) return [];

    const feeders = new Map<number, TournamentMatch[]>();
    for (const match of main) {
        if (match.next_match_id === null) continue;
        feeders.set(match.next_match_id, [...(feeders.get(match.next_match_id) ?? []), match]);
    }

    const columns = new Map<number, TournamentMatch[]>(rounds.map((round) => [round, []]));
    const seen = new Set<number>();
    const visit = (match: TournamentMatch) => {
        if (seen.has(match.id)) return;
        seen.add(match.id);
        columns.get(match.round)?.push(match);
        (feeders.get(match.id) ?? [])
            .filter((child) => child.round < match.round)
            .sort((a, b) => a.position - b.position)
            .forEach(visit);
    };

    const lastRound = rounds[rounds.length - 1];
    main.filter((match) => match.round === lastRound)
        .sort((a, b) => a.position - b.position)
        .forEach(visit);
    main.filter((match) => !seen.has(match.id))
        .sort((a, b) => a.round - b.round || a.position - b.position)
        .forEach((match) => {
            seen.add(match.id);
            columns.get(match.round)?.push(match);
        });

    return rounds.map((round) => {
        const list = columns.get(round) ?? [];
        return { round, label: list[0]?.round_label ?? "", matches: list };
    });
}

function Knockout({ matches, highlight }: { matches: TournamentMatch[]; highlight?: Set<number> }) {
    const columns = orderColumns(matches);
    const thirdPlace = matches.filter((match) => match.third_place);
    const ids = new Set(matches.map((match) => match.id));
    // Jogos que recebem alguém de uma rodada anterior (linha chegando da esquerda).
    const fed = new Set(
        matches.filter((match) => !match.third_place && match.next_match_id !== null).map((match) => match.next_match_id)
    );

    return (
        <div className={style.knockout}>
            <div className={style.knockoutColumns}>
                {columns.map((column, columnIndex) => {
                    const isLast = columnIndex === columns.length - 1;
                    return (
                        <div key={column.round} className={style.knockoutColumn}>
                            <span className={style.knockoutColumnTitle}>{column.label}</span>
                            <div className={style.knockoutSlots}>
                                {column.matches.map((match, index) => {
                                    const linked = !isLast && match.next_match_id !== null && ids.has(match.next_match_id);
                                    // Par de jogos que vai para o mesmo jogo: o de cima desce, o de baixo sobe.
                                    const sibling = column.matches[index % 2 === 0 ? index + 1 : index - 1];
                                    const paired = linked && sibling?.next_match_id === match.next_match_id;
                                    const className = [
                                        style.slot,
                                        linked ? style.slotLinked : "",
                                        paired ? (index % 2 === 0 ? style.slotTop : style.slotBottom) : "",
                                        columnIndex > 0 && fed.has(match.id) ? style.slotFed : "",
                                    ].join(" ");
                                    return (
                                        <div key={match.id} className={className}>
                                            <MatchCard match={match} highlight={highlight} />
                                        </div>
                                    );
                                })}
                            </div>
                            {isLast && thirdPlace.length > 0 && (
                                <div className={style.thirdPlace}>
                                    {thirdPlace.map((match) => (
                                        <MatchCard
                                            key={match.id}
                                            match={match}
                                            highlight={highlight}
                                            label={<span className={style.roundLabel}>{match.round_label || "Disputa de 3º lugar"}</span>}
                                        />
                                    ))}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
