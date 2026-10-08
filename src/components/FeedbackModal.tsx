import React, { useState, useEffect } from "react";
import { X, Star, Heart, Send, CheckCircle2, MessageSquareHeart } from "lucide-react";

interface FeedbackModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmitSuccess?: (message: string) => void;
}

export const FeedbackModal: React.FC<FeedbackModalProps> = ({
  isOpen,
  onClose,
  onSubmitSuccess,
}) => {
  const [rating, setRating] = useState<number>(5);
  const [hoverRating, setHoverRating] = useState<number>(0);
  const [feedbackText, setFeedbackText] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  // Reset state when opening
  useEffect(() => {
    if (isOpen) {
      setSubmitted(false);
      setFeedbackText("");
      setRating(5);
      setHoverRating(0);
    }
  }, [isOpen]);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      // Send to server feedback endpoint
      await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rating,
          feedback: feedbackText.trim(),
          timestamp: new Date().toISOString(),
          userAgent: navigator.userAgent,
        }),
      }).catch((err) => {
        console.warn("Feedback network note:", err);
      });

      // Save locally to localStorage history
      try {
        const savedFeedback = JSON.parse(
          localStorage.getItem("lexisai_user_feedback") || "[]"
        );
        savedFeedback.push({
          rating,
          feedback: feedbackText.trim(),
          date: new Date().toISOString(),
        });
        localStorage.setItem(
          "lexisai_user_feedback",
          JSON.stringify(savedFeedback.slice(-20))
        );
      } catch (storageErr) {
        console.warn("LocalStorage feedback note:", storageErr);
      }

      setSubmitted(true);
      if (onSubmitSuccess) {
        onSubmitSuccess("Thank you for your feedback! ❤️");
      }

      // Auto close after brief delay
      setTimeout(() => {
        onClose();
      }, 1600);
    } catch (err) {
      console.error("Error submitting feedback:", err);
      setSubmitted(true);
      setTimeout(() => {
        onClose();
      }, 1600);
    } finally {
      setIsSubmitting(false);
    }
  };

  const starLabels: Record<number, string> = {
    1: "Needs Improvement",
    2: "Fair",
    3: "Good",
    4: "Great",
    5: "Loved it! Excellent",
  };

  const currentDisplayRating = hoverRating || rating;

  return (
    <div
      id="feedback-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        id="feedback-modal-content"
        className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col transition-all"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800/80 bg-slate-950/40">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-pink-500/10 border border-pink-500/20 flex items-center justify-center text-pink-400">
              <Heart className="w-4 h-4 fill-pink-500 text-pink-500" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white leading-tight">
                Give Feedback
              </h2>
              <p className="text-xs text-slate-400">
                Help us improve your LexisAi experience
              </p>
            </div>
          </div>
          <button
            id="close-feedback-btn"
            type="button"
            onClick={onClose}
            className="p-2 min-h-[44px] min-w-[44px] flex items-center justify-center text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 cursor-pointer active:scale-95 transition-colors"
            aria-label="Close Feedback Modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        {submitted ? (
          <div className="p-8 text-center flex flex-col items-center justify-center gap-3 animate-in zoom-in-95 duration-200">
            <div className="w-14 h-14 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 mb-1">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-bold text-white">
              Thank You for Your Feedback!
            </h3>
            <p className="text-sm text-slate-300 max-w-xs">
              Your feedback helps us continuously refine and improve LexisAi for everyone. ❤️
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-5 flex flex-col gap-4">
            {/* Rating Stars Section */}
            <div className="flex flex-col items-center gap-2 py-2">
              <label className="text-xs font-semibold text-slate-300 tracking-wide uppercase">
                Rate your experience
              </label>
              
              <div className="flex items-center gap-1.5 sm:gap-2">
                {[1, 2, 3, 4, 5].map((starValue) => {
                  const isFilled = starValue <= currentDisplayRating;
                  return (
                    <button
                      key={starValue}
                      id={`feedback-star-${starValue}`}
                      type="button"
                      onClick={() => setRating(starValue)}
                      onMouseEnter={() => setHoverRating(starValue)}
                      onMouseLeave={() => setHoverRating(0)}
                      className="p-2 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-slate-600 hover:scale-110 active:scale-95 transition-all cursor-pointer focus:outline-hidden"
                      aria-label={`${starValue} star${starValue > 1 ? "s" : ""}`}
                    >
                      <Star
                        className={`w-7 h-7 sm:w-8 sm:h-8 transition-colors ${
                          isFilled
                            ? "text-amber-400 fill-amber-400 drop-shadow-[0_0_8px_rgba(251,191,36,0.4)]"
                            : "text-slate-700 hover:text-slate-500"
                        }`}
                      />
                    </button>
                  );
                })}
              </div>

              <span className="text-xs font-medium text-amber-400/90 h-4">
                {starLabels[currentDisplayRating] || ""}
              </span>
            </div>

            {/* Feedback Text Input Area */}
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="feedback-textarea"
                className="text-xs font-medium text-slate-300 flex items-center justify-between"
              >
                <span>Your comments & suggestions</span>
                <span className="text-[11px] text-slate-500">Optional</span>
              </label>
              <textarea
                id="feedback-textarea"
                value={feedbackText}
                onChange={(e) => setFeedbackText(e.target.value)}
                placeholder="Tell us what you think about LexisAi…"
                rows={4}
                className="w-full px-3.5 py-3 rounded-xl bg-slate-950/80 border border-slate-800 text-slate-100 placeholder:text-slate-500 text-sm focus:outline-hidden focus:border-blue-500 focus:ring-1 focus:ring-blue-500 resize-none transition-colors"
                autoFocus={false}
              />
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-800/60">
              <button
                id="cancel-feedback-btn"
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="px-4 py-2.5 min-h-[44px] text-xs font-semibold text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors cursor-pointer active:scale-95"
              >
                Cancel
              </button>
              <button
                id="send-feedback-btn"
                type="submit"
                disabled={isSubmitting}
                className="inline-flex items-center justify-center gap-2 px-5 py-2.5 min-h-[44px] rounded-xl text-xs font-bold text-white bg-blue-600 hover:bg-blue-500 active:scale-95 transition-all shadow-md shadow-blue-900/30 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Sending…</span>
                  </>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5" />
                    <span>Send Feedback</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
