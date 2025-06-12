import gsap, { Power3, gsap as GSAPType } from "gsap";

type GSAPVars = {
  [key: string]: any;
};

export const stagger = (
  target: string | Element | Element[],
  fromVars: GSAPVars,
  toVars: GSAPVars
): gsap.core.Tween => {
  return gsap.fromTo(
    target,
    { opacity: 0, ...fromVars },
    { opacity: 1, ...toVars, stagger: 0.2, ease: Power3.easeOut }
  );
};
