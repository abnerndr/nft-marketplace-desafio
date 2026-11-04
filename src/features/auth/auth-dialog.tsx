import { useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { safeRedirect } from "./session";

export function useDesktopAuthLayout(): boolean {
  const [desktop, setDesktop] = useState(() =>
    typeof window !== "undefined" ? window.matchMedia("(min-width: 1024px)").matches : false,
  );
  useEffect(() => {
    const media = window.matchMedia("(min-width: 1024px)");
    const sync = () => setDesktop(media.matches);
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);
  return desktop;
}

type AuthDialogProps = {
  title: string;
  description: string;
  redirect?: string;
  children: ReactNode;
};

/** Dialog de auth no desktop. Só montar quando `useDesktopAuthLayout()` for true. */
export function AuthDesktopDialog({ title, description, redirect, children }: AuthDialogProps) {
  const navigate = useNavigate();

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) {
          void navigate({ to: safeRedirect(redirect) ?? "/" });
        }
      }}
    >
      <DialogContent
        className="max-h-[90vh] w-[min(100%,500px)] overflow-y-auto rounded-none border-b-[10px] border-primary bg-surface-card p-0"
        overlayClassName="bg-transparent"
        showClose
      >
        <DialogTitle className="sr-only">{title}</DialogTitle>
        <DialogDescription className="sr-only">{description}</DialogDescription>
        {children}
      </DialogContent>
    </Dialog>
  );
}
