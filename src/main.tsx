import { Workflow } from "./pages/Workflows";
import { Observations } from "./pages/Observations";
import { Settings, SyncPage, AIPage } from "./pages/Settings";
import { ImportPage } from "./pages/Import";
const Statistics = React.lazy(() =>
  import("./pages/Statistics").then((m) => ({ default: m.Statistics })),
);
import React from "react";
import ReactDOM from "react-dom/client";
import { HashRouter, Routes, Route, Navigate } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider, useAuth } from "./state/auth";
import { DataProvider } from "./state/data";
import { Login } from "./pages/Login";
import { Dashboard } from "./pages/Dashboard";
import { Layout } from "./components/Layout";
import { Organization, ResourcePage } from "./pages/Resources";
import { Spinner, ErrorBox } from "./components/ui";
import "./styles.css";
import "./mobile.css";
const client = new QueryClient({
  defaultOptions: {
    queries: { refetchOnReconnect: true, retry: 1, gcTime: 10 * 60_000 },
  },
});
function App() {
  const auth = useAuth();
  if (auth.loading) return <Spinner />;
  if (!auth.session) return <Login />;
  if (auth.error)
    return (
      <main className="auth-error">
        <ErrorBox error={auth.error} />
        <button className="button" onClick={auth.reload}>
          Riprova
        </button>
        <button className="button" onClick={auth.logout}>
          Esci
        </button>
      </main>
    );
  if (!auth.workspace)
    return (
      <main className="auth-error">
        <h1>Workspace non disponibile</h1>
        <p>
          Il tuo account non dispone di un workspace attivo. Contatta
          l’amministratore.
        </p>
        <button onClick={auth.reload} className="button">
          Ricarica
        </button>
        <button onClick={auth.logout} className="button">
          Esci
        </button>
      </main>
    );
  return (
    <DataProvider key={auth.session.user.id + auth.workspace}>
      <React.Suspense fallback={<Spinner />}>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<Dashboard />} />
            <Route path="organizzazione" element={<Organization />} />
            <Route path="archivio/:resource" element={<ResourcePage />} />
            <Route
              path="registro"
              element={<ResourcePage resource="lessons" />}
            />
            <Route
              path="compiti"
              element={<ResourcePage resource="assignments" />}
            />
            <Route path="osservazioni" element={<Observations />} />
            <Route
              path="verifiche"
              element={<ResourcePage resource="assessments" />}
            />
            <Route
              path="studenti"
              element={<ResourcePage resource="students" />}
            />
            <Route path="registro/:id" element={<Workflow />} />
            <Route path="compiti/:id" element={<Workflow />} />
            <Route path="verifiche/:id" element={<Workflow />} />
            <Route path="studenti/:id" element={<Statistics student />} />
            <Route path="statistiche" element={<Statistics />} />
            <Route path="impostazioni" element={<Settings />} />
            <Route path="sincronizzazione" element={<SyncPage />} />
            <Route path="importa" element={<ImportPage />} />
            <Route path="ai" element={<AIPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </React.Suspense>
    </DataProvider>
  );
}
ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={client}>
      <AuthProvider>
        <HashRouter>
          <App />
        </HashRouter>
      </AuthProvider>
    </QueryClientProvider>
  </React.StrictMode>,
);
