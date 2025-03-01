import { Link } from "react-router-dom";
import { useReadyForPractice } from "../stores/app";

interface ToolLinkProps {
  to: string;
  title: string;
  description: string;
  isLastItem?: boolean;
}

const ToolLink = ({
  to,
  title,
  description,
  isLastItem = false,
}: ToolLinkProps) => {
  return (
    <div
      className={`flex flex-col md:flex-row`}
    >
      <div className="md:w-1/3 font-bold mb-2 md:mb-0">
        <Link to={to} className="text-primary hover:underline text-lg">
          {title}
        </Link>
      </div>
      <div className="md:w-2/3">{description}</div>
    </div>
  );
};

const Landing = () => {
  const isReadyForPractice = useReadyForPractice();
  return (
    <div className="max-w-5xl mx-auto">
      {/* Hero Section */}
      <div className="relative overflow-hidden rounded-xl shadow-2xl mb-16">
        {/* Background Image with Overlay */}
        <div
          className="absolute inset-0 bg-cover bg-center z-0"
          style={{
            backgroundImage: "url('/hero.jpg')",
            filter: "brightness(0.4)",
          }}
        ></div>

        {/* Animated Gradient Overlay */}
        <div className="absolute inset-0 bg-gradient-to-r from-primary/30 to-secondary/30 z-10 animate-pulse-slow"></div>

        {/* Content */}
        <div className="relative z-20 py-20 px-8 md:py-28 md:px-16">
          <div className="max-w-3xl mx-auto text-center">
            <div className="mb-6 transform transition-all animate-float">
              <h1 className="text-5xl md:text-6xl font-extrabold mb-4 text-white drop-shadow-lg">
                MultiVox
              </h1>
              <div className="h-1 w-24 bg-primary mx-auto rounded-full"></div>
            </div>

            <p className="text-2xl md:text-3xl mb-10 text-white/90 font-light leading-relaxed drop-shadow-md">
              Practice real conversation with{" "}
              <span className="font-semibold text-primary-content">
                live hints
              </span>{" "}
              and{" "}
              <span className="font-semibold text-secondary-content">
                translation
              </span>
            </p>

            <div className="flex flex-col sm:flex-row justify-center gap-4 md:gap-6">
              <Link
                to={isReadyForPractice ? "/scenarios" : "/config"}
                className={`btn btn-lg shadow-lg hover:shadow-xl transform hover:-translate-y-1 transition-all duration-300 ${
                  isReadyForPractice
                    ? "btn-primary"
                    : "btn-primary opacity-60 cursor-not-allowed"
                }`}
                title={
                  isReadyForPractice
                    ? "Start practicing"
                    : "Configure languages first"
                }
              >
                Start Practicing
                {!isReadyForPractice && (
                  <span className="ml-2 text-xs">(Configure first)</span>
                )}
              </Link>
              <Link
                to="/config"
                className="btn bg-white/10 text-white border-white/20 hover:bg-white/20 btn-lg shadow-lg hover:shadow-xl transform hover:-translate-y-1 transition-all duration-300"
              >
                Configure
              </Link>
            </div>
          </div>
        </div>

        {/* Wave Decoration */}
        <div className="absolute bottom-0 left-0 right-0">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 1440 120"
            className="w-full h-auto"
          >
            <path
              fill="#ffffff"
              fillOpacity="1"
              d="M0,64L80,69.3C160,75,320,85,480,80C640,75,800,53,960,48C1120,43,1280,53,1360,58.7L1440,64L1440,120L1360,120C1280,120,1120,120,960,120C800,120,640,120,480,120C320,120,160,120,80,120L0,120Z"
            ></path>
          </svg>
        </div>
      </div>

      {/* About Section */}
      <div className="mb-12">
        <h2 className="text-3xl font-bold mb-8 text-center">About MultiVox</h2>
        <div className="max-w-3xl mx-auto leading-relaxed">
          <p className="mb-4 text-lg">
            Practicing language on your own is frustrating, especially when
            you're early in the journey. It can be hard to think through good
            responses to situations while you're trying to get a handle on new
            vocabulary at the same time.
          </p>

          <p className="mb-4 text-lg">
            LLMs can be good for practice, but I've personally struggled with
            them in a bilingual context, and it can be frustrating to get
            "stuck" without knowing how to move the conversation forward. Since
            the LLM knows what a good response is anyway, why not have it
            provide some hints along the way? And if we're doing that, we might
            as well provide translations and a dictionary to help you as you go.
          </p>

          <p className="mb-4 text-lg">
            This originally was an attempt to use the Gemini Live API to create
            a more interactive experience. Unfortunately I ran into too many
            rate limits to make that feasible. Instead I wired up the usual API
            with a voice-activity detector to give a similar, but slightly
            crappier, experience.
          </p>

          <p className="mb-4 text-lg">
            I've found it's a fun way to explore conversation paths, practice
            conversation, and discover new vocabulary and terms as I go. I hope
            you like it!
          </p>

          <p className="text-lg">
            I ended up making a few more tools along the way — including a
            <Link to="/flashcards" className="text-primary hover:underline">
              {" "}
              flashcard generator
            </Link>{" "}
            that you may find useful as well.
          </p>
        </div>
      </div>

      {/* Tools Section */}
      <div className="mb-16">
        <div className="max-w-3xl mx-auto border-t border-base-300 pt-8">
          <div className="space-y-6">
            <ToolLink
              to="/scenarios"
              title="Interactive Practice"
              description="Chat with an AI to practice different learning scenarios with real-time hints and translations."
            />
            <ToolLink
              to="/flashcards"
              title="Flashcard Generator"
              description="Convert your vocabulary list or any CSV/SRT file into flashcards (paper or Anki) for review. Generates audio for the Anki packages."
            />

            <ToolLink
              to="/translate"
              title="Translation with Chunking"
              description="A translation tool that provides 'sentence chunking' so you can see how the translation fits together."
            />

            <ToolLink
              to="/vocabulary"
              title="Vocabulary Manager"
              description="Track vocabulary that you've tagged during practice sessions or from the translator for later review."
              isLastItem={true}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export { Landing };
