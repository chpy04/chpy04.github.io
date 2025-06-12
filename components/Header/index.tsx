import { Popover } from "@headlessui/react";
import { useRouter } from "next/router";
import Image from "next/image";
import React from "react";
import Button from "../Button";
// Local Data
import data from "../../data/portfolio.json";

interface HeaderProps {
  handleProjectsScroll?: () => void;
  handleAboutScroll?: () => void;
  handleResumeScroll?: () => void;
  handleTimelineScroll?: () => void;
}

const Header: React.FC<HeaderProps> = ({
  handleProjectsScroll,
  handleAboutScroll,
  handleResumeScroll,
  handleTimelineScroll,
}) => {
  const handleHomeClick = () => {
    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  };

  return (
    <>
      <Popover className="block tablet:hidden">
        {({ open }) => (
          <>
            <div className="flex items-center justify-between p-2">
              <div
                onClick={handleHomeClick}
                className="font-medium p-2 link cursor-pointer"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-6 w-6"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
                  />
                </svg>
              </div>

              <div className="flex items-center">
                <Popover.Button>
                  <Image
                    className="h-5"
                    src={`/images/${
                      !open ? "menu-white.svg" : "cancel-white.svg"
                    }`}
                    alt="menu"
                    width={20}
                    height={20}
                  />
                </Popover.Button>
              </div>
            </div>
            <Popover.Panel className="absolute right-0 z-10 w-11/12 p-4 bg-slate-800 shadow-md rounded-md">
              <div className="grid grid-cols-1">
                <Button onClick={handleProjectsScroll}>Projects</Button>
                <Button onClick={handleAboutScroll}>About</Button>
                <Button onClick={handleTimelineScroll}>Timeline</Button>
                <Button onClick={handleResumeScroll}>Resume</Button>
              </div>
            </Popover.Panel>
          </>
        )}
      </Popover>
      <div className="hidden flex-row items-center justify-between fixed dark:text-white top-0 left-0 right-0 p-4 z-50 tablet:flex">
        <div
          onClick={handleHomeClick}
          className="font-medium cursor-pointer p-2"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-6 w-6"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
            />
          </svg>
        </div>
        <div className="flex">
          <Button onClick={handleProjectsScroll}>Projects</Button>
          <Button onClick={handleAboutScroll}>About</Button>
          <Button onClick={handleTimelineScroll}>Timeline</Button>
          <Button onClick={handleResumeScroll} classes="first:ml-1">
            Resume
          </Button>
        </div>
      </div>
    </>
  );
};

export default Header;
