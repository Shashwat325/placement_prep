import React, { useState, useEffect, useCallback } from "react";
import Navbar from "../components/Navbar.jsx";
import "bootstrap/js/dist/base-component.js";
import api from '../api/client.js'; // your existing axios instance — already attaches the JWT token
import { Plus, Upload, CheckCircle2, AlertCircle, Loader2, ChevronDown, ListChecks, Mic, Shuffle, FileText, UploadCloud } from "lucide-react";
const QUESTION_TYPES = [
  {
    value: "mcq",
    label: "MCQ",
    icon: ListChecks,
    needsOptions: true,
    needsAnswer: true,
    promptLabel: "type you question",
  },
  {
    value: "jumbled_sentence",
    label: "Jumbled sentence",
    icon: Shuffle,
    needsOptions: false,
    needsAnswer: true,
    promptLabel: "Scrambled sentence",
    answerLabel: "Correct sentence",
  },
  {
    value: "repeat_paragraph",
    label: "Repeat paragraph",
    icon: Mic,
    needsOptions: false,
    needsAnswer: false,
    promptLabel: "Paragraph to read aloud",
  },
  {
    value: "summarize_paragraph",
    label: "Summarize paragraph",
    icon: FileText,
    needsOptions: false,
    needsAnswer: false,
    promptLabel: "Paragraph to summarize",
  },
  {value:"solve the puzzle",
    label:"Solve the puzzle",
    icon:FileText,
    needsOptions:true,
    needsAnswer:true,
    promptLabel:"Puzzle to solve",
    answerLabel:"Correct answer"
  }
];

const DIFFICULTIES = ["easy", "medium", "hard"];

function Field({ label, hint, children }) {
  return (
    <label className="block">
      <div className="flex items-baseline justify-between mb-1.5">
        <span className="text-[13px] font-medium text-stone-700 tracking-wide">{label}</span>
        {hint && <span className="text-[11px] text-stone-400">{hint}</span>}
      </div>
      {children}
    </label>
  );
}

const inputClass =
  "w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-[14px] text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-teal-600/40 focus:border-teal-600 transition-colors";

function Toast({ toast, onClose }) {
  if (!toast) return null;
  const isError = toast.type === "error";
  return (
    <div
      role="status"
      className={`fixed bottom-5 right-5 z-50 flex items-start gap-2.5 rounded-lg border px-4 py-3 shadow-lg max-w-sm ${
        isError ? "bg-red-50 border-red-200 text-red-800" : "bg-emerald-50 border-emerald-200 text-emerald-800"
      }`}
    >
      {isError ? <AlertCircle size={18} className="mt-0.5 shrink-0" /> : <CheckCircle2 size={18} className="mt-0.5 shrink-0" />}
      <div className="text-[13px] leading-snug">{toast.message}</div>
      <button onClick={onClose} className="ml-1 text-current/60 hover:text-current text-[13px] leading-none">
        ✕
      </button>
    </div>
  );
}

export default function AdminQuestionUpload() {
  const [skillAreas, setSkillAreas] = useState([]);
  const [topics, setTopics] = useState([]);
  const [loadingSkillAreas, setLoadingSkillAreas] = useState(true);
  const [loadingTopics, setLoadingTopics] = useState(false);

  const [skillAreaId, setSkillAreaId] = useState("");
  const [topicId, setTopicId] = useState("");
  const [newTopicName, setNewTopicName] = useState("");
  const [addingTopic, setAddingTopic] = useState(false);

  const [questionType, setQuestionType] = useState("mcq");
  const [prompt, setPrompt] = useState("");
  const [options, setOptions] = useState(["", "", "", ""]);
  const [correctAnswer, setCorrectAnswer] = useState("");
  const [difficulty, setDifficulty] = useState("medium");

  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState(null);
  const [recentlyAdded, setRecentlyAdded] = useState([]);
  const [mode, setMode] = useState("single"); // "single" | "bulk"
const [csvFile, setCsvFile] = useState(null);
const [csvFileName, setCsvFileName] = useState("");
const [csvUploading, setCsvUploading] = useState(false);
const [csvResult, setCsvResult] = useState(null); // { inserted, failed: [...] }
  const activeType = QUESTION_TYPES.find((t) => t.value === questionType);

  const showToast = (type, message) => {
    setToast({ type, message });
    window.clearTimeout(showToast._t);
    showToast._t = window.setTimeout(() => setToast(null), 4000);
  };

  // ---- load skill areas on mount (single, correct effect — using your
  // existing api client, so the JWT token is attached automatically) ----
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await api.get('/admin/skill-areas');
        if (!cancelled) setSkillAreas(res.data);
      } catch {
        if (!cancelled) showToast("error", "Couldn't load skill areas. Check the API connection.");
      } finally {
        if (!cancelled) setLoadingSkillAreas(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // ---- load topics whenever skill area changes ----
  const loadTopics = useCallback(async (id) => {
    if (!id) {
      setTopics([]);
      return;
    }
    setLoadingTopics(true);
    try {
      const res = await api.get('/admin/topics', { params: { skill_area_id: id } });
      setTopics(res.data);
    } catch {
      showToast("error", "Couldn't load topics for that skill area.");
    } finally {
      setLoadingTopics(false);
    }
  }, []);

  useEffect(() => {
    setTopicId("");
    loadTopics(skillAreaId);
  }, [skillAreaId, loadTopics]);

  const resetQuestionFields = () => {
    setPrompt("");
    setOptions(["", "", "", ""]);
    setCorrectAnswer("");
    setDifficulty("medium");
  };

  const handleAddTopic = async () => {
    if (!skillAreaId || !newTopicName.trim()) return;
    setAddingTopic(true);
    try {
      const res = await api.post('/admin/topics', {
        skill_area_id: skillAreaId,
        name: newTopicName.trim(),
      });
      const created = res.data;
      setTopics((prev) => [...prev, created]);
      setTopicId(String(created.id));
      setNewTopicName("");
      showToast("success", `Topic "${created.name}" created.`);
    } catch {
      showToast("error", "Couldn't create that topic.");
    } finally {
      setAddingTopic(false);
    }
  };

  const validate = () => {
    if (!skillAreaId) return "Pick a skill area first.";
    if (!topicId) return "Pick or create a topic.";
    if (!prompt.trim()) return "The question prompt can't be empty.";
    if (activeType.needsOptions && options.some((o) => !o.trim())) return "Fill in all four options.";
    if (activeType.needsAnswer && !correctAnswer.trim()) return "Set the correct answer.";
    if (questionType === "mcq" && correctAnswer && !options.includes(correctAnswer)) {
      return "Correct answer must match one of the options exactly.";
    }
    return null;
  };
  const handleCsvChange = (e) => {
  const f = e.target.files[0];
  if (!f) return;
  if (!f.name.endsWith(".csv")) {
    showToast("error", "Please select a .csv file");
    return;
  }
  setCsvFile(f);
  setCsvFileName(f.name);
  setCsvResult(null);
};

const handleCsvUpload = async () => {
  if (!csvFile) {
    showToast("error", "Choose a CSV file first");
    return;
  }
  setCsvUploading(true);
  setCsvResult(null);
  const formData = new FormData();
  formData.append("file", csvFile);
  try {
    const res = await api.post("/admin/questions/bulk-csv", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    setCsvResult(res.data);
    if (res.data.failed.length === 0) {
      showToast("success", `${res.data.inserted} question(s) uploaded.`);
      setCsvFile(null);
      setCsvFileName("");
    } else {
      showToast("error", `${res.data.failed.length} row(s) failed — see details below.`);
    }
  } catch {
    showToast("error", "Upload failed. Check the file and try again.");
  } finally {
    setCsvUploading(false);
  }
};

const downloadSampleCsv = () => {
  const sample = `skill_area_name,topic_name,question_type,prompt,options,correct_answer
Aptitude,Percentages,mcq,"What is 20% of 150?","30|45|20|15",30
Speaking,Fluency,repeat_paragraph,"Read this sentence aloud",,"The quick brown fox jumps over the lazy dog"`;
  const blob = new Blob([sample], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "sample_questions.csv";
  a.click();
  URL.revokeObjectURL(url);
};
  const handleSubmit = async (e) => {
    e.preventDefault();
    const err = validate();
    if (err) {
      showToast("error", err);
      return;
    }
    setSubmitting(true);
    try {
      const payload = {
        topic_id: topicId,
        question_type: questionType,
        prompt: prompt.trim(),
        correct_answer: activeType.needsAnswer ? correctAnswer.trim() : null,
        options: activeType.needsOptions ? options.map((o) => o.trim()) : null,
        difficulty,
      };
      const res = await api.post('/admin/questions', payload);
      const created = res.data;
      setRecentlyAdded((prev) => [created, ...prev].slice(0, 6));
      showToast("success", "Question added.");
      resetQuestionFields();
    } catch {
      showToast("error", "Failed to save the question. Nothing was written.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex flex-col bg-stone-50 text-stone-900" style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>
      <Navbar />
      <div className="max-w-3xl w-full mx-auto px-6 pt-6">
  <div className="d-flex gap-2 p-1 rounded-lg" style={{ backgroundColor: "#252627", width: "fit-content" }}>
    <button
      type="button"
      onClick={() => setMode("single")}
      className={`px-4 py-2 rounded-md text-[13px] font-medium transition-colors ${
        mode === "single" ? "bg-black text-white" : "text-stone-600"
      }`}
    >
      Single question
    </button>
    <button
      type="button"
      onClick={() => setMode("bulk")}
      className={`px-4 py-2 rounded-md text-[13px] font-medium transition-colors ${
        mode === "bulk" ? "bg-black text-white" : "text-stone-600"
      }`}
    >
      Bulk upload (CSV)
    </button>
  </div>
</div>
      <div className="max-w-3xl w-full mx-auto px-6 py-8 grid gap-2">

        {/* Placement in the bank */}
        {mode==='single'&&(
        <section className="border border-stone-200 rounded-xl d-flex flex-column flex-wrap align-items-center p-0" style={{ backgroundColor: "#899ec0",height:"50vh" }}  >
          <h2 className="text-[13px] font-semibold text-stone-800 mb-4 ">Where this goes</h2>
          <div className="bg-dark  gap-4 d-flex flex-column text-white align-items-stretch"  >
            <Field label="Skill area">
              <div className="relative ">
                <select
                  className={inputClass + " appearance-none pr-8"}
                  value={skillAreaId}
                  onChange={(e) => setSkillAreaId(e.target.value)}
                  disabled={loadingSkillAreas}
                >
                  <option value="">{loadingSkillAreas ? "Loading…" : "Select a skill area"}</option>
                  {skillAreas.map((sa) => (
                    <option key={sa.id} value={sa.id}>
                      {sa.name} · {sa.type}
                    </option>
                  ))}
                </select>
                {/*<ChevronDown size={15} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-400" />*/}
              </div>
            </Field>

            <Field label="Topic">
              <div className="relative">
                <select
                  className={inputClass + " appearance-none pr-8"}
                  value={topicId}
                  onChange={(e) => setTopicId(e.target.value)}
                  disabled={!skillAreaId || loadingTopics}
                >
                  <option value="">
                    {!skillAreaId ? "Pick a skill area first" : loadingTopics ? "Loading…" : "Select a topic"}
                  </option>
                  {topics.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
                {/*<ChevronDown size={15} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-400" />*/}
              </div>
            </Field>
            {skillAreaId && (
            <div className="mt-3 flex bg-dark w-75 items-center gap-2">
              Add a new Topic
              <input
                className={inputClass + " flex-1"}
                placeholder="New topic name (e.g. Time & Work)"
                value={newTopicName}
                onChange={(e) => setNewTopicName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleAddTopic())}
              />
              <button
                type="button"
                onClick={handleAddTopic}
                disabled={addingTopic || !newTopicName.trim()}
                className="shrink-0 inline-flex items-center gap-1.5 rounded-md border border-stone-300 bg-stone-50 px-3 py-2 text-[13px] font-medium text-stone-700 hover:bg-stone-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {addingTopic ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                Add topic
              </button>
            </div>
          )}
          </div>

          
                </section>)}

        {mode === "single" && (
          <>
            {/* Question type selector */}
            <section className="p-1 d-flex flex-column gap-0">
              <h2 className="text-[13px] font-semibold text-white text-center bg-dark mp-3 mb-2 tracking-wide">Question type</h2>
              <div className="d-flex flex-row justify-content-center gap-0 w-full p-2 rounded-lg flex-wrap" style={{ backgroundColor: "#d3def0" }} >
                {QUESTION_TYPES.map((t) => {
                  const Icon = t.icon;
                  const active = questionType === t.value;
                  return (
                    <button
                      key={t.value}
                      type="button"
                      onClick={() => {
                        setQuestionType(t.value);
                        resetQuestionFields();
                      }}
                      className={`flex flex-col mw-full items-center gap-2 rounded-lg border px-3 py-3 text-center transition-colors ${
                        active
                          ? "border-teal-600 bg-teal-50/70 ring-1 ring-teal-600/30"
                          : "border-stone-200 bg-white hover:border-stone-300"
                      }`}
                    >
                      <Icon size={16} className={active ? "text-teal-700" : "text-stone-400"} />
                      <span className={`text-[12.5px] font-medium leading-tight ${active ? "text-teal-900" : "text-stone-600"}`}>
                        {t.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>

            {/* Question form */}
            <form onSubmit={handleSubmit} className="bg-white d-flex flex-column justify-content-center border border-stone-200 rounded-xl p-5 ">
              <Field label={activeType.promptLabel} hint={`${prompt.length} chars`}>
                <textarea
                  className={inputClass + " min-h-[96px] resize-y"}
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder={
                    questionType === "mcq"
                      ? "e.g. What is 15% of 240?"
                      : questionType === "jumbled_sentence"
                      ? "e.g. quickly / the / fox / jumped / brown"
                      : "Paste the paragraph text…"
                  }
                />
              </Field>

              {activeType.needsOptions && (
                <div>
                  <div className="text-[13px] font-medium text-stone-700 mb-1.5">Options</div>
                  <div className="grid sm:grid-cols-2 gap-2.5">
                    {options.map((opt, i) => (
                      <input
                        key={i}
                        className={inputClass}
                        placeholder={`Option ${String.fromCharCode(65 + i)}`}
                        value={opt}
                        onChange={(e) => {
                          const next = [...options];
                          next[i] = e.target.value;
                          setOptions(next);
                        }}
                      />
                    ))}
                  </div>
                </div>
              )}

              {activeType.needsAnswer && (
                <Field label={activeType.answerLabel || "Correct answer"}>
                  {questionType === "mcq" ? (
                    <div className="relative">
                      <select
                        className={inputClass + " appearance-none pr-8"}
                        value={correctAnswer}
                        onChange={(e) => setCorrectAnswer(e.target.value)}
                      >
                        <option value="">Select the correct option</option>
                        {options.map((opt, i) =>
                          opt.trim() ? (
                            <option key={i} value={opt}>
                              {String.fromCharCode(65 + i)}. {opt}
                            </option>
                          ) : null
                        )}
                      </select>
                      <ChevronDown size={15} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-400" />
                    </div>
                  ) : (
                    <textarea
                      className={inputClass + " min-h-[70px] resize-y"}
                      value={correctAnswer}
                      onChange={(e) => setCorrectAnswer(e.target.value)}
                      placeholder="e.g. The quick brown fox jumped"
                    />
                  )}
                </Field>
              )}

              <Field label="Difficulty">
                <div className="flex gap-2">
                  {DIFFICULTIES.map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setDifficulty(d)}
                      className={`px-3 py-1.5 rounded-md text-[12.5px] font-medium border capitalize transition-colors ${
                        difficulty === d
                          ? "border-teal-600 bg-teal-600 text-dark hover:bg-teal-700"
                          : "border-stone-300 bg-white text-stone-600 hover:bg-stone-50"
                      }`}
                    >
                      {d}
                    </button>
                  ))}
                </div>
              </Field>

              <div className="flex items-center justify-between pt-1 border-t border-stone-100 mt-1">
                <span className="text-[12px] text-stone-400">
                  Submits directly to <code className="bg-stone-100 px-1 py-0.5 rounded text-[11.5px]">POST /api/admin/questions</code>
                </span>
                <button
                  type="submit"
                  disabled={submitting}
                  className="inline-flex items-center gap-2 rounded-md bg-teal-700 hover:bg-teal-800 disabled:opacity-60 text-dark text-[13.5px] font-medium px-4 py-2 transition-colors"
                >
                  {submitting ? <Loader2 size={15} className="animate-spin " /> : <Upload size={15} />}
                  {submitting ? "Saving…" : "Upload"}
                </button>
              </div>
            </form>
          </>
        )}

        {mode === "bulk" && (
          <section className="bg-white border border-stone-200 rounded-xl p-5">
            <div className="d-flex align-items-center justify-content-between mb-4">
              <h2 className="text-[13px] font-semibold text-stone-800 tracking-wide">Upload questions from CSV</h2>
              <button
                type="button"
                onClick={downloadSampleCsv}
                className="text-[12px] text-teal-700 hover:text-teal-800 font-medium"
              >
                Download sample CSV
              </button>
            </div>

            <Field label="CSV file" hint="columns: skill_area_name, topic_name, question_type, prompt, options, correct_answer">
              <input
                type="file"
                accept=".csv"
                className={inputClass}
                onChange={handleCsvChange}
                disabled={csvUploading}
              />
            </Field>
            {csvFileName && <p className="text-[12px] text-stone-500 mt-1.5">Selected: {csvFileName}</p>}

            <div className="d-flex justify-content-end pt-3 mt-2 border-t border-stone-100">
              <button
                type="button"
                onClick={handleCsvUpload}
                disabled={!csvFile || csvUploading}
                className="inline-flex items-center gap-2 rounded-md bg-teal-700 hover:bg-teal-800 disabled:opacity-60 text-white text-[13.5px] font-medium px-4 py-2 transition-colors"
              >
                {csvUploading ? <Loader2 size={15} className="animate-spin" /> : <UploadCloud size={15} />}
                {csvUploading ? "Uploading…" : "Upload CSV"}
              </button>
            </div>

            {csvResult && (
              <div className="mt-4 pt-4 border-t border-stone-100">
                <p className="text-[13px] text-stone-800 font-medium">
                  Inserted {csvResult.inserted} question{csvResult.inserted !== 1 ? "s" : ""}
                </p>
                {csvResult.failed.length > 0 && (
                  <div className="mt-2 max-h-56 overflow-y-auto">
                    {csvResult.failed.map((f, i) => (
                      <div key={i} className="text-[12.5px] text-red-700 py-1">
                        Row {f.row} ("{f.question}"): {f.reason}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </section>
        )}

        {/* Recently added */}

        {/* Recently added */}
        {recentlyAdded.length > 0 && (
          <section>
            <h2 className="text-[13px] font-semibold text-stone-800 mb-3 tracking-wide">Just added</h2>
            <div className="grid gap-2">
              {recentlyAdded.map((q) => (
                <div key={q.id} className="flex items-start gap-3 bg-white border border-stone-200 rounded-lg px-3.5 py-2.5">
                  <CheckCircle2 size={15} className="text-teal-600 mt-0.5 shrink-0" />
                  <div className="min-w-0">
                    <div className="text-[13px] text-stone-800 truncate">{q.prompt}</div>
                    <div className="text-[11px] text-stone-400 mt-0.5 capitalize">{q.question_type.replace(/_/g, " ")} · {q.difficulty}</div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>

      <Toast toast={toast} onClose={() => setToast(null)} />
    </div>
  );
}