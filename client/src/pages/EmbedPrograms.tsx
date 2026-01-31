import { I18nProvider } from "@/lib/i18n";
import { ProgramFinder } from "@/components/landing/ProgramFinder";
import { useEffect } from "react";

export default function EmbedPrograms() {
  useEffect(() => {
    document.body.style.background = "transparent";
  }, []);

  return (
    <I18nProvider>
      <div className="p-4 bg-background min-h-screen">
        <ProgramFinder />
      </div>
    </I18nProvider>
  );
}
