
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Volume2, RotateCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { speakWord, speakSentence } from "../../services/audio"; // Assuming relative path

interface Vocabulary {
    id: number;
    word: string;
    definition: string;
    example: string | null;
    pronunciation: string | null;
    cefr: string | null;
    partOfSpeech: string | null;
}

interface FlashcardProps {
    vocabulary: Vocabulary;
    isFlipped: boolean;
    onFlip: () => void;
}

export function Flashcard({ vocabulary, isFlipped, onFlip }: FlashcardProps) {
    const [isSpeaking, setIsSpeaking] = useState(false);

    const handleSpeak = async (e: React.MouseEvent) => {
        e.stopPropagation(); // Prevent card flip
        setIsSpeaking(true);
        try {
            await speakWord(vocabulary.word);
        } finally {
            setIsSpeaking(false);
        }
    };

    return (
        <div
            className="w-full max-w-md aspect-[3/4] cursor-pointer group perspective-1000 mx-auto"
            onClick={onFlip}
        >
            <div className={cn(
                "relative w-full h-full transition-all duration-500 [transform-style:preserve-3d]",
                isFlipped ? "[transform:rotateY(180deg)]" : ""
            )}>

                {/* FRONT FACE */}
                <div className="absolute inset-0 w-full h-full bg-card border shadow-xl rounded-xl flex flex-col items-center justify-center p-8 [backface-visibility:hidden] z-20">
                    <div className="text-center space-y-6">
                        <span className="text-sm text-muted-foreground uppercase tracking-widest font-semibold">
                            Word
                        </span>

                        <h2 className="text-4xl sm:text-5xl font-bold text-foreground">
                            {vocabulary.word}
                        </h2>

                        {vocabulary.pronunciation && (
                            <p className="text-xl text-muted-foreground font-mono">
                                /{vocabulary.pronunciation}/
                            </p>
                        )}

                        <Button
                            variant="secondary"
                            size="lg"
                            className={cn(
                                "rounded-full size-16 p-0 transition-opacity",
                                isSpeaking ? "text-primary animate-pulse" : "text-foreground"
                            )}
                            onClick={handleSpeak}
                        >
                            <Volume2 className="size-8" />
                        </Button>
                    </div>

                    <div className="absolute bottom-6 flex gap-2">
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <RotateCw size={12} /> Tap to flip
                        </span>
                    </div>
                </div>

                {/* BACK FACE */}
                <div className="absolute inset-0 w-full h-full bg-primary/5 border border-primary/20 shadow-xl rounded-xl flex flex-col items-center justify-center p-8 [transform:rotateY(180deg)] [backface-visibility:hidden] z-10">
                    <div className="w-full h-full flex flex-col items-center justify-between py-6">
                        {/* Header Tags */}
                        <div className="flex gap-2">
                            {vocabulary.cefr && (
                                <Badge variant="outline" className="text-sm border-primary/50">
                                    {vocabulary.cefr}
                                </Badge>
                            )}
                            {vocabulary.partOfSpeech && (
                                <Badge variant="secondary" className="text-sm italic">
                                    {vocabulary.partOfSpeech}
                                </Badge>
                            )}
                        </div>

                        {/* Definition */}
                        <div className="text-center space-y-4">
                            <h3 className="text-xl font-bold text-foreground/90">
                                {vocabulary.definition}
                            </h3>
                        </div>

                        {/* Example */}
                        {vocabulary.example && (
                            <div className="bg-background/50 p-4 rounded-lg border w-full text-center">
                                <p className="text-muted-foreground italic text-sm">
                                    "{vocabulary.example}"
                                </p>
                            </div>
                        )}

                        <div className="absolute bottom-6 text-xs text-muted-foreground">
                            Detail View
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
