import { Link } from "react-router-dom";
import {
  ChatBubbleLeftRightIcon,
  LanguageIcon,
  BookOpenIcon,
  DocumentDuplicateIcon,
} from "@heroicons/react/24/outline";

const ToolLink = ({
  to,
  icon: Icon,
  name,
  description,
}: {
  to: string;
  icon: React.ComponentType<React.ComponentProps<"svg">>;
  name: string;
  description: string;
}) => (
  <Link
    to={to}
    className="block p-4 hover:bg-base-200 rounded-lg transition-colors"
  >
    <div className="flex items-center gap-3 text-2xl mb-2">
      <Icon className="w-6 h-6" />
      <span>{name}</span>
    </div>
    <p className="text-base-content/70">{description}</p>
  </Link>
);

const Landing = () => {
  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-8">
        <p className="text-base-content/70">
          An integrated suite of language learning tools focused on practical
          conversation skills and vocabulary acquisition. Built with modern AI
          to enhance your learning experience.
        </p>

        <div className="space-y-4">
          <ToolLink
            to="/scenarios"
            icon={ChatBubbleLeftRightIcon}
            name="Interactive Practice"
            description="Engage in dynamic conversations with an AI language partner. Practice real-world scenarios with immediate feedback and contextual assistance."
          />

          <ToolLink
            to="/translate"
            icon={LanguageIcon}
            name="Enhanced Translation"
            description="Advanced translation tool with sentence breakdowns and contextual analysis to help you understand language structure and nuance."
          />

          <ToolLink
            to="/vocabulary"
            icon={BookOpenIcon}
            name="Vocabulary Manager"
            description="Systematic vocabulary tracking and review system. Build your lexicon from practice sessions and translations."
          />

          <ToolLink
            to="/flashcards"
            icon={DocumentDuplicateIcon}
            name="Flashcard Generator"
            description="Convert any text or subtitles into comprehensive study materials with AI-enhanced translations and context examples."
          />
        </div>
      </div>
    </div>
  );
};

export { Landing };
