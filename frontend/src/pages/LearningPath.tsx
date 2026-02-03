
import { useState, useMemo, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { useParams, useNavigate } from "react-router-dom";
import { learningPathApi } from "../services/api";
import { UnitHeader } from "../components/learning-path/UnitHeader";
import { PathHeader } from "../components/learning-path/PathHeader";
import { NodeButton } from "../components/learning-path/NodeButton";
import { ReviewBar } from "../components/learning-path/ReviewBar";
import { getSnakePosition } from "../utils/path-layout";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
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

    const COLUMNS = 4; // Grid columns for snake layout

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
        <div className="min-h-screen bg-background flex flex-col">
            <PathHeader title={pathData.deckId.replace('-', ' ')} deckId={deckId || ''} />

            <div className="flex-1 relative">
                <ScrollArea className="h-full absolute inset-0">
                    <div className="container mx-auto max-w-2xl p-4 space-y-12 pb-32">

                        {/* Header Info */}
                        <div className="text-center space-y-2 py-4">
                            <h1 className="text-2xl font-bold tracking-tight capitalize">
                                {pathData.deckId.replace('-', ' ')} Journey
                            </h1>
                            <p className="text-sm text-muted-foreground">
                                {pathData.stats.totalLevels} Levels • {pathData.stats.totalUnits} Units
                            </p>
                        </div>

                        {/* 🎯 Level Tab Bar - Sticky & Scrollable */}
                        <div className="sticky top-0 z-40 bg-background/95 backdrop-blur-sm border-b -mx-4 px-4">
                            <div className="flex gap-1 overflow-x-auto py-2 scrollbar-hide">
                                {pathData.levels.map((level) => {
                                    const isActive = activeLevelId === level.id ||
                                        (activeLevelId === null && level.order === 0);
                                    return (
                                        <button
                                            key={level.id}
                                            onClick={() => setActiveLevelId(level.id)}
                                            className={`
                                                flex-shrink-0 px-4 py-2 rounded-full text-sm font-bold 
                                                transition-all duration-200 whitespace-nowrap
                                                ${isActive
                                                    ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/25 scale-105'
                                                    : 'bg-muted/50 text-muted-foreground hover:bg-muted hover:scale-102'
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
                                    <div className="text-center py-2">
                                        <h2 className="text-xl font-bold text-primary">{displayedLevel.name}</h2>
                                        {displayedLevel.description && (
                                            <p className="text-sm text-muted-foreground mt-1">{displayedLevel.description}</p>
                                        )}
                                    </div>

                                    {/* Units Loop */}
                                    {displayedLevel.units.map((unit) => {
                                        // Calculate unit locked status based on first node
                                        // Calculate unit locked status based on first node
                                        const firstNodeId = unit.nodes[0]?.id;
                                        const isUnitLocked = !!(firstNodeId && progressData?.nodeProgress[firstNodeId]?.status === 'locked');

                                        // Calculate unit progress
                                        const unitCompletedNodes = unit.nodes.filter(n =>
                                            progressData?.nodeProgress[n.id]?.status === 'completed'
                                        ).length;

                                        return (
                                            <div key={unit.id} className="relative">
                                                <UnitHeader
                                                    unit={unit}
                                                    progress={{
                                                        completedNodes: unitCompletedNodes,
                                                        totalNodes: unit.nodes.length
                                                    }}
                                                    isLocked={isUnitLocked}
                                                />

                                                {/* Snake Grid */}
                                                <div className="grid grid-cols-4 gap-y-8 gap-x-2 py-4 relative min-h-[200px]">
                                                    {unit.nodes.map((node, index) => {
                                                        const pos = getSnakePosition(index, COLUMNS);
                                                        const progress = progressLookup[node.id] || { status: 'locked' as const, stars: 0, crowns: 0 };

                                                        // Calculate grid placement (1-based)
                                                        const colStart = pos.col + 1;

                                                        return (
                                                            <div
                                                                key={node.id}
                                                                className="flex justify-center relative items-center"
                                                                style={{
                                                                    gridColumnStart: colStart,
                                                                    gridRowStart: pos.row + 1,
                                                                }}
                                                            >
                                                                <NodeButton
                                                                    node={node}
                                                                    status={progress.status}
                                                                    stars={progress.stars}
                                                                    crowns={progress.crowns}
                                                                    onClick={() => handleNodeClick(node.id, progress.status)}
                                                                />
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            );
                        })()}
                    </div>
                </ScrollArea>
            </div>

            <ReviewBar
                deckId={deckId}
                dueData={dueData}
                isLoading={isDueLoading}
            />
        </div>
    );
}
