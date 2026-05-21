import { useEffect, useState } from "react";
import JobSeekerLanding from "./imports/JobSeekerLanding-1-344";

const DESIGN_WIDTH = 1461;

export default function App() {
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const update = () => {
      const ratio = window.innerWidth / DESIGN_WIDTH;
      setScale(Math.min(1, ratio));
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  return (
    <div style={{ overflow: "hidden", width: "100%", minHeight: "100vh" }}>
      <div
        style={{
          transform: `scale(${scale})`,
          transformOrigin: "top left",
          width: `${DESIGN_WIDTH}px`,
          minHeight: "100vh",
        }}
      >
        <JobSeekerLanding />
      </div>
    </div>
  );
}
