import { useCallback, useState } from "react";
import "./App.css";
import { Sidebar } from "@/components/Sidebar";
import { MainContent } from "@/components/MainContent";
import type { View } from "@/types";
import type { BaseItemDto } from "@/lib/jellyfin/types";

function App() {
  const [view, setView] = useState<View>({ kind: "home" });

  const handleSelectItem = useCallback((item: BaseItemDto) => {
    setView({ kind: "item", item });
  }, []);

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background text-foreground">
      <Sidebar activeKind={view.kind} onChange={setView} />
      <main className="flex flex-1 flex-col overflow-hidden">
        <MainContent view={view} onSelectItem={handleSelectItem} onBack={() => setView({ kind: "home" })} />
      </main>
    </div>
  );
}

export default App;
