import { useState, useEffect } from "react";
import JobSeekerLanding from "./imports/JobSeekerLanding-1-344";
import LandingPageAnimated from "./components/LandingPageAnimated";
import CapitalWatch from "./pages/CapitalWatch";

export default function App() {
  const [view, setView] = useState<"landing" | "jobs" | "capitalwatch">("landing");

  useEffect(() => {
    // Check if there's a query parameter to show an alternate page
    const params = new URLSearchParams(window.location.search);
    if (params.get("capitalwatch") === "true") {
      setView("capitalwatch");
    } else if (params.get("jobs") === "true") {
      setView("jobs");
    } else {
      setView("landing");
    }
  }, []);

  return (
    <div className="w-full min-h-screen">
      {view === "capitalwatch" ? (
        <CapitalWatch />
      ) : view === "jobs" ? (
        <JobSeekerLanding />
      ) : (
        <LandingPageAnimated />
      )}
    </div>
  );
}
