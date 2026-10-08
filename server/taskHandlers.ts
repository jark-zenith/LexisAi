export interface CapabilityRequest {
  mode: "transform" | "document" | "ocr" | "research" | "study" | "job" | "workflow";
  text?: string;
  action?: string;
  tone?: string;
  format?: string;
  customInstruction?: string;
  generateVariations?: boolean;
  stream?: boolean;
  usageCount?: number;
  requestId?: string;
  writingContext?: {
    audience?: string;
    purpose?: string;
    tone?: string;
    length?: "concise" | "standard" | "detailed" | "comprehensive";
    format?: string;
    instructions?: string;
  };
  // Document mode
  documentOptions?: {
    task: "summarize" | "explain" | "extract_key_points" | "simplify" | "qa" | "rewrite_section";
    questionOrSection?: string;
  };
  // Research mode
  researchOptions?: {
    topic: string;
    enableLiveWeb?: boolean;
  };
  // Study mode
  studyOptions?: {
    outputKind: "summary" | "key_points" | "flashcards" | "quiz" | "practice_questions" | "simple_explanation";
    difficulty: "beginner" | "intermediate" | "advanced";
  };
  // Job mode
  jobOptions?: {
    jobActionKind: "match_analysis" | "improve_cv" | "tailored_cover_letter" | "application_answers" | "interview_questions";
    jobDescription?: string;
    cvResumeText?: string;
    companyName?: string;
    roleTitle?: string;
  };
  // Workflow mode
  workflowOptions?: {
    documentType: "report" | "proposal" | "professional_email" | "cover_letter" | "cv_resume" | "assignment_draft" | "presentation_content" | "formal_letter";
    topicTitle: string;
    roughNotes: string;
    targetAudience?: string;
    keyGoals?: string;
  };
  // File / Image / OCR payload
  assetPayload?: {
    name?: string;
    mimeType?: string;
    base64Data?: string;
    textSnippet?: string;
    isImage?: boolean;
  };
}

export interface PreparedTask {
  systemInstruction: string;
  contents: any;
  tools?: any[];
  model?: string;
  isMultimodal?: boolean;
  notes?: string;
}

export function buildTaskPromptAndConfig(req: CapabilityRequest): PreparedTask {
  const {
    mode = "transform",
    text = "",
    action = "rewrite",
    tone,
    format = "general",
    customInstruction = "",
    writingContext,
    documentOptions,
    researchOptions,
    studyOptions,
    jobOptions,
    workflowOptions,
    assetPayload,
  } = req;

  // Build writing context addendum
  let contextAddendum = "";
  if (writingContext) {
    const parts: string[] = [];
    if (writingContext.audience) parts.push(`Target Audience: ${writingContext.audience}`);
    if (writingContext.purpose) parts.push(`Primary Goal: ${writingContext.purpose}`);
    if (writingContext.tone) parts.push(`Tone Constraint: ${writingContext.tone}`);
    if (writingContext.length) parts.push(`Length Target: ${writingContext.length}`);
    if (writingContext.instructions) parts.push(`Specific Instruction: ${writingContext.instructions}`);
    if (parts.length > 0) {
      contextAddendum = `\n[Writing Context & Constraints]:\n${parts.map((p) => `- ${p}`).join("\n")}\n`;
    }
  }

  // 1. OCR MODE: Image / Screenshot Text Extraction & Immediate Writing Workflow
  if (mode === "ocr" && assetPayload?.base64Data) {
    const rawBase64 = assetPayload.base64Data.includes(",")
      ? assetPayload.base64Data.split(",")[1]
      : assetPayload.base64Data;
    const mimeType = assetPayload.mimeType || "image/jpeg";

    const systemInstruction = `You are a precision OCR and document text extraction engine.
CRITICAL RULES:
1. Extract ALL visible text from the provided image accurately, including headers, paragraphs, lists, captions, and tables.
2. Maintain the layout order and structure of the original document.
3. Fix obvious OCR glitches only if they are clear character read errors; preserve numbers, dates, emails, and names with 100% fidelity.
4. Output the extracted clean markdown text directly with no introductory commentary.`;

    const userPrompt = `Please transcribe and extract all text from this image faithfully.${contextAddendum}`;

    return {
      systemInstruction,
      contents: [
        {
          inlineData: {
            mimeType,
            data: rawBase64,
          },
        },
        { text: userPrompt },
      ],
      model: "gemini-3.1-flash-image",
      isMultimodal: true,
      notes: "Text extracted directly from image.",
    };
  }

  // 2. DOCUMENT & PDF UNDERSTANDING MODE
  if (mode === "document") {
    const task = documentOptions?.task || "summarize";
    const userQuestion = documentOptions?.questionOrSection || "";
    const docText = text || assetPayload?.textSnippet || "";

    const systemInstruction = `You are an elite document intelligence and comprehension assistant.
Your job is to analyze, summarize, explain, demystify, and answer questions about provided documents, contracts, reports, and academic papers with rigorous accuracy.
CRITICAL RULES:
1. Ground your answers strictly in the text of the document.
2. If the user asks a question not answered in the text, clearly state that the document does not contain that information rather than hallucinating.
3. Be structured, readable, and authoritative. Use clear bold headings and bullet points.`;

    let taskPrompt = "";
    switch (task) {
      case "summarize":
        taskPrompt = `Please provide an Executive Summary of this document. Include:
1. Executive TL;DR (2-3 sentences)
2. Core Findings / Main Provisions
3. Important Dates, Deadlines, or Key Figures (if mentioned)
4. Strategic Takeaways or Conclusions`;
        break;
      case "extract_key_points":
        taskPrompt = `Extract the most critical key points and fundamental arguments from this document into clean, logically grouped bullet points.`;
        break;
      case "simplify":
        taskPrompt = `Demystify and simplify this document into plain, crystal-clear everyday English so that a non-technical reader or beginner can understand every point with zero confusion.`;
        break;
      case "explain":
        taskPrompt = `Provide a comprehensive, step-by-step explanation of this document, breaking down each major section, the reasoning, and how the parts connect.`;
        break;
      case "qa":
        taskPrompt = `Answer this specific question regarding the document thoroughly and objectively: "${userQuestion}". Cite the relevant section or context where possible.`;
        break;
      case "rewrite_section":
        taskPrompt = `Rewrite the following section or topic from the document to be clearer, more compelling, and professional: "${userQuestion}".`;
        break;
      default:
        taskPrompt = `Analyze and provide a structured summary of this document.`;
    }

    const fullPrompt = `${taskPrompt}
${contextAddendum}
Document Content:
"""
${docText}
"""`;

    return {
      systemInstruction,
      contents: fullPrompt,
      notes: `Document analysis completed for task: ${task}.`,
    };
  }

  // 3. RESEARCH MODE: Web search grounding & verifiable sources
  if (mode === "research") {
    const topic = researchOptions?.topic || text || "";
    const enableLiveWeb = researchOptions?.enableLiveWeb !== false;

    if (!enableLiveWeb) {
      const systemInstruction = `You are an analytical assistant.
CRITICAL MANDATES:
1. Google Search grounding is unavailable for this request.
2. DO NOT present synthesized or model-generated information as verified research, current facts, statistics, sources, or citations.
3. Clearly label this output at the very top with the exact header:
## Search unavailable — analytical draft
4. Use ONLY information already provided by the user in the prompt. Do not assume, assert, or extrapolate real-world facts, dates, market figures, statistics, studies, or empirical claims beyond what the user provided.
5. DO NOT fabricate sources, citations, dates, statistics, market data, or factual claims.
6. Provide an analytical draft, logical decomposition, or conceptual outline strictly grounded in the user's provided input. Clearly state that live search verification is unavailable.
7. Format with clean, structured markdown.`;

      const fullPrompt = `Topic / Information provided by user:
"${topic}"

${contextAddendum}
MANDATORY CONSTRAINT:
Google Search grounding is unavailable. Do NOT present synthesized or model-generated information as verified research, current facts, statistics, sources, or citations.
Clearly label the output at the very top as "Search unavailable — analytical draft" and use ONLY information already provided by the user above. Do NOT fabricate sources, dates, statistics, market data, or factual claims.`;

      return {
        systemInstruction,
        contents: fullPrompt,
        tools: undefined,
        notes: "Search unavailable — analytical draft",
      };
    }

    const systemInstruction = `You are a rigorous, unbiased research analyst.
CRITICAL RULES:
1. Provide a comprehensive, structured research report on the requested topic using live Google Search grounding.
2. Include:
   - Executive Overview & Current Consensus
   - Key Facts, Verified Developments & Evidence
   - Different Perspectives / Industry Analysis
   - Practical Implications & Outlook
3. When using live web information, strictly ground statements in factual evidence retrieved from Google Search.
4. DO NOT invent citations, dates, or false statistics.
5. If Google Search grounding is unavailable for any part or claim, do not present synthesized or model-generated information as verified research, current facts, statistics, sources, or citations.
6. Format with bold headers and readable markdown.`;

    const fullPrompt = `Research Topic / Question:
"${topic}"

${contextAddendum}
Please conduct in-depth research using live Google Search grounding and produce a structured, high-value brief on this topic. Ground all factual claims in verified search results.`;

    return {
      systemInstruction,
      contents: fullPrompt,
      tools: [{ googleSearch: {} }],
      notes: "Comprehensive research brief generated with live search grounding.",
    };
  }

  // 4. STUDY MODE: Flashcards, Quizzes, Simple Explanations, Practice Questions
  if (mode === "study") {
    const outputKind = studyOptions?.outputKind || "summary";
    const difficulty = studyOptions?.difficulty || "intermediate";
    const notesContent = text || "";

    const systemInstruction = `You are a master academic educator and pedagogical specialist.
Create high-yield, engaging, and pedagogically sound study materials based on the provided notes and subject matter.
Level of Difficulty: ${difficulty.toUpperCase()}.
CRITICAL RULES:
1. Ensure all concepts are explained accurately and testable.
2. For flashcards: Format clearly as "Card [N] Front (Question/Concept)" followed by "Back (Answer/Explanation)".
3. For quizzes: Provide 5 high-quality questions (Multiple Choice or Short Answer) with an Answer Key and Explanations at the bottom.
4. For practice questions: Include scenario-based questions that test application and critical thinking.
5. For simple explanations: Use intuitive analogies, everyday metaphors, and clear step-by-step logic.`;

    let instruction = "";
    switch (outputKind) {
      case "flashcards":
        instruction = "Create a set of 8-10 high-yield study flashcards with clear Front (Concept/Question) and Back (Concise Answer & Memory Aid).";
        break;
      case "quiz":
        instruction = "Generate a 5-question practice quiz testing key concepts. Include multiple-choice options (A, B, C, D) and a complete Answer Key with explanations at the end.";
        break;
      case "practice_questions":
        instruction = "Generate 5 exam-style practice questions with sample rubric answers and criteria for full credit.";
        break;
      case "simple_explanation":
        instruction = "Explain these concepts using simple analogies and everyday language as if explaining to a bright beginner (Feynman technique).";
        break;
      case "key_points":
        instruction = "Extract the essential definitions, laws, formulas, and fundamental principles into an organized quick-reference cheat sheet.";
        break;
      default:
        instruction = "Generate a structured revision summary highlighting the most critical concepts for test preparation.";
    }

    const fullPrompt = `Study Material Generation Task: ${instruction}
Difficulty Level: ${difficulty}
${contextAddendum}

Source Notes / Topic:
"""
${notesContent}
"""`;

    return {
      systemInstruction,
      contents: fullPrompt,
      notes: `Study material generated: ${outputKind} (${difficulty}).`,
    };
  }

  // 5. JOB & APPLICATION MODE: Match Analysis, Cover Letters, Interview Prep
  if (mode === "job") {
    const jobAction = jobOptions?.jobActionKind || "match_analysis";
    const cvText = jobOptions?.cvResumeText || text || "";
    const jobDesc = jobOptions?.jobDescription || "";
    const role = jobOptions?.roleTitle || "";
    const company = jobOptions?.companyName || "";

    const systemInstruction = `You are an executive career advisor and seasoned hiring consultant.
STRICT TRUTH & ETHICS RULES:
1. NEVER fabricate qualifications, experience, employers, degrees, or false achievements not present in the user's CV/notes.
2. Highlight and elevate genuine transferable skills, quantified accomplishments, and relevant keywords from the actual candidate background.
3. Provide crisp, professional, ATS-optimized language.`;

    let taskInstruction = "";
    switch (jobAction) {
      case "match_analysis":
        taskInstruction = `Conduct an ATS Match & Gap Analysis between the Candidate CV and Job Description.
Include:
1. Overall Match Score Assessment (%) & Summary
2. Core Strengths & Matched Qualifications
3. Skill / Qualification Gaps & How to Address Them
4. High-Priority Keywords to Emphasize`;
        break;
      case "tailored_cover_letter":
        taskInstruction = `Write a compelling, tailored cover letter for this role.
Show genuine interest, connect the candidate's real accomplishments directly to the company's pain points and requirements, and maintain a confident, professional tone.`;
        break;
      case "improve_cv":
        taskInstruction = `Provide targeted improvements for the candidate's CV bullet points to align with this target role. Transform duties into quantified accomplishment statements using strong action verbs.`;
        break;
      case "application_answers":
        taskInstruction = `Draft strong responses using the STAR framework (Situation, Task, Action, Result) for the most likely application screening questions for this position.`;
        break;
      case "interview_questions":
        taskInstruction = `Generate 5 high-probability interview questions for this specific position, along with strategic talking points and recommended answers based on the candidate's actual experience.`;
        break;
    }

    const fullPrompt = `Career Task: ${taskInstruction}
${role ? `Target Role: ${role}` : ""}
${company ? `Target Company: ${company}` : ""}
${contextAddendum}

Candidate CV / Experience:
"""
${cvText}
"""

Job Description / Posting:
"""
${jobDesc}
"""`;

    return {
      systemInstruction,
      contents: fullPrompt,
      notes: `Career assistant output: ${jobAction}.`,
    };
  }

  // 6. FINISHED DOCUMENT WORKFLOWS (Report, Proposal, Email, Assignment, Deck, etc.)
  if (mode === "workflow") {
    const docType = workflowOptions?.documentType || "report";
    const title = workflowOptions?.topicTitle || "Document";
    const notes = workflowOptions?.roughNotes || text || "";
    const audience = workflowOptions?.targetAudience || writingContext?.audience || "Stakeholders";
    const goals = workflowOptions?.keyGoals || writingContext?.purpose || "";
    const isReportWorkflow = docType === "report";

    const systemInstruction = `You are an elite executive document writer and communication architect.
Execute a rigorous 5-stage synthesis pipeline:
Analyze Input Notes → Structure Document Blueprint → Synthesize Grounded Content → Refine & Check Factual Consistency → Output Final Publication-Ready Document.

STRICT FACTUAL INTEGRITY & ANTI-FABRICATION CONSTITUTION (MANDATORY):
1. USE ONLY facts and information explicitly provided by the user in their notes/input, or verified information from an available source.
2. DO NOT INVENT, ASSUME, OR FABRICATE ANY OF THE FOLLOWING:
   - Dates or timestamps: Never invent specific dates, years, deadlines, or schedules. If a date is not provided by the user, omit it or write "Date: [Not specified]".
   - Statistics or market data: Never introduce invented numbers, percentages, growth benchmarks, TAM/SAM, or market figures.
   - Financial results: Never fabricate customer numbers, active user counts, revenue, profits, margins, valuation, or financial projections as facts.
   - Credentials or achievements: Never invent company achievements, historical milestones, client partnerships, past experience, client logos, awards, or team credentials.
   - Market conditions: Never assert claims such as "underserved market", "booming demand", "market leader", or "untapped gap" unless specifically provided or verified in the user's input.
   - Research findings or citations: Never fabricate studies, academic research findings, external whitepapers, surveys, or fictitious source links.
3. REWRITING UNSUPPORTED CLAIMS & STRATEGIC RECOMMENDATIONS:
   - If an idea, objective, claim, or target cannot be supported by the provided notes as an established fact, rewrite and frame it explicitly as a "Proposal", "Working Assumption", "Recommended Strategy", or "Target Objective" rather than presenting it as fact.
4. STRUCTURE & EXECUTIVE POLISH:
   - Produce a complete, polished, and structured document formatted with clear markdown headings.
   - Tone must be objective, credible, professional, and free of hype or ungrounded assertions.`;

    let reportSpecificGuidelines = "";
    if (isReportWorkflow) {
      reportSpecificGuidelines = `
BUSINESS / PROJECT REPORT WORKFLOW SPECIFICATIONS:
- Structure the report clearly:
  * Document Header: Title, Target Audience (${audience}), Date (Use explicitly provided date or "Date: [Not specified]")
  * Executive Summary: Concise overview strictly reflecting the provided facts and project scope
  * Background & Current Status: Grounded solely in user-supplied facts; clearly identify any known information baselines
  * Analysis & Core Findings: Detailed synthesis of supplied material without adding unstated metrics or fictitious achievements
  * Working Assumptions & Scope Boundaries: Clearly designate any unverified factors or projections as assumptions rather than facts
  * Strategic Recommendations / Proposed Next Steps: Actionable, forward-looking proposals framed as recommendations rather than completed outcomes`;
    }

    const fullPrompt = `Finished Document Synthesis Task
Document Type: ${docType === "report" ? "Business / Project Report" : docType.toUpperCase()}
Document Title / Subject: ${title}
Target Audience: ${audience}
Key Objective: ${goals || "Synthesize rough notes into a professional finished document"}
${reportSpecificGuidelines}
${contextAddendum}

Source Notes / Rough Input:
"""
${notes}
"""

Please synthesize these inputs into a publication-ready ${docType === "report" ? "Business / Project Report" : docType}. Remember the strict anti-fabrication rules: do not invent dates, statistics, customer numbers, revenue, achievements, or market claims. Use "Date: [Not specified]" if date is missing, and frame unsupported claims as proposals or assumptions.`;

    return {
      systemInstruction,
      contents: fullPrompt,
      notes: `Finished document generated: ${docType === "report" ? "Business / Project Report" : docType}.`,
    };
  }

  // 7. DEFAULT TRANSFORM MODE (Writing, rewriting, shortening, tone, etc.)
  let actionInstruction = "";
  switch (action) {
    case "rewrite":
      actionInstruction =
        "Rewrite and rephrase the input text to be clear, natural, engaging, and well-structured while keeping its original meaning and key details intact.";
      break;
    case "summarize":
      actionInstruction =
        "Provide a concise, high-impact summary of the main points and key takeaways. Include a quick 1-2 sentence TL;DR followed by crisp bullet points if the text is detailed.";
      break;
    case "improve":
    case "grammar":
      actionInstruction =
        "Improve the text by fixing all grammar, spelling, typos, punctuation, awkward phrasing, and sentence flow while elevating vocabulary and polish to professional standards. Keep the original intent intact.";
      break;
    case "shorten":
      actionInstruction =
        "Condense and trim the text to be punchy, direct, and concise, removing redundancies and filler words without losing crucial information.";
      break;
    case "expand":
      actionInstruction =
        "Expand and flesh out the text with relevant context, thoughtful elaboration, smooth transitions, and complete thoughts while remaining natural and purposeful.";
      break;
    case "bulletize":
    case "bullets":
      actionInstruction =
        "Convert the text into clean, structured, readable bullet points categorized logically if appropriate.";
      break;
    case "generate":
      actionInstruction =
        "Generate high-quality, ready-to-use content based on the provided prompt/topic, structured perfectly for the specified context.";
      break;
    case "tone":
      actionInstruction = `Adjust the tone of the text specifically to be distinctly ${tone || "professional"}, ensuring phrasing, word choice, and cadence match this tone seamlessly.`;
      break;
    default:
      actionInstruction = "Process and enhance the text according to best writing practices.";
  }

  let toneInstruction = tone ? `Target tone: ${tone}.` : "";
  let formatInstruction = "";
  if (format && format !== "general") {
    formatInstruction = `Target format/medium: ${format} (format appropriately with suitable greetings/closings/paragraphs/emojis if standard for this medium).`;
  }

  let extraInstruction = customInstruction
    ? `Additional user instructions: "${customInstruction}". Follow this closely.`
    : "";

  const systemInstruction = `You are an elite, highly skilled AI writing assistant and editor. 
Produce top-tier, ready-to-use written copy for everyday tasks (messages, emails, captions, job applications, updates, pitches, reviews).
CRITICAL RULES:
1. Provide ONLY the final result text directly.
2. DO NOT include meta-chatter, preamble, or conversational fluff like "Here is your rewritten text:" or "Sure!".
3. Keep the output clean, natural, human-sounding, and free of cliché AI filler phrases.
4. Preserve markdown formatting (bolding, lists, line breaks) where it enhances readability.`;

  const fullPrompt = `Task: ${actionInstruction}
${toneInstruction}
${formatInstruction}
${extraInstruction}
${contextAddendum}

Original Content/Input:
"""
${text}
"""

Output the refined text directly:`;

  return {
    systemInstruction,
    contents: fullPrompt,
  };
}
