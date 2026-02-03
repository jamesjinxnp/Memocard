
import { Button } from "@/components/ui/button";
import { ChevronLeft, Settings } from "lucide-react";
import { useNavigate } from "react-router-dom";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";

interface PathHeaderProps {
    title: string;
    deckId: string;
}

export function PathHeader({ title }: PathHeaderProps) {
    const navigate = useNavigate();

    return (
        <header className="sticky top-0 z-50 w-full border-b bg-background/80 backdrop-blur-md supports-[backdrop-filter]:bg-background/60">
            <div className="container flex h-14 max-w-screen-2xl items-center justify-between px-4">
                <div className="flex items-center gap-2">
                    <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0"
                        onClick={() => navigate('/dashboard')}
                    >
                        <ChevronLeft className="size-4" />
                        <span className="sr-only">Back</span>
                    </Button>
                    <span className="font-bold hidden sm:inline-block">
                        {title}
                    </span>
                </div>

                <div className="flex flex-1 items-center justify-center sm:hidden">
                    <span className="font-bold text-sm truncate max-w-[150px]">
                        {title}
                    </span>
                </div>

                <div className="flex items-center gap-2">
                    <Dialog>
                        <DialogTrigger asChild>
                            <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0 cursor-pointer"
                            >
                                <Settings className="size-4" />
                                <span className="sr-only">Settings</span>
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-[425px] bg-slate-950 border-slate-800 shadow-2xl text-slate-50">
                            <DialogHeader>
                                <DialogTitle>Settings & Preferences</DialogTitle>
                                <DialogDescription>
                                    Customization options coming soon!
                                </DialogDescription>
                            </DialogHeader>
                            <div className="py-4 text-center text-muted-foreground">
                                🚧 Under Construction
                            </div>
                        </DialogContent>
                    </Dialog>
                </div>
            </div>
        </header>
    );
}
