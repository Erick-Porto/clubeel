"use client";

import { FormEvent, useMemo, useRef, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faFloppyDisk, faPaperPlane } from "@fortawesome/free-solid-svg-icons";
import style from "../../../styles/social.module.css";
import replayStyle from "../../../styles/replay.module.css";
import QuantityStepper from "./QuantityStepper";
import SocialGuestsEditor, { type GuestDraft } from "./SocialGuestsEditor";
import {
    createSocialBooking,
    updateSocialBooking,
    type SocialBeverage,
    type SocialBooking,
    type SocialBookingRequest,
    type SocialBookingUpdate,
    type SocialFailure,
    type SocialPlace,
} from "../../../services/social-api";
import { estimateTotal, formatBRL, formatDayLong, onlyDigits, refusedGuestIndex } from "../../../utils/social";

interface SocialBookingFormProps {
    place: SocialPlace;
    /** `null` depois de uma recusa de data: o formulário fica, à espera de outra data. */
    date: string | null;
    /** Catálogo ATUAL de bebidas ativas. */
    beverages: SocialBeverage[];
    /**
     * Reserva em edição. Sem ela, o formulário cria uma pré-reserva; com ela,
     * vem preenchido e salva com `PUT social/bookings/{id}` (data e espaço só
     * para leitura — a Lara não os troca).
     */
    editing?: SocialBooking;
    /** Reserva devolvida pela Lara (criada ou recalculada). */
    onSaved: (booking: SocialBooking) => void;
    /** A página decide o que reler e mostra o aviso. */
    onRefusal: (failure: SocialFailure) => void;
    onCancelEdit?: () => void;
}

/**
 * Bebidas mostradas na edição: o catálogo atual, mas as que já estão na
 * reserva aparecem com o preço CONTRATADO (a Lara o mantém) — e continuam na
 * lista mesmo se saíram do catálogo, senão sumiriam ao mandar a lista inteira.
 */
function beveragesForEdit(catalog: SocialBeverage[], booking: SocialBooking): SocialBeverage[] {
    const contracted = new Map(booking.items.map((item) => [item.beverage_id, item]));
    const fromCatalog = catalog.map((beverage) => {
        const item = contracted.get(beverage.id);
        return item ? { ...beverage, price: item.unit_price } : beverage;
    });
    const gone = booking.items
        .filter((item) => !catalog.some((beverage) => beverage.id === item.beverage_id))
        .map((item) => ({ id: item.beverage_id, name: item.name, unit: item.unit, price: item.unit_price }));
    return [...fromCatalog, ...gone];
}

/**
 * Pré-reserva de um espaço numa data — ou a edição dela. Tudo o que o sócio
 * escolhe aqui é um PEDIDO: a Lara confere capacidade, extras, bebidas,
 * limite e convidados, e responde o valor oficial (`total`). O resumo desta
 * tela é só uma estimativa.
 */
export default function SocialBookingForm({
    place,
    date,
    beverages: catalog,
    editing,
    onSaved,
    onRefusal,
    onCancelEdit,
}: SocialBookingFormProps) {
    const [eventType, setEventType] = useState(editing?.event_type ?? "");
    const [expectedGuests, setExpectedGuests] = useState(
        editing?.expected_guests != null ? String(editing.expected_guests) : ""
    );
    const [extraGuests, setExtraGuests] = useState(editing?.extra_guests ?? 0);
    const [notes, setNotes] = useState(editing?.notes ?? "");
    const [quantities, setQuantities] = useState<Record<number, number>>(() =>
        Object.fromEntries((editing?.items ?? []).map((item) => [item.beverage_id, item.quantity]))
    );
    // Na edição, a lista só vai no PUT se o sócio abrir o editor: campo ausente
    // fica como está (e os CPFs salvos voltam mascarados — teriam de ser redigitados).
    const [showGuests, setShowGuests] = useState(false);
    const [guests, setGuests] = useState<GuestDraft[]>(() =>
        (editing?.guests ?? []).map((guest) => ({ name: guest.name, cpf: "", savedCpf: guest.cpf }))
    );
    const [guestErrorIndex, setGuestErrorIndex] = useState<number | null>(null);
    const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
    const [pending, setPending] = useState(false);
    // Trava síncrona: dois toques antes do re-render não viram dois envios.
    const busy = useRef(false);

    const beverages = useMemo(() => (editing ? beveragesForEdit(catalog, editing) : catalog), [catalog, editing]);

    // Na edição, diária e preço do extra são os congelados na reserva.
    const pricing = useMemo(
        () =>
            editing ? { ...place, price: editing.base_price, extra_guest_price: editing.extra_guest_price } : place,
        [place, editing]
    );

    const estimate = useMemo(
        () => estimateTotal(pricing, extraGuests, beverages, quantities),
        [pricing, extraGuests, beverages, quantities]
    );

    // Teto da lista nominal pela fórmula do contrato; a Lara confere de novo.
    const guestLimit = place.max_guests + extraGuests;
    // Lista atual maior que o novo teto: a Lara recusaria (`over_capacity`) se a
    // lista menor não for junto na mesma chamada.
    const listOverLimit = !!editing && !showGuests && editing.guests.length > guestLimit;

    const submit = async (event: FormEvent) => {
        event.preventDefault();
        if (busy.current || !date) return;
        busy.current = true;
        setPending(true);
        setGuestErrorIndex(null);
        setFieldErrors({});

        // Linhas totalmente vazias não vão. `sentIndex` guarda a linha da tela
        // de cada convidado enviado, para o `context.index` da recusa apontar
        // a linha certa.
        const sentIndex: number[] = [];
        const sentGuests = guests.flatMap((guest, index) => {
            if (!guest.name.trim() && !guest.cpf.trim()) return [];
            sentIndex.push(index);
            return [{ name: guest.name.trim(), cpf: onlyDigits(guest.cpf) }];
        });

        const items = beverages
            .filter((beverage) => (quantities[beverage.id] ?? 0) > 0)
            .map((beverage) => ({ beverage_id: beverage.id, quantity: quantities[beverage.id] }));

        try {
            let result;
            if (editing) {
                // Edição: manda todos os campos (vazio = `null`, para limpar) e a
                // lista INTEIRA de bebidas (`[]` tira todas). Convidados só se o
                // editor foi aberto.
                const update: SocialBookingUpdate = {
                    event_type: eventType.trim() || null,
                    expected_guests: expectedGuests.trim() ? Number(expectedGuests) : null,
                    extra_guests: extraGuests,
                    notes: notes.trim() || null,
                    items,
                };
                if (showGuests) update.guests = sentGuests;
                result = await updateSocialBooking(editing.id, update);
            } else {
                const request: SocialBookingRequest = { place_id: place.id, date, extra_guests: extraGuests };
                if (eventType.trim()) request.event_type = eventType.trim();
                if (expectedGuests.trim()) request.expected_guests = Number(expectedGuests);
                if (notes.trim()) request.notes = notes.trim();
                if (items.length > 0) request.items = items;
                if (sentGuests.length > 0) request.guests = sentGuests;
                result = await createSocialBooking(request);
            }

            if (result.ok) {
                onSaved(result.data);
                return;
            }

            const refused = refusedGuestIndex(result);
            if (refused !== null) {
                setShowGuests(true);
                setGuestErrorIndex(sentIndex[refused] ?? null);
            }
            setFieldErrors(result.fieldErrors);
            onRefusal(result);
        } finally {
            busy.current = false;
            setPending(false);
        }
    };

    const fieldError = (key: string) =>
        fieldErrors[key]?.[0] ? <span className={style.fieldError}>{fieldErrors[key][0]}</span> : null;

    const title = editing
        ? "Editar pré-reserva"
        : date
          ? `Pré-reserva para ${formatDayLong(date)}`
          : "Pré-reserva — escolha outra data no calendário";

    return (
        <form className={`${style.panel} ${style.form}`} onSubmit={submit} id="social-booking-form">
            <h2 className={style.panelTitle}>{title}</h2>

            {editing && (
                <>
                    <dl className={style.infoList}>
                        <dt>Espaço</dt>
                        <dd>{editing.place.name}</dd>
                        <dt>Data</dt>
                        <dd style={{ textTransform: "capitalize" }}>{formatDayLong(editing.date)}</dd>
                    </dl>
                    <p className={style.hint}>
                        Data e espaço não mudam na edição. Para outro dia ou espaço, desista desta pré-reserva e faça
                        outra.
                    </p>
                </>
            )}

            <div className={style.fieldGrid}>
                <div className={style.field}>
                    <label htmlFor="social-event-type">Tipo de evento</label>
                    <input
                        id="social-event-type"
                        type="text"
                        placeholder="Ex.: Aniversário, confraternização"
                        value={eventType}
                        onChange={(e) => setEventType(e.target.value)}
                        maxLength={120}
                    />
                    {fieldError("event_type")}
                </div>
                <div className={style.field}>
                    <label htmlFor="social-expected">Número de pessoas</label>
                    <input
                        id="social-expected"
                        type="number"
                        inputMode="numeric"
                        min={1}
                        max={place.capacity > 0 ? place.capacity : undefined}
                        placeholder={place.capacity > 0 ? `Até ${place.capacity}` : ""}
                        value={expectedGuests}
                        onChange={(e) => setExpectedGuests(e.target.value.replace(/\D/g, ""))}
                    />
                    <span className={style.hint}>Total de pessoas, sócios e não sócios.</span>
                    {fieldError("expected_guests")}
                </div>
                <div className={style.fieldFull}>
                    <label htmlFor="social-notes">Observações</label>
                    <textarea
                        id="social-notes"
                        className={style.textarea}
                        placeholder="Ex.: chegada da decoração às 9h"
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        maxLength={1000}
                    />
                    {fieldError("notes")}
                </div>
            </div>

            {place.extra_guests > 0 && (
                <div className={style.subsection}>
                    <div className={style.row}>
                        <div className={style.rowLabel}>
                            <strong>Convidados extras</strong>
                            <small>
                                Além dos {place.max_guests} não sócios incluídos ·{" "}
                                {formatBRL(pricing.extra_guest_price)} cada · até {place.extra_guests}
                            </small>
                        </div>
                        <QuantityStepper
                            label="convidados extras"
                            value={extraGuests}
                            max={place.extra_guests}
                            onChange={setExtraGuests}
                        />
                    </div>
                    {listOverLimit && (
                        <p className={style.observation}>
                            Sua lista tem {editing?.guests.length} convidados e o novo limite é {guestLimit}. Para reduzir
                            os extras,{" "}
                            <button type="button" className={style.linkButton} onClick={() => setShowGuests(true)}>
                                ajuste a lista de convidados
                            </button>{" "}
                            nesta mesma tela.
                        </p>
                    )}
                </div>
            )}

            {beverages.length > 0 && (
                <div className={style.subsection}>
                    <h3 className={style.subsectionTitle}>Bebidas (opcional)</h3>
                    {beverages.map((beverage) => {
                        const quantity = quantities[beverage.id] ?? 0;
                        const contracted = editing?.items.some((item) => item.beverage_id === beverage.id);
                        return (
                            <div key={beverage.id} className={style.row}>
                                <div className={style.rowLabel}>
                                    <strong>{beverage.name}</strong>
                                    <small>
                                        {beverage.unit ? `${beverage.unit} · ` : ""}
                                        {formatBRL(beverage.price)}
                                        {contracted ? " (preço contratado)" : ""}
                                        {quantity > 0 ? ` · subtotal ${formatBRL(quantity * beverage.price)}` : ""}
                                    </small>
                                </div>
                                <QuantityStepper
                                    label={beverage.name}
                                    value={quantity}
                                    onChange={(value) => setQuantities((prev) => ({ ...prev, [beverage.id]: value }))}
                                />
                            </div>
                        );
                    })}
                </div>
            )}

            <div className={style.subsection}>
                <div className={style.row}>
                    <div className={style.rowLabel}>
                        <strong>Lista de convidados não sócios</strong>
                        <small>
                            {editing
                                ? showGuests
                                    ? "A lista abaixo substitui a atual. Por segurança, os CPFs salvos aparecem mascarados: digite de novo o CPF de todos."
                                    : `${editing.guests.length} convidado${editing.guests.length === 1 ? "" : "s"} na lista. Ela não muda se você não abrir aqui.`
                                : "Opcional agora — dá para enviar depois, até a véspera."}
                        </small>
                    </div>
                    {!showGuests && (
                        <button type="button" className={style.secondaryButton} onClick={() => setShowGuests(true)}>
                            {editing ? "Alterar lista também" : "Preencher agora"}
                        </button>
                    )}
                </div>
                {showGuests && (
                    <SocialGuestsEditor
                        guests={guests}
                        onChange={(next) => {
                            setGuests(next);
                            setGuestErrorIndex(null);
                        }}
                        limit={guestLimit}
                        errorIndex={guestErrorIndex}
                        disabled={pending}
                    />
                )}
            </div>

            <div className={style.summary}>
                <div className={style.summaryLine}>
                    <span>Diária</span>
                    <span>{formatBRL(estimate.base)}</span>
                </div>
                {extraGuests > 0 && (
                    <div className={style.summaryLine}>
                        <span>
                            {extraGuests} convidado{extraGuests === 1 ? "" : "s"} extra{extraGuests === 1 ? "" : "s"}
                        </span>
                        <span>{formatBRL(estimate.extras)}</span>
                    </div>
                )}
                {estimate.items > 0 && (
                    <div className={style.summaryLine}>
                        <span>Bebidas</span>
                        <span>{formatBRL(estimate.items)}</span>
                    </div>
                )}
                <div className={style.summaryTotal}>
                    <span>Total estimado</span>
                    <span>{formatBRL(estimate.total)}</span>
                </div>
            </div>

            <p className={style.notice}>
                {editing
                    ? "Estimativa: o valor oficial é o que a reserva mostra depois de salvar. A reserva só é confirmada após análise da secretaria e pagamento."
                    : "A reserva só é confirmada após análise da secretaria e pagamento. O valor final (com eventual desconto) aparece em \"Minhas reservas\" quando a secretaria aprovar."}
            </p>

            <div className={style.headerActions}>
                <button type="submit" className={replayStyle.replayButton} disabled={pending || !date}>
                    <FontAwesomeIcon icon={editing ? faFloppyDisk : faPaperPlane} />{" "}
                    {pending ? (editing ? "Salvando..." : "Enviando...") : editing ? "Salvar alterações" : "Enviar pré-reserva"}
                </button>
                {editing && onCancelEdit && (
                    <button type="button" className={style.secondaryButton} onClick={onCancelEdit} disabled={pending}>
                        Cancelar
                    </button>
                )}
            </div>
        </form>
    );
}
