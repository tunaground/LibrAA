import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { AppShell } from "./components/layout/AppShell";
import { initDb } from "./lib/db";

function App() {
  const { t } = useTranslation();
  const [dbReady, setDbReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    initDb()
      .then(() => setDbReady(true))
      .catch((e) => setError(String(e)));
  }, []);

  if (error) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-red-500">{t("error.dbInit")}: {error}</p>
      </div>
    );
  }

  if (!dbReady) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-[var(--color-text-secondary)]">{t("loading")}</p>
      </div>
    );
  }

  return <AppShell />;
}

export default App;
