"use client";

import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faChair, faClock, faUsers, faUserPlus, faUserTag } from "@fortawesome/free-solid-svg-icons";
import style from "../../../styles/social.module.css";
import type { SocialPlace } from "../../../services/social-api";
import { describeEventWindow, formatBRL, formatFurnitureCount } from "../../../utils/social";

/**
 * Ficha do espaço (capacidade, convidados incluídos, extras, mesas e cadeiras
 * incluídas, duração do evento, itens e observações) — a mesma na vitrine e
 * na página do espaço. Mostra os números do catálogo como vieram.
 */
export default function SocialPlaceFacts({ place }: { place: SocialPlace }) {
    const eventWindow = describeEventWindow(place);
    return (
        <>
            <ul className={style.facts}>
                {place.capacity > 0 && (
                    <li>
                        <FontAwesomeIcon icon={faUsers} />
                        <span>
                            Até <strong>{place.capacity}</strong> pessoas no total (sócios e não sócios)
                        </span>
                    </li>
                )}
                <li>
                    <FontAwesomeIcon icon={faUserTag} />
                    <span>
                        {place.max_guests > 0 ? (
                            <>
                                <strong>{place.max_guests}</strong> convidados não sócios incluídos
                            </>
                        ) : (
                            "Sem convidados não sócios incluídos"
                        )}
                    </span>
                </li>
                {place.extra_guests > 0 && (
                    <li>
                        <FontAwesomeIcon icon={faUserPlus} />
                        <span>
                            Até <strong>{place.extra_guests}</strong> convidados extras a{" "}
                            {formatBRL(place.extra_guest_price)} cada
                        </span>
                    </li>
                )}
                {(place.base_tables > 0 || place.base_chairs > 0) && (
                    <li>
                        <FontAwesomeIcon icon={faChair} />
                        <span>Inclui {formatFurnitureCount(place.base_tables, place.base_chairs)}</span>
                    </li>
                )}
                {eventWindow && (
                    <li>
                        <FontAwesomeIcon icon={faClock} />
                        <span>{eventWindow}</span>
                    </li>
                )}
            </ul>
            {place.amenities && <p className={style.amenities}>{place.amenities}</p>}
            {place.description && <p className={style.observation}>{place.description}</p>}
        </>
    );
}
