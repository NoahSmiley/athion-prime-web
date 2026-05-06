/**
 * Navigation history for the SPA. Mirrors Waverunner's breadcrumb-with-forward-stack
 * model: the current view is always the last entry in `crumbs`; pushing navigates
 * forward (clearing any redo stack), back/forward shuffle between them.
 */
import { useCallback, useState } from "react";
import type { View } from "@/types";

export interface Navigation {
  current: View;
  crumbs: View[]; // includes the current view as the last entry
  forwardStack: View[];
  navigate(view: View): void;
  back(): void;
  forward(): void;
  jumpTo(index: number): void;
  reset(view: View): void;
  canBack: boolean;
  canForward: boolean;
}

const HOME: View = { kind: "home" };

export function useNavigation(initial: View = HOME): Navigation {
  const [crumbs, setCrumbs] = useState<View[]>([initial]);
  const [forwardStack, setForwardStack] = useState<View[]>([]);

  const current = crumbs[crumbs.length - 1];

  const navigate = useCallback((view: View) => {
    setCrumbs((cs) => [...cs, view]);
    setForwardStack([]);
  }, []);

  const back = useCallback(() => {
    setCrumbs((cs) => {
      if (cs.length <= 1) return cs;
      const last = cs[cs.length - 1];
      setForwardStack((fs) => [last, ...fs]);
      return cs.slice(0, -1);
    });
  }, []);

  const forward = useCallback(() => {
    setForwardStack((fs) => {
      if (fs.length === 0) return fs;
      const [next, ...rest] = fs;
      setCrumbs((cs) => [...cs, next]);
      return rest;
    });
  }, []);

  const jumpTo = useCallback((index: number) => {
    setCrumbs((cs) => {
      if (index < 0 || index >= cs.length) return cs;
      const dropped = cs.slice(index + 1);
      if (dropped.length > 0) {
        // Pushing to forward stack in reverse so older items are deeper in the redo chain.
        setForwardStack((fs) => [...dropped.reverse(), ...fs]);
      }
      return cs.slice(0, index + 1);
    });
  }, []);

  const reset = useCallback((view: View) => {
    setCrumbs([view]);
    setForwardStack([]);
  }, []);

  return {
    current,
    crumbs,
    forwardStack,
    navigate,
    back,
    forward,
    jumpTo,
    reset,
    canBack: crumbs.length > 1,
    canForward: forwardStack.length > 0,
  };
}
