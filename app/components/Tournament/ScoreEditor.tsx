"use client";

import { useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faMinus, faPlus } from "@fortawesome/free-solid-svg-icons";
import style from "../../../styles/tournament.module.css";
import ui from "../../../styles/ui.module.css";
import type { StaffResult, TournamentMatch } from "../../../services/tournament-api";

interface SetDraft {
    home: string;
    away: string;
    tiebreak: boolean;
    homeTb: string;
    awayTb: string;
}

const emptySet = (): SetDraft => ({ home: "", away: "", tiebreak: false, homeTb: "", awayTb: "" });

/** Só dígitos, até 2 (a Lara aceita games de 0 a 99). */
const digits = (value: string) => value.replace(/\D/g, "").slice(0, 2);

interface ScoreEditorProps {
    match: TournamentMatch;
    setsToWin: number;
    pending: boolean;
    onSave: (result: StaffResult) => void;
    onCancel: () => void;
}

/**
 * Editor de placar da equipe: uma linha por set (até 2 × sets_to_win − 1),
 * tie-break opcional (vai dos dois lados) e a opção W.O. Quem confere se o
 * placar fecha (vencedor de cada set, sets_to_win, set depois de decidido) é a
 * Lara; aqui só se exige que cada linha começada esteja completa.
 */
export default function ScoreEditor({ match, setsToWin, pending, onSave, onCancel }: ScoreEditorProps) {
    const maxSets = Math.max(1, 2 * setsToWin - 1);
    const [walkover, setWalkover] = useState(match.status === "walkover");
    const [woWinner, setWoWinner] = useState<number | null>(match.status === "walkover" ? match.winner_team_id : null);
    const [sets, setSets] = useState<SetDraft[]>(() =>
        match.status === "finished" && match.sets.length > 0
            ? match.sets.map((set) => ({
                  home: String(set.home_games),
                  away: String(set.away_games),
                  tiebreak: set.home_tiebreak !== null && set.away_tiebreak !== null,
                  homeTb: set.home_tiebreak !== null ? String(set.home_tiebreak) : "",
                  awayTb: set.away_tiebreak !== null ? String(set.away_tiebreak) : "",
              }))
            : Array.from({ length: Math.min(setsToWin, maxSets) }, emptySet)
    );
    const [formError, setFormError] = useState<string | null>(null);

    const home = match.home.team;
    const away = match.away.team;

    const update = (index: number, patch: Partial<SetDraft>) =>
        setSets((current) => current.map((set, i) => (i === index ? { ...set, ...patch } : set)));

    const submit = () => {
        setFormError(null);
        if (walkover) {
            if (!woWinner) {
                setFormError("Escolha quem venceu por W.O.");
                return;
            }
            onSave({ walkover_winner_team_id: woWinner });
            return;
        }

        // Linha totalmente vazia fica de fora (ex.: o 3º set que não houve).
        const filled = sets.filter((set) => set.home !== "" || set.away !== "");
        if (filled.length === 0) {
            setFormError("Preencha os games de pelo menos um set.");
            return;
        }
        if (filled.some((set) => set.home === "" || set.away === "")) {
            setFormError("Preencha os games dos dois lados em cada set.");
            return;
        }
        if (filled.some((set) => set.tiebreak && (set.homeTb === "" || set.awayTb === ""))) {
            setFormError("Preencha o tie-break dos dois lados, ou desmarque o tie-break.");
            return;
        }

        onSave({
            sets: filled.map((set) => ({
                home_games: Number(set.home),
                away_games: Number(set.away),
                ...(set.tiebreak ? { home_tiebreak: Number(set.homeTb), away_tiebreak: Number(set.awayTb) } : {}),
            })),
        });
    };

    return (
        <div className={style.scoreEditor}>
            <label className={style.toggle}>
                <input type="checkbox" checked={walkover} onChange={(event) => setWalkover(event.target.checked)} />
                Foi W.O. (um lado não jogou)
            </label>

            {walkover ? (
                <div className={style.woChoice} role="radiogroup" aria-label="Vencedor por W.O.">
                    {[home, away].map(
                        (team) =>
                            team && (
                                <label key={team.id} className={style.woOption}>
                                    <input
                                        type="radio"
                                        name={`wo-${match.id}`}
                                        checked={woWinner === team.id}
                                        onChange={() => setWoWinner(team.id)}
                                    />
                                    Venceu: {team.name}
                                </label>
                            )
                    )}
                </div>
            ) : (
                <>
                    <div className={style.scoreTeams} aria-hidden="true">
                        <span />
                        <span>{home?.name}</span>
                        <span />
                        <span>{away?.name}</span>
                    </div>
                    {sets.map((set, index) => (
                        <div key={index} className={style.matchStack}>
                            <div className={style.setRow}>
                                <span>{index + 1}º set</span>
                                <input
                                    type="text"
                                    inputMode="numeric"
                                    aria-label={`Games de ${home?.name ?? "mandante"} no ${index + 1}º set`}
                                    value={set.home}
                                    onChange={(event) => update(index, { home: digits(event.target.value) })}
                                />
                                <span>×</span>
                                <input
                                    type="text"
                                    inputMode="numeric"
                                    aria-label={`Games de ${away?.name ?? "visitante"} no ${index + 1}º set`}
                                    value={set.away}
                                    onChange={(event) => update(index, { away: digits(event.target.value) })}
                                />
                            </div>
                            {set.tiebreak ? (
                                <div className={`${style.setRow} ${style.tiebreakRow}`}>
                                    <span>Tie-break</span>
                                    <input
                                        type="text"
                                        inputMode="numeric"
                                        aria-label={`Tie-break de ${home?.name ?? "mandante"} no ${index + 1}º set`}
                                        value={set.homeTb}
                                        onChange={(event) => update(index, { homeTb: digits(event.target.value) })}
                                    />
                                    <span>×</span>
                                    <input
                                        type="text"
                                        inputMode="numeric"
                                        aria-label={`Tie-break de ${away?.name ?? "visitante"} no ${index + 1}º set`}
                                        value={set.awayTb}
                                        onChange={(event) => update(index, { awayTb: digits(event.target.value) })}
                                    />
                                </div>
                            ) : null}
                            <button
                                type="button"
                                className={ui.linkButton}
                                onClick={() => update(index, { tiebreak: !set.tiebreak, homeTb: "", awayTb: "" })}
                            >
                                {set.tiebreak ? "Tirar tie-break" : "Teve tie-break"}
                            </button>
                        </div>
                    ))}
                    <div className={style.row}>
                        {sets.length < maxSets && (
                            <button
                                type="button"
                                className={`${ui.btn} ${ui.btnSm} ${ui.btnSecondary}`}
                                onClick={() => setSets((current) => [...current, emptySet()])}
                            >
                                <FontAwesomeIcon icon={faPlus} /> Set
                            </button>
                        )}
                        {sets.length > 1 && (
                            <button
                                type="button"
                                className={`${ui.btn} ${ui.btnSm} ${ui.btnSecondary}`}
                                onClick={() => setSets((current) => current.slice(0, -1))}
                            >
                                <FontAwesomeIcon icon={faMinus} /> Set
                            </button>
                        )}
                    </div>
                </>
            )}

            {formError && (
                <p className={style.deadline} role="alert">
                    {formError}
                </p>
            )}

            <div className={style.row}>
                <button type="button" className={`${ui.btn} ${ui.btnPrimary}`} onClick={submit} disabled={pending}>
                    {pending ? "Salvando..." : "Salvar resultado"}
                </button>
                <button type="button" className={`${ui.btn} ${ui.btnSecondary}`} onClick={onCancel} disabled={pending}>
                    Cancelar
                </button>
            </div>
        </div>
    );
}
