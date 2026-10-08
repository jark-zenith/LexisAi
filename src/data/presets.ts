import { PresetExample } from "../types";

export const PRESET_EXAMPLES: PresetExample[] = [
  {
    id: "messy-email",
    title: "Messy Work Update",
    category: "Email",
    action: "improve",
    tone: "professional",
    format: "email",
    customInstruction: "Make it clear, polite, and action-oriented",
    text: `hey team, just wanted to say the project is kinda behind schedule cuz the api broke yesterday and mark was out. we need everyone to hop on a quick call at 2pm maybe to fix the blocker or we wont ship by friday. please let me know asap if u can make it thx.`,
  },
  {
    id: "slack-message",
    title: "Casual Message to Manager",
    category: "Chat / Slack",
    action: "rewrite",
    tone: "friendly",
    format: "message",
    customInstruction: "Keep it warm and courteous",
    text: `hi Sarah, do you have 5 mins today? I want to ask about my vacation request for next week because flights are getting expensive. let me know when you're free`,
  },
  {
    id: "meeting-notes",
    title: "Raw Meeting Notes",
    category: "Summarize",
    action: "bulletize",
    tone: "concise",
    format: "bullets",
    customInstruction: "Group by Decision and Action Items with assignees",
    text: `Q3 Product Sync Notes:
Discussed onboarding drop-off at step 3. Alex suggested simplifying form fields from 8 to 4. Elena agreed and will draft Figma prototype by Wednesday.
Budget approval for Q4 ad campaign is delayed until Friday pending finance review (David to follow up with CFO).
Next release moved to Oct 12 to allow 3 extra QA days. Jessica to notify beta testers.`,
  },
  {
    id: "job-application",
    title: "Job Cover Note",
    category: "Application",
    action: "improve",
    tone: "confident",
    format: "cover_letter",
    customInstruction: "Highlight relevant engineering leadership and proactive mindset",
    text: `I saw your opening for Senior Frontend Engineer and I think I'd be a great fit. I have 5 years doing React and TypeScript. In my last role I sped up load times by 40% and mentored 3 junior devs. I really like your product and would love to chat.`,
  },
  {
    id: "social-caption",
    title: "Product Launch Post",
    category: "Social Media",
    action: "generate",
    tone: "persuasive",
    format: "caption",
    customInstruction: "Include catchy hook, benefits, call to action, and 3-4 clean hashtags",
    text: `We just launched our new AI writing companion that cuts drafting time in half for busy professionals.`,
  },
  {
    id: "customer-service",
    title: "Customer Support Resolution",
    category: "Support",
    action: "tone",
    tone: "empathetic",
    format: "email",
    customInstruction: "Acknowledge frustration, provide tracking update, and offer $15 coupon credit",
    text: `Sorry your package arrived late. Carrier had bad weather delays. It will arrive tomorrow morning. Here is 10% off your next order.`,
  },
];

export const TOOL_ACTION_CONFIG = [
  {
    id: "rewrite",
    label: "Rewrite",
    description: "Rephrase with natural flow, enhanced clarity, and engaging style",
    icon: "RefreshCw",
  },
  {
    id: "improve",
    label: "Improve Grammar & Polish",
    description: "Fix typos, grammar, punctuation, and elevate writing quality",
    icon: "Sparkles",
  },
  {
    id: "summarize",
    label: "Summarize",
    description: "Extract key takeaways, TL;DR, and core essence",
    icon: "AlignLeft",
  },
  {
    id: "shorten",
    label: "Shorten",
    description: "Trim fluff and make text punchy, direct, and concise",
    icon: "Minimize2",
  },
  {
    id: "expand",
    label: "Expand",
    description: "Elaborate with context, details, and smooth transitions",
    icon: "Maximize2",
  },
  {
    id: "bulletize",
    label: "Bullet Points",
    description: "Convert text into clean, structured, readable bullet points",
    icon: "ListOrdered",
  },
  {
    id: "generate",
    label: "Generate",
    description: "Draft fresh text from a prompt, key bullet list, or topic",
    icon: "PenTool",
  },
] as const;

export const TONE_CONFIG = [
  { id: "professional", label: "Professional", desc: "Crisp, business-ready, polished" },
  { id: "friendly", label: "Friendly", desc: "Warm, conversational, welcoming" },
  { id: "concise", label: "Direct & Concise", desc: "Straight to the point, zero fluff" },
  { id: "persuasive", label: "Persuasive", desc: "Compelling, action-oriented, engaging" },
  { id: "confident", label: "Confident", desc: "Authoritative, clear, decisive" },
  { id: "empathetic", label: "Empathetic", desc: "Understanding, supportive, considerate" },
  { id: "casual", label: "Casual", desc: "Relaxed, authentic, low-pressure" },
  { id: "academic", label: "Academic", desc: "Formal, structured, objective" },
  { id: "witty", label: "Witty & Creative", desc: "Playful, clever, charismatic" },
] as const;

export const FORMAT_CONFIG = [
  { id: "general", label: "General Text" },
  { id: "email", label: "Email Message" },
  { id: "message", label: "Chat / Slack / SMS" },
  { id: "caption", label: "Social Post / Caption" },
  { id: "cover_letter", label: "Application / Cover Note" },
  { id: "bullets", label: "Bullet Points" },
  { id: "formal_letter", label: "Formal Document" },
] as const;
