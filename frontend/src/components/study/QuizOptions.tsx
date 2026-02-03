
import { Button } from "@/components/ui/button";
import { Check, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface QuizOptionsProps {
    isFlipped: boolean;
    onAnswer: (correct: boolean) => void;
    onFlip: () => void;
}

export function QuizOptions({ isFlipped, onAnswer, onFlip }: QuizOptionsProps) {
    if (!isFlipped) {
        return (
            <div className="w-full max-w-md mx-auto grid place-items-center">
                <Button
                    size="lg"
                    className="w-full h-14 text-lg font-bold"
                    onClick={onFlip}
                >
                    Show Answer
                </Button>
            </div>
        );
    }

    return (
        <div className="w-full max-w-md mx-auto grid grid-cols-2 gap-4 animate-in slide-in-from-bottom-4 duration-300">
            <Button
                variant="outline"
                size="lg"
                className="h-16 border-2 border-red-200 hover:bg-red-50 hover:border-red-300 text-red-600 space-x-2"
                onClick={() => onAnswer(false)}
            >
                <X className="size-6" />
                <span className="font-bold">Forgot</span>
            </Button>

            <Button
                size="lg"
                className="h-16 bg-green-500 hover:bg-green-600 text-white space-x-2 shadow-lg shadow-green-500/20"
                onClick={() => onAnswer(true)}
            >
                <Check className="size-6 stroke-[3]" />
                <span className="font-bold">I Knew It</span>
            </Button>
        </div>
    );
}
