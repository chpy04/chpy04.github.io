import { useRef } from "react";
import Header from "../components/Header";
import Socials from "../components/Socials";
import ProjectCard from "../components/ProjectCard";
import { useIsomorphicLayoutEffect } from "../utils";
import { stagger } from "../animations";
import Head from "next/head";
import Image from "next/image";
import { Timeline } from "../components/Timeline/Timeline";

import data from "../data/portfolio.json";

interface Project {
  id: string;
  imageSrc: string;
  title: string;
  categories: string[];
  fileName: string;
  externalLink?: string;
}

export default function Home() {
  const projectsRef = useRef<HTMLDivElement>(null);
  const aboutRef = useRef<HTMLDivElement>(null);
  const resumeRef = useRef<HTMLDivElement>(null);
  const timelineRef = useRef<HTMLDivElement>(null);
  const textOne = useRef<HTMLHeadingElement>(null);
  const textTwo = useRef<HTMLHeadingElement>(null);
  const textThree = useRef<HTMLHeadingElement>(null);
  const textFour = useRef<HTMLHeadingElement>(null);

  const handleProjectsScroll = () => {
    if (projectsRef.current) {
      window.scrollTo({
        top: projectsRef.current.offsetTop,
        behavior: "smooth",
      });
    }
  };

  const handleAboutScroll = () => {
    if (aboutRef.current) {
      window.scrollTo({
        top: aboutRef.current.offsetTop,
        left: 0,
        behavior: "smooth",
      });
    }
  };

  const handleResumeScroll = () => {
    if (resumeRef.current) {
      window.scrollTo({
        top: resumeRef.current.offsetTop,
        left: 0,
        behavior: "smooth",
      });
    }
  };

  const handleTimelineScroll = () => {
    if (timelineRef.current) {
      window.scrollTo({
        top: timelineRef.current.offsetTop,
        left: 0,
        behavior: "smooth",
      });
    }
  };

  useIsomorphicLayoutEffect(() => {
    if (
      textOne.current &&
      textTwo.current &&
      textThree.current &&
      textFour.current
    ) {
      stagger(
        [textOne.current, textTwo.current, textThree.current, textFour.current],
        { y: 40, x: -10, transform: "scale(0.95) skew(10deg)" },
        { y: 0, x: 0, transform: "scale(1)" }
      );
    }
  }, []);

  return (
    <div className="relative hide-scrollbar">
      <Head>
        <title>{data.name}</title>
        <link rel="icon" href="/favicon.ico" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta
          name="description"
          content="Chris Pyle's Portfolio - Student and Software Developer at Northeastern University"
        />
      </Head>

      <div className="gradient-circle"></div>
      <div className="gradient-circle-middle"></div>

      <div className="container mx-auto mb-10 pt-2 tablet:pt-20">
        <Header
          handleProjectsScroll={handleProjectsScroll}
          handleAboutScroll={handleAboutScroll}
          handleResumeScroll={handleResumeScroll}
          handleTimelineScroll={handleTimelineScroll}
        />
        <div className="mt-2 laptop:mt-20 px-[5%]">
          <div className="mt-2 flex flex-col laptop:flex-row items-start justify-between gap-8">
            <div className="flex-1">
              <div className="mt-2 relative">
                <div className="hidden laptop:block laptop:absolute laptop:right-16 laptop:top-0 laptop:w-[400px]">
                  <div className="relative">
                    <div className="absolute -inset-3 bg-gradient-to-r from-[rgba(248,107,223,0.4)] to-[rgba(107,107,248,0.3)] rounded-lg blur-2xl opacity-20"></div>
                    <Image
                      src="/images/headshot.jpg"
                      alt="Profile Headshot"
                      width={400}
                      height={400}
                      className="rounded-full shadow-lg relative w-full h-auto"
                      priority
                    />
                  </div>
                </div>
                <div className="laptop:w-3/4">
                  <h1
                    ref={textOne}
                    className="text-xs tablet:text-sm laptop:text-sm laptopl:text-base p-1 tablet:p-2 text-bold w-4/5 mob:w-full laptop:w-4/5"
                  >
                    {data.headerTaglineOne}
                  </h1>
                  <h1
                    ref={textTwo}
                    className="text-4xl tablet:text-7xl laptop:text-7xl laptopl:text-9xl p-1 tablet:p-2 text-bold w-full laptop:w-4/5"
                  >
                    {data.headerTaglineTwo}
                  </h1>
                  <h1
                    ref={textThree}
                    className="text-2xl tablet:text-4xl laptop:text-4xl laptopl:text-5xl p-1 tablet:p-2 text-bold w-full laptop:w-4/5"
                  >
                    {data.headerTaglineThree}
                  </h1>
                  <h1
                    ref={textFour}
                    className="text-2xl tablet:text-4xl laptop:text-4xl laptopl:text-5xl p-1 tablet:p-2 text-bold w-full laptop:w-4/5"
                  >
                    {data.headerTaglineFour}
                  </h1>
                </div>
                <Socials className="mt-2 laptop:mt-5" />
              </div>
            </div>
          </div>
        </div>
        <div className="mt-24 px-[5%]" ref={projectsRef}>
          <h1 className="tablet:m-10 text-3xl font-bold mb-6">Projects</h1>
          <div className="mt-5 laptop:mt-10 grid grid-cols-1 tablet:grid-cols-3 gap-6 laptop:gap-8">
            {data.projects.map((project) => (
              <ProjectCard
                key={project.id}
                img={project.imageSrc}
                name={project.title}
                subtitle={project.subtitle}
                categories={project.categories}
                fileName={project.fileName}
                externalLink={project.externalLink}
              />
            ))}
          </div>
        </div>

        <div className="mt-24 p-2 laptop:p-0" ref={aboutRef}>
          <h1 className="tablet:m-10 px-[5%] text-3xl font-bold mb-6">About</h1>
          <p className="tablet:m-10 mt-2 text-lg laptop:text-xl w-full px-[5%]">
            {data.aboutpara}
          </p>
        </div>

        <div
          className="mt-24 p-2 laptop:p-0 hidden tablet:block"
          ref={timelineRef}
        >
          <h1 className="tablet:m-10 text-3xl font-bold mb-6 px-[5%]">
            Timeline
          </h1>
          <Timeline />
        </div>

        <div className="mt-24 p-2 laptop:p-0" ref={resumeRef}>
          <div className="tablet:m-10 flex justify-between items-center mb-6">
            <h1 className="text-3xl font-bold px-[5%]">Resume</h1>
            <a
              href="/Chris-Pyle-CV.pdf"
              download
              className="px-6 py-3 border border-white rounded-lg hover:bg-slate-800 hover:scale-105 transition-all ease-out duration-300 link"
            >
              Download Resume
            </a>
          </div>
          <div className="mt-5 w-full flex flex-col items-center px-[5%]">
            <div className="w-full max-w-4xl relative">
              <div className="absolute -inset-12 bg-gradient-to-r from-[rgba(248,107,223,0.4)] to-[rgba(107,107,248,0.3)] rounded-lg blur-3xl opacity-30"></div>
              <Image
                src="/images/resume.png"
                alt="Resume"
                width={1200}
                height={1600}
                className="relative w-full h-auto shadow-lg rounded-lg"
                priority
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
