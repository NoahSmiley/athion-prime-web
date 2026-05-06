import "./App.css";
import { useNavigation } from "@/lib/nav";
import { Sidebar } from "@/components/Sidebar";
import { MainContent } from "@/components/MainContent";
import { BreadcrumbHeader } from "@/components/BreadcrumbHeader";
import type { View } from "@/types";

function App() {
  const nav = useNavigation();

  // Sidebar clicks reset history (it's a top-level destination jump).
  // Other navigations (genre drill-downs, item picks) push onto history.
  const onSidebarChange = (next: View) => nav.reset(next);
  const onContentNavigate = (next: View) => nav.navigate(next);

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background text-foreground">
      <Sidebar view={nav.current} onChange={onSidebarChange} />
      <main className="flex flex-1 flex-col overflow-hidden">
        <BreadcrumbHeader nav={nav} />
        <div className="flex-1 overflow-hidden">
          <MainContent view={nav.current} onNavigate={onContentNavigate} />
        </div>
      </main>
    </div>
  );
}

export default App;
