import { useState, useEffect } from "react";
import JobSeekerLanding from "./imports/JobSeekerLanding-1-344";
import LandingPageAnimated from "./components/LandingPageAnimated";

export default function App() {
  const [showLanding, setShowLanding] = useState(true);

  useEffect(() => {
    // Check if there's a query parameter to show the jobs page
    const params = new URLSearchParams(window.location.search);
    const showJobs = params.get("jobs");
    
    if (showJobs === "true") {
      setShowLanding(false);
    } else {
      setShowLanding(true);
    }
  }, []);

  return (
    <div className="w-full min-h-screen">
      {showLanding ? <LandingPageAnimated /> : <JobSeekerLanding />}
    </div>
  );
}
