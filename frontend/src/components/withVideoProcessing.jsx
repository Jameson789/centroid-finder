import { useState } from "react";

const withVideoProcessing = (WrappedComponent) => {
  return function WithVideoProcessingComponent(props) {
    const [status, setStatus] = useState("idle");
    const [error, setError] = useState("");
    const [jobId, setJobId] = useState(null);

    const start = async (filename, color, threshold, areas) => {
      setError("");
      setStatus("processing");

      const areasObj = areas ? Object.fromEntries(areas) : null;

      try {

        // only send req body if areas are selected
        const res = areas ? await fetch(
          `http://localhost:3000/process/${filename}?targetColor=${color.slice(1)}&threshold=${threshold}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(areasObj)
          }
        ) : await fetch(
          `http://localhost:3000/process/${filename}?targetColor=${color.slice(1)}&threshold=${threshold}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
          }
        )

        if (!res.ok) {
          const errData = await res.json();
          throw new Error(errData.error || "Failed to start job");
        }

        const { jobId } = await res.json();
        setJobId(jobId);
      } catch (err) {
        setError(err.message);
        setStatus("idle");
      }
    };

    const reset = () => {
      setStatus("idle");
      setError("");
      setJobId(null);
    };

    // ✅ Add this
    const done = () => {
      setStatus("done");
    };

    return (
      <WrappedComponent
        {...props}
        status={status}
        error={error}
        jobId={jobId}
        start={start}
        reset={reset}
        done={done} // <-- pass to wrapped component
      />
    );
  };
};

export default withVideoProcessing;
