import { useEffect, useRef } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

gsap.registerPlugin(ScrollTrigger)

export function useGsapAnimation(animationStyle: string) {
  const sectionRef = useRef<HTMLElement>(null)
  const imageRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const numberRef = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    const section = sectionRef.current
    const image = imageRef.current
    const content = contentRef.current
    const number = numberRef.current

    if (!section || !image || !content) return

    const ctx = gsap.context(() => {
      const trigger = {
        trigger: section,
        start: 'top 80%',
        end: 'bottom 20%',
        toggleActions: 'play none none reverse',
      }

      if (animationStyle === 'mask-reveal') {
        // Clip-path reveal from center outward
        gsap.set(image, { clipPath: 'inset(40% 20% 40% 20%)', scale: 1.1 })
        gsap.to(image, {
          clipPath: 'inset(0% 0% 0% 0%)',
          scale: 1,
          duration: 1.4,
          ease: 'power3.out',
          scrollTrigger: trigger,
          force3D: true,
        })
        gsap.from(content, {
          opacity: 0,
          x: 30,
          duration: 1,
          delay: 0.3,
          ease: 'power2.out',
          scrollTrigger: trigger,
          force3D: true,
        })
      } else if (animationStyle === 'parallax') {
        // Parallax: image moves slower than scroll, content faster
        gsap.fromTo(
          image,
          { yPercent: 10 },
          {
            yPercent: -10,
            ease: 'none',
            scrollTrigger: {
              trigger: section,
              start: 'top bottom',
              end: 'bottom top',
              scrub: true,
            },
            force3D: true,
          }
        )
        gsap.from(content, {
          opacity: 0,
          y: 40,
          duration: 1,
          ease: 'power2.out',
          scrollTrigger: trigger,
          force3D: true,
        })
      } else {
        // fade (default)
        gsap.from(image, {
          opacity: 0,
          scale: 1.05,
          duration: 1.2,
          ease: 'power2.out',
          scrollTrigger: trigger,
          force3D: true,
        })
        gsap.from(content, {
          opacity: 0,
          y: 30,
          duration: 1,
          delay: 0.2,
          ease: 'power2.out',
          scrollTrigger: trigger,
          force3D: true,
        })
      }

      if (number) {
        gsap.from(number, {
          opacity: 0,
          duration: 1.5,
          delay: 0.1,
          ease: 'power1.out',
          scrollTrigger: trigger,
        })
      }
    }, section)

    return () => ctx.revert()
  }, [animationStyle])

  return { sectionRef, imageRef, contentRef, numberRef }
}
