import { useState } from "react";
import { API_BASE_URL } from "./lib/apiConfig";

function ResumeUpload({ onJobSelect, onRecommendationsChange, initialProfile = null, compact = false }) {
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState(initialProfile ? "Your saved resume profile is ready." : "");
  const [resumeInfo, setResumeInfo] = useState(null);
  const [profile, setProfile] = useState(initialProfile);
  const [recommendations, setRecommendations] = useState([]);

  const handleFileChange = (event) => {
    const selectedFile = event.target.files?.[0];
    if (!selectedFile) return;
    if (selectedFile.type !== "application/pdf") {
      setMessage("Please upload a PDF resume.");
      setFile(null);
      return;
    }
    setFile(selectedFile);
    setMessage("");
    setResumeInfo(null);
    setProfile(null);
    setRecommendations([]);
    onRecommendationsChange?.([], null);
  };

  const uploadResume = async () => {
    if (!file) { setMessage("Choose a resume PDF first."); return; }
    setUploading(true); setMessage(""); setResumeInfo(null); setProfile(null); setRecommendations([]);
    onRecommendationsChange?.([], null);
    const formData = new FormData(); formData.append("file", file);
    try {
      const response = await fetch(`${API_BASE_URL}/api/resume/upload`, { method: "POST", body: formData });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.message || "Upload failed");
      setResumeInfo(data);
      const basicProfile = buildBasicProfile(data.text || "");
      setProfile(basicProfile);
      const recommendationResponse = await fetch(`${API_BASE_URL}/api/jobs/recommend`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ profile: basicProfile, limit: 10 })
      });
      const recommendationData = await recommendationResponse.json();
      if (!recommendationResponse.ok) throw new Error(recommendationData.message || "Recommendation request failed");
      const nextRecommendations = recommendationData.recommendations || [];
      setRecommendations(nextRecommendations);
      onRecommendationsChange?.(nextRecommendations, basicProfile);
      setMessage("Your personalized matches are ready.");
    } catch (error) {
      console.error("Resume processing failed:", error);
      setMessage(error.message || "Resume processing failed.");
    } finally { setUploading(false); }
  };

  return <div className={`resume-upload-panel ${compact ? "compact-resume" : ""}`}>
    <div className="resume-dropzone"><div className="resume-upload-icon" aria-hidden="true"><svg viewBox="0 0 32 32"><path d="M10 25.5h13.2a5.8 5.8 0 0 0 .4-11.6A7.7 7.7 0 0 0 8.7 12a6.7 6.7 0 0 0 1.3 13.5Z" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/><path d="M16 20V9.5m0 0-4 4m4-4 4 4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg></div><div className="resume-drop-copy"><h4>{compact ? "Upload your resume" : "Upload a PDF resume"}</h4><p>{compact ? "Get personalized job matches." : "We'll extract the useful parts and build a matching profile."}</p></div><label className="resume-choose-button">Choose PDF<input className="resume-input" type="file" accept=".pdf,application/pdf" onChange={handleFileChange} /></label></div>
    {file && <div className="resume-selected"><span>PDF</span><strong>{file.name}</strong></div>}
    <button type="button" className="resume-build-button" onClick={uploadResume} disabled={!file || uploading}>{uploading ? "Building your matches..." : "Build my job matches"}<span>→</span></button>
    {message && <div className="resume-status">{message}</div>}
    {resumeInfo && <div className="resume-meta"><span>{resumeInfo.pages} pages</span><span>{resumeInfo.text_length} chars</span></div>}
    {profile && <div className="resume-profile-card"><div><span className="section-kicker">MATCH PROFILE</span><h4>Your resume profile</h4><p>{profile.summary}</p></div><div className="profile-chip-row">{profile.skills?.slice(0, 6).map((skill) => <span key={skill}>{skill}</span>)}</div></div>}
  </div>;
}

function buildBasicProfile(text) {
  const normalizedText = text.toLowerCase();
  const skillDictionary = ["python", "sql", "power bi", "tableau", "pandas", "numpy", "machine learning", "deep learning", "javascript", "react", "node.js", "java", "aws", "azure", "docker", "kubernetes", "excel", "postgresql", "mongodb"];
  const roleDictionary = ["data analyst", "data scientist", "business analyst", "business intelligence analyst", "machine learning engineer", "software engineer", "frontend developer", "backend developer", "full stack developer"];
  const skills = skillDictionary.filter((skill) => normalizedText.includes(skill));
  const roles = roleDictionary.filter((role) => normalizedText.includes(role));
  const experienceMatch = text.match(/(\d+)\+?\s*(?:years?|yrs?)\s+(?:of\s+)?(?:professional\s+)?experience/i);
  return { summary: "Profile generated from resume content.", skills, roles, experience_years: experienceMatch ? Number(experienceMatch[1]) : null };
}

export default ResumeUpload;