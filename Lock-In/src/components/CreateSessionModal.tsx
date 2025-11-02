import { useState } from "react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { convexQuery } from "@convex-dev/react-query";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";

interface CreateSessionModalProps {
  userId: Id<"users">;
  onClose: () => void;
  defaultProjectId?: Id<"projects">;
  onSessionCreated?: (sessionId: Id<"lockInSessions">) => void;
}

export function CreateSessionModal({ userId, onClose, defaultProjectId, onSessionCreated }: CreateSessionModalProps) {
  const navigate = useNavigate();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [sessionType, setSessionType] = useState<"coding" | "study" | "general">("coding");
  const [maxParticipants, setMaxParticipants] = useState(6);
  const [aiAgentEnabled, setAiAgentEnabled] = useState(true);
  const [selectedProjectId, setSelectedProjectId] = useState<Id<"projects"> | null>(defaultProjectId || null);
  const [scheduledTime, setScheduledTime] = useState(() => {
    // Default to now
    const now = new Date();
    now.setMinutes(now.getMinutes() + 5); // 5 minutes from now
    return now.toISOString().slice(0, 16); // Format for datetime-local input
  });

  // Fetch user's projects
  const { data: projects } = useSuspenseQuery(
    convexQuery(api.projects.list, {
      userId,
      paginationOpts: { numItems: 100, cursor: null }
    })
  );

  const createSessionMutation = useMutation(api.lockInSessions.create);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const scheduledStartTime = new Date(scheduledTime).getTime();

      const result = await createSessionMutation({
        userId,
        projectId: selectedProjectId || undefined,
        title,
        description,
        scheduledStartTime,
        maxParticipants,
        aiAgentEnabled,
        sessionType,
      });

      // Success! Call callback to open session room
      if (onSessionCreated) {
        onSessionCreated(result.sessionId);
      }
      onClose();
    } catch (error) {
      console.error("Error creating session:", error);
      alert("Failed to create session. Please try again.");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-2xl rounded-lg border border-[#30363d] bg-[#161b22] shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#30363d] px-6 py-4">
          <h2 className="text-xl font-bold text-[#e6edf3]">Create Lock In Session</h2>
          <button
            onClick={onClose}
            className="text-[#8b949e] hover:text-[#e6edf3] transition-colors"
          >
            <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Title */}
          <div>
            <label htmlFor="title" className="block text-sm font-medium text-[#e6edf3] mb-2">
              Session Title
            </label>
            <input
              id="title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Late Night Coding Session"
              required
              className="w-full rounded-md border border-[#30363d] bg-[#0d1117] px-3 py-2 text-[#e6edf3] placeholder-[#6e7681] focus:border-[#58a6ff] focus:outline-none focus:ring-1 focus:ring-[#58a6ff]"
            />
          </div>

          {/* Description */}
          <div>
            <label htmlFor="description" className="block text-sm font-medium text-[#e6edf3] mb-2">
              Description
            </label>
            <textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What are you working on?"
              rows={3}
              required
              className="w-full rounded-md border border-[#30363d] bg-[#0d1117] px-3 py-2 text-[#e6edf3] placeholder-[#6e7681] focus:border-[#58a6ff] focus:outline-none focus:ring-1 focus:ring-[#58a6ff]"
            />
          </div>

          {/* Session Type & Scheduled Time */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="sessionType" className="block text-sm font-medium text-[#e6edf3] mb-2">
                Session Type
              </label>
              <select
                id="sessionType"
                value={sessionType}
                onChange={(e) => setSessionType(e.target.value as "coding" | "study" | "general")}
                className="w-full rounded-md border border-[#30363d] bg-[#0d1117] px-3 py-2 text-[#e6edf3] focus:border-[#58a6ff] focus:outline-none focus:ring-1 focus:ring-[#58a6ff]"
              >
                <option value="coding">Coding</option>
                <option value="study">Study</option>
                <option value="general">General</option>
              </select>
            </div>

            <div>
              <label htmlFor="scheduledTime" className="block text-sm font-medium text-[#e6edf3] mb-2">
                Start Time
              </label>
              <input
                id="scheduledTime"
                type="datetime-local"
                value={scheduledTime}
                onChange={(e) => setScheduledTime(e.target.value)}
                required
                className="w-full rounded-md border border-[#30363d] bg-[#0d1117] px-3 py-2 text-[#e6edf3] focus:border-[#58a6ff] focus:outline-none focus:ring-1 focus:ring-[#58a6ff]"
              />
            </div>
          </div>

          {/* Project & Max Participants */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="project" className="block text-sm font-medium text-[#e6edf3] mb-2">
                Link to Project (Optional)
              </label>
              <select
                id="project"
                value={selectedProjectId || ""}
                onChange={(e) => setSelectedProjectId((e.target.value as Id<"projects">) || null)}
                className="w-full rounded-md border border-[#30363d] bg-[#0d1117] px-3 py-2 text-[#e6edf3] focus:border-[#58a6ff] focus:outline-none focus:ring-1 focus:ring-[#58a6ff]"
              >
                <option value="">None</option>
                {projects.page.map((project) => (
                  <option key={project._id} value={project._id}>
                    {project.title}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="maxParticipants" className="block text-sm font-medium text-[#e6edf3] mb-2">
                Max Participants
              </label>
              <input
                id="maxParticipants"
                type="number"
                min="2"
                max="20"
                value={maxParticipants}
                onChange={(e) => setMaxParticipants(parseInt(e.target.value))}
                required
                className="w-full rounded-md border border-[#30363d] bg-[#0d1117] px-3 py-2 text-[#e6edf3] focus:border-[#58a6ff] focus:outline-none focus:ring-1 focus:ring-[#58a6ff]"
              />
            </div>
          </div>

          {/* AI Agent Toggle */}
          <div className="flex items-center justify-between rounded-md border border-[#30363d] bg-[#0d1117] p-4">
            <div className="flex items-center gap-3">
              <svg
                className="h-5 w-5 text-[#58a6ff]"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
                />
              </svg>
              <div>
                <div className="font-medium text-[#e6edf3]">Enable AI Assistant</div>
                <div className="text-sm text-[#8b949e]">
                  Get coding help when you're stuck
                </div>
              </div>
            </div>
            <label className="relative inline-flex cursor-pointer items-center">
              <input
                type="checkbox"
                checked={aiAgentEnabled}
                onChange={(e) => setAiAgentEnabled(e.target.checked)}
                className="peer sr-only"
              />
              <div className="peer h-6 w-11 rounded-full bg-[#21262d] after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:bg-white after:transition-all after:content-[''] peer-checked:bg-[#238636] peer-checked:after:translate-x-full peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-[#58a6ff]"></div>
            </label>
          </div>

          {/* Submit */}
          <div className="flex items-center justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-[#30363d] px-4 py-2 text-sm font-medium text-[#e6edf3] hover:bg-[#30363d] transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="rounded-md bg-[#238636] px-4 py-2 text-sm font-semibold text-white hover:bg-[#2ea043] transition-colors"
            >
              Create Session
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
