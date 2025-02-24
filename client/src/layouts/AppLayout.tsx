import { useLocation } from "react-router-dom";
import { NavBar } from "./NavBar";

interface AppLayoutProps {
  children: React.ReactNode;
}

const AppLayout = ({ children }: AppLayoutProps) => {
  const location = useLocation();
  const titleMap: Record<string, string> = {
    "/": "Home",
    "/config": "Configuration",
    "/flashcards": "Flashcard Generator",
    "/practice": "Conversation Practice",
    "/scenarios": "Practice Scenarios",
    "/translate": "Translation Tool",
    "/vocabulary": "Vocabulary List",
  };

  let title = titleMap[location.pathname];
  if (!title) {
    const split = location.pathname.split("/")[1];
    title = titleMap[`/${split}`];
  }

  return (
    <div className="min-h-screen">
      <NavBar pageTitle={title} />
      {children}
    </div>
  );
};

export { AppLayout };
