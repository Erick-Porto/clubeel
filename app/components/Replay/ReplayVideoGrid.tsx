"use client";

import style from "../../../styles/replay.module.css";
import type { ReplayVideo } from "../../../services/replay-api";
import ReplayVideoCard from "./ReplayVideoCard";

interface ReplayVideoGridProps {
    videos: ReplayVideo[];
    showReservationBadge?: boolean;
    showPlaceName?: boolean;
}

export default function ReplayVideoGrid({
    videos,
    showReservationBadge = false,
    showPlaceName = false,
}: ReplayVideoGridProps) {
    return (
        <div className={style.videoGrid}>
            {videos.map((video) => (
                <ReplayVideoCard
                    key={video.uuid}
                    video={video}
                    showReservationBadge={showReservationBadge}
                    showPlaceName={showPlaceName}
                />
            ))}
        </div>
    );
}
