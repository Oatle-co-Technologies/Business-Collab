"use client";
import { useEffect, useState } from "react";
type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };
export function PwaControls() {
 const [install, setInstall] = useState<InstallEvent | null>(null);
 const [offline, setOffline] = useState(false);
 const [standalone, setStandalone] = useState(false);
 const [help, setHelp] = useState(false);
 const [waiting, setWaiting] = useState<ServiceWorker | null>(null);
 const [feedback, setFeedback] = useState("");
 useEffect(() => {
  const displayMode = window.matchMedia("(display-mode: standalone)");
  const display = () => setStandalone(displayMode.matches || !!(navigator as Navigator & { standalone?: boolean }).standalone);
  display(); displayMode.addEventListener("change", display);
  const connection = () => setOffline(!navigator.onLine);
  connection(); window.addEventListener("online", connection); window.addEventListener("offline", connection);
  const offer = (event: Event) => { event.preventDefault(); setInstall(event as InstallEvent); };
  const installed = () => { setInstall(null); setHelp(false); display(); };
  window.addEventListener("beforeinstallprompt", offer); window.addEventListener("appinstalled", installed);
  const blockOfflineSubmit = (event: Event) => {
   if (!navigator.onLine) { event.preventDefault(); event.stopImmediatePropagation(); setFeedback("Not sent: reconnect before saving, messaging, checking in/out or reporting a concern. Your open form has not been submitted."); }
  };
  document.addEventListener("submit", blockOfflineSubmit, true);
  if (process.env.NODE_ENV === "production" && "serviceWorker" in navigator && window.isSecureContext) {
   navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }).then(registration => {
    if (registration.waiting) setWaiting(registration.waiting);
    registration.addEventListener("updatefound", () => {
     const worker = registration.installing;
     worker?.addEventListener("statechange", () => { if (worker.state === "installed" && navigator.serviceWorker.controller) setWaiting(worker); });
    });
   }).catch(() => setFeedback("Offline support could not be prepared. You can continue using the website online."));
  }
  return () => { displayMode.removeEventListener("change", display); window.removeEventListener("online", connection); window.removeEventListener("offline", connection); window.removeEventListener("beforeinstallprompt", offer); window.removeEventListener("appinstalled", installed); document.removeEventListener("submit", blockOfflineSubmit, true); };
 }, []);
 async function requestInstall() {
  if (!install) { setHelp(value => !value); return; }
  try { await install.prompt(); await install.userChoice; setInstall(null); } catch { setHelp(true); }
 }
 function update() {
  if (!waiting) return;
  navigator.serviceWorker.addEventListener("controllerchange", () => window.location.reload(), { once: true });
  waiting.postMessage({ type: "ACTIVATE_UPDATE" });
 }
 return <aside className="mx-auto max-w-5xl px-5 pt-3 text-sm sm:px-8" aria-label="App installation and connection">
  <div className="flex flex-wrap items-center gap-3 print:hidden">{!standalone && <button type="button" onClick={requestInstall}>{install ? "Install app" : "Add to your phone"}</button>}{waiting && <><span>App update available. Save your work first.</span><button type="button" onClick={update}>Update and reload</button></>}</div>
  {help && <div className="panel mt-3 space-y-2"><p>On iPhone or iPad, open this app in Safari, tap Share, then Add to Home Screen. On Android, use your browser’s Install app or Add to Home screen menu.</p><p>Installation requires a supported browser and a secure HTTPS app address. Your phone cannot connect to this computer’s 127.0.0.1 address. Phone testing needs the hosted app URL.</p><p>Installing does not enable identity checks, phone push alerts or an emergency response service.</p></div>}
  {offline && <p role="alert" className="panel mt-3">You’re offline. Check-ins, check-outs, messages and reports cannot be sent. Reconnect before relying on any saved status.</p>}
  {feedback && <p role="status" className="panel mt-3">{feedback}</p>}
 </aside>;
}
