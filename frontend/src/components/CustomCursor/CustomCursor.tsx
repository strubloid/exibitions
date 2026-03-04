import { useEffect, useRef } from "react";
import gsap from "gsap";
import styles from "./CustomCursor.module.scss";

export default function CustomCursor() {
    const cursorRef = useRef<HTMLDivElement>(null);
    const lastScrollY = useRef(0);
    const visible = useRef(false);

    useEffect(() => {
        const cursor = cursorRef.current;
        if (!cursor) return;

        // quickTo reuses a single tween — vastly cheaper than gsap.to() on each event
        const xTo = gsap.quickTo(cursor, "x", { duration: 0.06, ease: "none" });
        const yTo = gsap.quickTo(cursor, "y", { duration: 0.06, ease: "none" });
        const scaleTo = gsap.quickTo(cursor, "scale", { duration: 0.25, ease: "power2.out" });

        const onMove = (e: MouseEvent) => {
            if (!visible.current) {
                gsap.set(cursor, { opacity: 1 });
                visible.current = true;
            }
            xTo(e.clientX);
            yTo(e.clientY);
        };

        const onLeave = () => {
            gsap.to(cursor, { opacity: 0, duration: 0.3 });
            visible.current = false;
        };

        let scrollTimer: ReturnType<typeof setTimeout>;
        const onScroll = () => {
            const vel = Math.abs(window.scrollY - lastScrollY.current);
            lastScrollY.current = window.scrollY;
            scaleTo(Math.min(1.5, 1 + vel * 0.015));
            clearTimeout(scrollTimer);
            scrollTimer = setTimeout(() => scaleTo(1), 150);
        };

        document.addEventListener("mousemove", onMove);
        document.addEventListener("mouseleave", onLeave);
        window.addEventListener("scroll", onScroll, { passive: true });

        return () => {
            document.removeEventListener("mousemove", onMove);
            document.removeEventListener("mouseleave", onLeave);
            window.removeEventListener("scroll", onScroll);
            clearTimeout(scrollTimer);
        };
    }, []);

    return <div ref={cursorRef} className={styles.cursor} aria-hidden="true" />;
}
