"use client";

import { useEffect } from "react";

/**
 * Registers the service worker that makes the console installable.
 *
 * Mounted by the farm layout rather than the console root, because this is the
 * surface the app is installed *for*: a grower with the icon on their home
 * screen. Registering it from a staff console would install a worker on a
 * desktop that gains nothing from one.
 *
 * ## Why an effect, and why that is allowed here
 *
 * The rule this codebase keeps is that effects may not set state — they render
 * twice for it. This one sets nothing. It talks to `navigator.serviceWorker`,
 * which is exactly what effects are for: reaching something outside React after
 * the document exists.
 *
 * Deliberately silent on failure. A browser with service workers disabled, a
 * private window, an insecure origin — none of those are anything the person
 * can act on, and the console works perfectly without a worker. The only thing
 * lost is the offline page.
 */
export function ServiceWorker() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    /*
      After load, not during it. Registration competes for the same connection
      as the page's own scripts, and on a village 3G connection winning that
      race matters more than installing a worker half a second sooner.
    */
    const register = () => {
      void navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {
        // Nothing to say and nothing to do — see the note above.
      });
    };

    if (document.readyState === "complete") {
      register();
      return;
    }

    window.addEventListener("load", register);
    return () => window.removeEventListener("load", register);
  }, []);

  return null;
}
