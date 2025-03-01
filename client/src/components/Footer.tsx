import { Link } from "react-router-dom";
import { APP_NAME, GITHUB_REPO, CONTACT_EMAIL } from "../constants";

const Footer = () => {
  return (
    <footer className="bg-base-200">
      <div className="max-w-7xl mx-auto px-8">
        <div className="flex flex-col md:flex-row justify-between items-center">
          <div className="mb-4 md:mb-0">
            <h3 className="text-sm mb-2">{APP_NAME}</h3>
          </div>

          <div className="flex gap-6">
            <a
              href={GITHUB_REPO}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm hover:underline"
            >
              GitHub
            </a>
            <a
              href={`mailto:${CONTACT_EMAIL}`}
              className="text-sm hover:underline"
            >
              Contact
            </a>
            <Link to="/config" className="text-sm hover:underline">
              Settings
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
};

export { Footer };
