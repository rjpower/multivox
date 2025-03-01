import { Bars3Icon } from "@heroicons/react/24/outline";
import { Link, useParams } from "react-router-dom";
import { APP_NAME } from "../constants";
import { ThemeController } from "../components/ThemeController";
import { useReadyForPractice } from "../stores/app";

interface NavBarProps {
  pageTitle?: string | ((params: any) => string);
}

export const NavBar = ({ pageTitle }: NavBarProps) => {
  const params = useParams();
  const title = typeof pageTitle === "function" ? pageTitle(params) : pageTitle;
  const isReady = useReadyForPractice();

  return (
    <div className="navbar px-4 bg-base-100 text-base-content shadow-sm relative z-10">
      <div className="navbar-start">
        <div className="breadcrumbs text-sm">
          <ul>
            <li>
              <Link to="/" className="font-semibold">
                <h1 className="font-semibold">{APP_NAME}</h1>
              </Link>
            </li>
            {title && (
              <li>
                <h1 className="font-semibold">{title}</h1>
              </li>
            )}
          </ul>
        </div>
      </div>
      <div className="navbar-end">
        <div className="dropdown">
          <label tabIndex={0} className="btn btn-ghost lg:hidden">
            <Bars3Icon className="h-5 w-5" />
          </label>
          <ul
            tabIndex={0}
            className="menu menu-sm dropdown-content mt-3 z-[1] p-2 shadow rounded-box w-52"
          >
            {isReady && (
              <>
                <li>
                  <Link to="/scenarios">Practice</Link>
                </li>
                <li>
                  <Link to="/flashcards">Flashcards</Link>
                </li>
                <li>
                  <Link to="/vocabulary">Vocabulary</Link>
                </li>
                <li>
                  <Link to="/translate">Translator</Link>
                </li>
              </>
            )}
            <li>
              <Link to="/config">Settings</Link>
            </li>
          </ul>
        </div>
        <div className="hidden lg:flex items-center gap-4">
          {isReady && (
            <>
              <Link to="/scenarios" className="btn btn-ghost btn-sm">
                Practice
              </Link>
              <Link to="/flashcards" className="btn btn-ghost btn-sm">
                Flashcards
              </Link>
              <Link to="/vocabulary" className="btn btn-ghost btn-sm">
                Vocabulary
              </Link>
              <Link to="/translate" className="btn btn-ghost btn-sm">
                Translate
              </Link>
            </>
          )}
          <Link to="/config" className="btn btn-ghost btn-sm">
            Settings
          </Link>
        </div>
        <ThemeController />
      </div>
    </div>
  );
};
