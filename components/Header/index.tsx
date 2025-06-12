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
  const router = useRouter();
  const { name } = data;

  return (
    <>
      <Popover className="block tablet:hidden">
        {({ open }) => (
          <>
            <div className="flex items-center justify-between p-2">
              <h1
                onClick={() => router.push("/")}
                className="font-medium p-2 link"
              >
                {name}.
              </h1>

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
        <h1
          onClick={() => router.push("/")}
          className="font-medium cursor-pointer p-2"
        >
          {name}.
        </h1>
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
