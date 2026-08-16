import { BrowserRouter, HashRouter } from "react-router-dom";
import App from "./App.tsx";
import { UpdateChecker } from "./features/update/UpdateChecker.tsx";
import { OfflineSyncManager } from "./shared/offline/OfflineSyncManager.tsx";
import { ScrollToTop } from "./shared/motion/ScrollRestoration.tsx";
import { isOfflineZipBuild } from "./shared/platform/runtime.ts";
import { ToastContainer } from "./shared/ui/ToastContainer.tsx";

const offlineZip = isOfflineZipBuild();
const routerBasename = offlineZip
  ? undefined
  : import.meta.env.BASE_URL.replace(/\/$/, "") || undefined;

export function AppRouter() {
  if (offlineZip) {
    return (
      <HashRouter basename={routerBasename}>
        <ScrollToTop />
        <App />
        <ToastContainer />
        <OfflineSyncManager />
        <UpdateChecker />
      </HashRouter>
    );
  }
  return (
    <BrowserRouter basename={routerBasename}>
      <ScrollToTop />
      <App />
      <ToastContainer />
      <OfflineSyncManager />
      <UpdateChecker />
    </BrowserRouter>
  );
}
