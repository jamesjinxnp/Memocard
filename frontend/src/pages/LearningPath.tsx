
import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useParams, useNavigate } from "react-router-dom";
import { learningPathApi } from "../services/api";
import { UnitHeader } from "../components/learning-path/UnitHeader";
import { PathHeader } from "../components/learning-path/PathHeader";
import { NodeButton } from "../components/learning-path/NodeButton";
import { ReviewBar } from "../components/learning-path/ReviewBar";
import { getDuolingoPosition, getPathHeight, getSmoothPath } from "../utils/path-layout";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertCircle } from "lucide-react";


// Define types locally for now (mirroring backend response)
interface Node {
    id: number;
    type: 'lesson' | 'practice' | 'boss' | 'checkpoint';
    order: number;
    vocabCount: number;
}

interface Unit {
    id: number;
    name: string;
    description: string | null;
    order: number;
    icon: string | null;
    color: string | null;
    nodes: Node[];
}

interface Level {
    id: number;
    name: string;
    description: string | null;
    order: number;
    theme: string | null;
    requiredCrowns: number;
    units: Unit[];
}

interface PathResponse {
    deckId: string;
    levels: Level[];
    stats: {
        totalLevels: number;
        totalUnits: number;
        totalNodes: number;
        totalVocab: number;
    };
}

interface ProgressResponse {
    completedNodes: number;
    totalStars: number;
    totalCrowns: number;
    nodeProgress: {
        [nodeId: string]: {
            status: 'locked' | 'available' | 'completed';
            stars: number;
            crowns: number;
        };
    };
}

export default function LearningPath() {
    // deckId should come from params or prop. Let's assume URL param.
    // If used as a component inside Dashboard, it might be a prop.
    // But task implies "Page", so URL param.
    const { deckId } = useParams<{ deckId: string }>();
    const navigate = useNavigate();

    // 🎯 Level Tab State (MUST be at top - Rules of Hooks)
    const [activeLevelId, setActiveLevelId] = useState<number | null>(null);

    // 1. Fetch Path Structure
    const {
        data: pathData,
        isLoading: isPathLoading,
        error: pathError
    } = useQuery({
        queryKey: ['learning-path', deckId],
        queryFn: () => learningPathApi.getPath(deckId!).then(res => res.data as PathResponse),
        enabled: !!deckId,
    });

    // 2. Fetch User Progress
    const {
        data: progressData,
        isLoading: isProgressLoading
    } = useQuery({
        queryKey: ['learning-path-progress', deckId],
        queryFn: () => learningPathApi.getProgress(deckId!).then(res => res.data as ProgressResponse),
        enabled: !!deckId,
    });

    // 3. Fetch Due Cards (for Review Bar)
    const {
        data: dueData,
        isLoading: isDueLoading
    } = useQuery({
        queryKey: ['learning-path-due', deckId],
        queryFn: () => learningPathApi.getDueCards(deckId!).then(res => res.data),
        enabled: !!deckId,
    });

    const isLoading = isPathLoading || isProgressLoading;

    // ⚡ Performance: Stable callback reference for node clicks
    // MUST be declared before any conditional returns (Rules of Hooks)
    const handleNodeClick = useCallback((nodeId: number, status: string) => {
        if (status !== 'locked') {
            navigate(`/study/node/${nodeId}`);
        }
    }, [navigate]);

    // ⚡ Performance: Memoize progress lookup
    // MUST be declared before any conditional returns (Rules of Hooks)
    const progressLookup = useMemo(() => {
        return progressData?.nodeProgress || {};
    }, [progressData?.nodeProgress]);

    // Sticky UnitHeader: track which unit is in view
    const unitRefs = useRef<HTMLDivElement[]>([]);
    const [activeUnitIndex, setActiveUnitIndex] = useState(0);

    // IntersectionObserver to track which unit is visible
    useEffect(() => {
        const observer = new IntersectionObserver(
            (entries) => {
                for (const entry of entries) {
                    if (entry.isIntersecting) {
                        const idx = Number((entry.target as HTMLElement).dataset.unitIndex);
                        if (!isNaN(idx)) setActiveUnitIndex(idx);
                    }
                }
            },
            { threshold: 0.15, rootMargin: '-120px 0px 0px 0px' }
        );

        const currentRefs = unitRefs.current;
        currentRefs.forEach(el => { if (el) observer.observe(el); });

        return () => {
            currentRefs.forEach(el => { if (el) observer.unobserve(el); });
        };
    }, [pathData, activeLevelId]);

    // === Conditional Returns (AFTER all hooks) ===
    if (!deckId) return <div>Invalid Deck ID</div>;

    if (isLoading) {
        return (
            <div className="container mx-auto max-w-2xl p-4 space-y-8">
                {/* Skeleton Loading */}
                {[1, 2].map(i => (
                    <div key={i} className="space-y-4">
                        <Skeleton className="h-24 w-full rounded-xl" />
                        <div className="grid grid-cols-4 gap-4 justify-items-center">
                            {[1, 2, 3, 4, 5, 6].map(j => (
                                <Skeleton key={j} className="size-16 rounded-full" />
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        );
    }

    if (pathError) {
        return (
            <div className="container mx-auto max-w-md p-8 text-center text-red-500 border border-red-200 rounded-lg bg-red-50">
                <AlertCircle className="mx-auto size-12 mb-4" />
                <h2 className="text-xl font-bold">Failed to load learning path</h2>
                <p>Please try again later.</p>
            </div>
        );
    }

    if (!pathData) return null;

    // === Final Render ===
    return (
        <div className="min-h-screen bg-deep flex flex-col relative">
            {/* Ambient Background Orbs — own overflow-hidden wrapper */}
            <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
                <div className="ambient-orb ambient-orb-primary w-[600px] h-[600px] -top-60 -right-60 absolute" />
                <div className="ambient-orb ambient-orb-teal w-[500px] h-[500px] top-1/3 -left-60 absolute" />
                <div className="ambient-orb ambient-orb-secondary w-[400px] h-[400px] -bottom-40 -right-40 absolute" />
            </div>

            <PathHeader title={pathData.deckId.replace('-', ' ')} deckId={deckId || ''} />

            <div className="flex-1 relative z-10">
                <div className="container mx-auto max-w-2xl p-4 space-y-12 pb-32">

                    {/* Deck Title */}
                    <div className="text-center space-y-3 py-8">
                        <h1 className="text-4xl font-bold font-display tracking-tight capitalize text-gradient">
                            {pathData.deckId.replace('-', ' ')}
                        </h1>
                        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[var(--color-bg-surface)] border border-[var(--color-border-default)] text-sm text-[var(--color-text-secondary)]">
                            <span className="text-primary font-bold">{pathData.stats.totalVocab}</span>
                            <span>vocabulary words</span>
                        </div>
                    </div>

                    {/* Level Tab Bar */}
                    <div className="-mx-4 px-4 py-2">
                        <div className="flex gap-2 overflow-x-auto scrollbar-hide">
                            {pathData.levels.map((level) => {
                                const isActive = activeLevelId === level.id ||
                                    (activeLevelId === null && level.order === 0);
                                return (
                                    <button
                                        key={level.id}
                                        onClick={() => setActiveLevelId(level.id)}
                                        className={`
                                                flex-shrink-0 px-5 py-2.5 rounded-full text-sm font-bold font-display
                                                transition-all duration-300 whitespace-nowrap
                                                ${isActive
                                                ? 'gradient-primary text-white shadow-lg shadow-primary/30 scale-105'
                                                : 'bg-[var(--color-bg-elevated)]/60 text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-elevated)] hover:text-[var(--color-text-primary)] hover:scale-102'
                                            }
                                            `}
                                    >
                                        {level.name}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* 🎯 Render ONLY Active Level */}
                    {(() => {
                        const displayedLevel = pathData.levels.find(l =>
                            activeLevelId === null ? l.order === 0 : l.id === activeLevelId
                        );
                        if (!displayedLevel) return null;

                        return (
                            <div key={displayedLevel.id} className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-300">
                                {/* Level Title */}
                                <div className="text-center py-4">
                                    <h2 className="text-xl font-bold font-display text-gradient">{displayedLevel.name}</h2>
                                    {displayedLevel.description && (
                                        <p className="text-sm text-[var(--color-text-muted)] mt-1">{displayedLevel.description}</p>
                                    )}
                                </div>

                                {/* Sticky Floating Unit Header */}
                                {(() => {
                                    const unit = displayedLevel.units[activeUnitIndex];
                                    if (!unit) return null;
                                    const firstNodeId = unit.nodes[0]?.id;
                                    const isUnitLocked = !!(firstNodeId && progressData?.nodeProgress[firstNodeId]?.status === 'locked');
                                    const unitCompletedNodes = unit.nodes.filter(n =>
                                        progressData?.nodeProgress[n.id]?.status === 'completed'
                                    ).length;
                                    return (
                                        <div className="sticky top-[56px] z-30">
                                            <UnitHeader
                                                unit={unit}
                                                progress={{
                                                    completedNodes: unitCompletedNodes,
                                                    totalNodes: unit.nodes.length
                                                }}
                                                isLocked={isUnitLocked}
                                            />
                                        </div>
                                    );
                                })()}

                                {/* Continuous S-Curve Path — all units on one flowing curve */}
                                {(() => {
                                    // Flatten all nodes across units with global index
                                    const allNodes: Array<{
                                        node: typeof displayedLevel.units[0]['nodes'][0];
                                        unitIndex: number;
                                        globalIndex: number;
                                    }> = [];
                                    let globalIdx = 0;
                                    displayedLevel.units.forEach((unit, unitIndex) => {
                                        unit.nodes.forEach((node) => {
                                            allNodes.push({ node, unitIndex, globalIndex: globalIdx++ });
                                        });
                                    });

                                    const totalNodes = allNodes.length;
                                    const containerHeight = getPathHeight(totalNodes);
                                    const allPositions = allNodes.map(n =>
                                        getDuolingoPosition(n.globalIndex, totalNodes)
                                    );

                                    return (
                                        <div
                                            className="relative w-full"
                                            style={{ height: `${containerHeight}px` }}
                                        >
                                            {/* Single SVG S-Curve through ALL nodes */}
                                            <svg
                                                className="absolute inset-0 w-full h-full pointer-events-none"
                                                viewBox={`0 0 100 ${containerHeight}`}
                                                preserveAspectRatio="none"
                                            >
                                                {/* Background trail */}
                                                <path
                                                    d={getSmoothPath(allPositions)}
                                                    fill="none"
                                                    stroke="rgba(42, 38, 71, 0.4)"
                                                    strokeWidth="0.6"
                                                    strokeLinecap="round"
                                                />
                                                {/* Progress colored segments */}
                                                {allNodes.slice(0, -1).map((item, index) => {
                                                    const currentProgress = progressLookup[item.node.id] || { status: 'locked' as const, stars: 0, crowns: 0 };
                                                    const nextProgress = progressLookup[allNodes[index + 1]?.node.id] || { status: 'locked' as const, stars: 0, crowns: 0 };

                                                    if (currentProgress.status === 'locked') return null;

                                                    const strokeColor =
                                                        currentProgress.status === 'completed' && nextProgress.status === 'completed'
                                                            ? 'rgba(6, 214, 160, 0.6)'
                                                            : currentProgress.status === 'completed' && nextProgress.status === 'available'
                                                                ? 'rgba(124, 92, 252, 0.6)'
                                                                : 'transparent';

                                                    return (
                                                        <path
                                                            key={`progress-${index}`}
                                                            d={getSmoothPath([allPositions[index], allPositions[index + 1]])}
                                                            fill="none"
                                                            stroke={strokeColor}
                                                            strokeWidth="0.8"
                                                            strokeLinecap="round"
                                                        />
                                                    );
                                                })}
                                            </svg>

                                            {/* Node Buttons + Unit boundary markers */}
                                            {allNodes.map((item, index) => {
                                                const pos = allPositions[index];
                                                const progress = progressLookup[item.node.id] || { status: 'locked' as const, stars: 0, crowns: 0 };

                                                // Is this the first node of a new unit? Insert sentinel for IntersectionObserver
                                                const isUnitStart = index === 0 || item.unitIndex !== allNodes[index - 1].unitIndex;

                                                return (
                                                    <div key={item.node.id}>
                                                        {isUnitStart && (
                                                            <div
                                                                className="absolute w-full"
                                                                data-unit-index={item.unitIndex}
                                                                ref={(el) => {
                                                                    if (el) unitRefs.current[item.unitIndex] = el;
                                                                }}
                                                                style={{ top: `${pos.y}px`, height: '1px' }}
                                                            />
                                                        )}
                                                        <div
                                                            className="absolute flex justify-center"
                                                            style={{
                                                                left: `${pos.x}%`,
                                                                top: `${pos.y}px`,
                                                                transform: 'translateX(-50%)',
                                                            }}
                                                        >
                                                            <NodeButton
                                                                node={item.node}
                                                                unitOrder={item.unitIndex}
                                                                status={progress.status}
                                                                stars={progress.stars}
                                                                crowns={progress.crowns}
                                                                onClick={() => handleNodeClick(item.node.id, progress.status)}
                                                            />
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    );
                                })()}
                            </div>
                        );
                    })()}
                </div>
            </div>

            <ReviewBar
                deckId={deckId}
                dueData={dueData}
                isLoading={isDueLoading}
            />
        </div>
    );
}
