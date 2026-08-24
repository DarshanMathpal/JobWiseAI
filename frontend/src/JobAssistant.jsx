import { useLayoutEffect, useRef, useState } from "react";
import { API_BASE_URL } from "./lib/apiConfig";



function renderInlineMarkdown(text) {
  let value = String(text || "")
    .replace(/\\([*_#`>])/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "__BOLD__$1__/BOLD__")
    .replace(/__BOLD__(.*?)__\/BOLD__/g, "@@BOLD@@$1@@/BOLD@@");

  const chunks = value.split(/(@@BOLD@@|@@\/BOLD@@)/g);
  const output = [];
  let bold = false;
  chunks.forEach((chunk, index) => {
    if (chunk === "@@BOLD@@") {
      bold = true;
      return;
    }
    if (chunk === "@@/BOLD@@") {
      bold = false;
      return;
    }
    output.push(bold ? <strong key={index}>{chunk}</strong> : <span key={index}>{chunk}</span>);
  });
  return output;
}

function cleanAssistantText(content) {
  const raw = String(content || "")
    .replace(/\r/g, "")
    .replace(/\\([*_#`>])/g, "$1")
    .replace(/\s*---+\s*/g, "\n")
    .replace(/(^|\n)\s*#{2,6}\s+/g, "$1### ")
    .replace(/\s+#{2,6}\s+/g, "\n### ")
    .replace(/\s*\*{3,}\s*/g, "\n")
    .replace(/\s+([0-9]+)[.)]\s+/g, "\n$1. ")
    .replace(/\s+\*\s+(?=[A-Za-z])/g, "\n• ")
    .replace(/(^|\n)\s*\*\s*(?=\n|$)/g, "$1")
    .replace(/(^|\n)\s*[•-]\s*(?=[A-Za-z])/g, "$1• ")
    .replace(/(^|\n)\s*\*{2}([^*]{2,120})\*{2}\s*:?[ \t]*/g, "$1## $2\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  const sourceLines = raw.split("\n").map((line) => line.trim()).filter(Boolean);
  const outputLines = [];

  for (let i = 0; i < sourceLines.length; i += 1) {
    const line = sourceLines[i];

    // Gemini sometimes emits a standalone "*" on one line and the actual
    // bullet text on the next line. Join those into one readable bullet.
    if (/^\*+$/.test(line)) {
      const next = sourceLines[i + 1];
      if (next) {
        outputLines.push(`• ${next.replace(/^(?:[•*-]\s*)/, "")}`);
        i += 1;
      }
      continue;
    }

    if (/^#{2,6}\s+/.test(line)) {
      outputLines.push(line.replace(/^#{2,6}\s+/, "## "));
      continue;
    }

    if (/^\*{2}([^*]+)\*{2}:?$/.test(line)) {
      outputLines.push(`## ${line.replace(/^\*{2}|\*{2}:?$/g, "")}`);
      continue;
    }

    outputLines.push(line);
  }

  return outputLines.join("\n").trim();
}

function AssistantAnswer({ content }) {
  const normalized = cleanAssistantText(content);
  const lines = normalized
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const blocks = [];
  let list = [];

  const flushList = () => {
    if (!list.length) return;
    blocks.push(
      <ul className="ai-answer-list" key={`list-${blocks.length}`}>
        {list.map((item, index) => (
          <li key={index}>{renderInlineMarkdown(item)}</li>
        ))}
      </ul>
    );
    list = [];
  };

  lines.forEach((line, index) => {
    if (/^(?:•|-)\s+/.test(line)) {
      list.push(line.replace(/^(?:•|-)\s+/, ""));
      return;
    }

    flushList();

if (/^#{1,6}\s+/.test(line)) {
  blocks.push(
    <h4 className="ai-answer-heading" key={`heading-${index}`}>
      {renderInlineMarkdown(line.replace(/^#{1,6}\s+/, ""))}
    </h4>
  );
  return;
}

    if (/^\*\*([^*]+)\*\*:?$/.test(line)) {
      blocks.push(
        <h4 className="ai-answer-heading" key={`bold-heading-${index}`}>
          {renderInlineMarkdown(line.replace(/^\*\*|\*\*:?$/g, ""))}
        </h4>
      );
      return;
    }

    if (/^\d+[.)]\s+/.test(line)) {
      blocks.push(
        <div className="ai-answer-numbered" key={`number-${index}`}>
          {renderInlineMarkdown(line)}
        </div>
      );
      return;
    }

    blocks.push(<p key={`paragraph-${index}`}>{renderInlineMarkdown(line)}</p>);
  });

  flushList();
  return <div className="ai-answer-content">{blocks}</div>;
}

function TripleSparkles() {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true" className="triple-sparkle-icon">
      <path d="M12 2.5c1.3 5.9 3.3 7.9 9.2 9.2-5.9 1.3-7.9 3.3-9.2 9.2-1.3-5.9-3.3-7.9-9.2-9.2C8.7 10.4 10.7 8.4 12 2.5Z" fill="currentColor" />
      <path d="M24.2 16.2c.7 3 1.7 4 4.7 4.7-3 .7-4 1.7-4.7 4.7-.7-3-1.7-4-4.7-4.7 3-.7 4-1.7 4.7-4.7Z" fill="currentColor" />
      <path d="M25.7 2.8c.4 1.7 1 2.3 2.7 2.7-1.7.4-2.3 1-2.7 2.7-.4-1.7-1-2.3-2.7-2.7 1.7-.4 2.3-1 2.7-2.7Z" fill="currentColor" />
    </svg>
  );
}

function JobAssistant({ profile = null, jobId = null, compareJobIds = [], recommendedJobIds = [], filteredJobIds = [], compact = false }) {
  const [apiKey, setApiKey] = useState("");
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [apiKeySaved, setApiKeySaved] = useState(false);
  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);

  useLayoutEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) return;

    // Always keep the latest turn visible inside the chat viewport.
    container.scrollTop = container.scrollHeight;
  }, [messages, loading]);

  const sendPrompt = (prompt) => {
    setMessage(prompt);
    // Suggestion buttons are actions: submit immediately so the new question
    // appears in the conversation and the latest turn can be auto-scrolled.
    setTimeout(() => {
      const submit = async () => {
        if (!apiKey.trim()) {
          setError("Enter your Gemini API key to use the assistant.");
          return;
        }
        if (!prompt.trim() || loading) return;

        const previousConversation = messages.slice(-8);
        setMessages((previous) => [...previous, { role: "user", content: prompt.trim() }]);
        setMessage("");
        setLoading(true);
        setError("");
        setApiKeySaved(true);

        try {
          const response = await fetch(`${API_BASE_URL}/api/assistant/chat`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              gemini_api_key: apiKey,
              message: prompt.trim(),
              profile: profile || {},
              job_id: jobId || null,
              compare_job_ids: compareJobIds || [],
              recommended_job_ids: recommendedJobIds || [],
              filtered_job_ids: filteredJobIds || [],
              conversation: previousConversation,
              context_mode: jobId ? "job" : (recommendedJobIds.length ? "recommendations" : (filteredJobIds.length ? "filtered" : "general")),
            }),
          });

          const rawText = await response.text();
          let data = {};
          try {
            data = rawText ? JSON.parse(rawText) : {};
          } catch {
            data = { message: rawText };
          }
          if (!response.ok || !data.success) {
            let detail = data.error || data.detail || data.message;
            if (detail && typeof detail === "object") detail = detail.error || detail.message || JSON.stringify(detail);
            const detailText = detail ? String(detail) : `Assistant request failed (HTTP ${response.status}).`;
            if (response.status === 429 || /RESOURCE_EXHAUSTED|quota exceeded|rate limit/i.test(detailText)) {
              throw new Error("Gemini quota reached for this API project. Wait for the quota to reset or use a Gemini API project with available quota.");
            }
            throw new Error(detailText);
          }

          setMessages((previous) => [...previous, { role: "assistant", content: data.answer || "" }]);
        } catch (error) {
          console.error("Assistant error:", error);
          setError(error.message || "Something went wrong.");
        } finally {
          setLoading(false);
        }
      };
      submit();
    }, 0);
  };

  const sendMessage = async () => {
    if (!apiKey.trim()) {
      setError("Enter your Gemini API key to use the assistant.");
      return;
    }
    if (!message.trim()) {
      setError("Write a question first.");
      return;
    }

    const userMessage = message.trim();
    const previousConversation = messages.slice(-8);
    setMessages((previous) => [...previous, { role: "user", content: userMessage }]);
    setMessage("");
    setLoading(true);
    setError("");
    setApiKeySaved(true);

    try {
      const response = await fetch(`${API_BASE_URL}/api/assistant/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          gemini_api_key: apiKey,
          message: userMessage,
          profile: profile || {},
          job_id: jobId || null,
          compare_job_ids: compareJobIds || [],
          recommended_job_ids: recommendedJobIds || [],
          filtered_job_ids: filteredJobIds || [],
          conversation: previousConversation,
          context_mode: jobId ? "job" : (recommendedJobIds.length ? "recommendations" : (filteredJobIds.length ? "filtered" : "general")),
        }),
      });

      const rawText = await response.text();
      let data = {};
      try {
        data = rawText ? JSON.parse(rawText) : {};
      } catch {
        data = { message: rawText };
      }
      if (!response.ok || !data.success) {
        let detail = data.error || data.message || data.detail;
        if (detail && typeof detail === "object") detail = detail.error || detail.message || JSON.stringify(detail);
        const detailText = detail ? String(detail) : `Assistant request failed (HTTP ${response.status}).`;
        if (response.status === 429 || /RESOURCE_EXHAUSTED|quota exceeded|rate limit/i.test(detailText)) {
          throw new Error("Gemini quota reached for this API project. Wait for the quota to reset or use a Gemini API project with available quota.");
        }
        throw new Error(detailText);
      }

      setMessages((previous) => [...previous, { role: "assistant", content: data.answer || "" }]);
    } catch (error) {
      console.error("Assistant error:", error);
      setError(error.message || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="ai-assistant-panel">
      {!compact && (
        <div className="ai-assistant-header">
          <h2><span className="assistant-header-icon"><TripleSparkles /></span> Job Assistant</h2>
          <p>Ask about suitability, missing skills, preparation or the role itself.</p>
        </div>
      )}

      <div className="ai-assistant-key">
        <input
          type="password"
          placeholder="Gemini API key"
          value={apiKey}
          onChange={(event) => { setApiKey(event.target.value); setApiKeySaved(false); }}
        />
        {apiKeySaved && <span className="ai-key-status">Key active for this session</span>}
      </div>

      <div className="ai-assistant-context-note">
        {jobId
          ? "Using this job + your profile when available."
          : recommendedJobIds.length
            ? `Using your resume profile + ${recommendedJobIds.length} personalized match${recommendedJobIds.length === 1 ? "" : "es"}. Ask for a recommendation to rank these matches.`
            : filteredJobIds.length
              ? `Using your current ${filteredJobIds.length} visible job${filteredJobIds.length === 1 ? "" : "s"}.`
              : "You can ask general job-search questions too."}
      </div>

      <div className="ai-assistant-suggestions">
        {[
          ["Am I suitable?", jobId ? "Am I suitable for this job?" : "Am I suitable for the strongest available match?"],
          ["Missing skills", "What skills am I missing for the strongest match?"],
          ["Best job to apply", "Which available job should I apply for first, and why?"],
          ["How should I prepare?", jobId ? "How should I prepare for this role?" : "How should I prepare for the best available role?"],
        ].map(([label, prompt]) => (
          <button key={label} type="button" onClick={() => sendPrompt(prompt)} disabled={loading}>{label}</button>
        ))}
      </div>

      <div className="ai-assistant-messages" ref={messagesContainerRef}>
        {messages.length === 0 ? (
          <div className="ai-assistant-empty"><p>Your conversation will appear here.</p></div>
        ) : (
          messages.map((item, index) => (
            <div key={`${item.role}-${index}`} className={`chat-message ${item.role === "user" ? "user-message" : "assistant-message"}`}>
              <strong>{item.role === "user" ? "You" : "AI Assistant"}</strong>
              <AssistantAnswer content={item.content} />
            </div>
          ))
        )}
        {loading && <div className="chat-message assistant-message"><strong>AI Assistant</strong><p className="ai-thinking">Thinking...</p></div>}
        <div ref={messagesEndRef} aria-hidden="true" />
      </div>

      {error && <div className="ai-assistant-error">{error}</div>}

      <div className="ai-assistant-input">
        <textarea
          rows="3"
          placeholder={jobId ? "Ask something about this job..." : "Ask about these jobs or your job search..."}
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              sendMessage();
            }
          }}
        />
        <button type="button" onClick={sendMessage} disabled={loading}>{loading ? "Thinking..." : "Send"}</button>
      </div>
    </div>
  );
}

export default JobAssistant;