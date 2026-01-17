/**
 * BritePulse Feedback Widget
 * Intercom-style feedback button and modal
 */

import { useState, useCallback } from 'preact/hooks';
import type { FeedbackData, BritePulseConfig } from '../types.js';
import { styles } from './styles.js';

interface WidgetProps {
  config: BritePulseConfig;
  onSubmit: (feedback: FeedbackData) => Promise<boolean>;
}

type Category = 'bug' | 'feature' | 'feedback';

export function Widget({ config, onSubmit }: WidgetProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [category, setCategory] = useState<Category>('bug');
  const [description, setDescription] = useState('');
  const [steps, setSteps] = useState('');
  const [allowContact, setAllowContact] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [isButtonHovered, setIsButtonHovered] = useState(false);

  const position = config.widgetPosition || 'bottom-right';
  const buttonText = config.widgetButtonText || 'Feedback';

  const handleSubmit = useCallback(async () => {
    if (!description.trim()) return;

    setIsSubmitting(true);

    const feedback: FeedbackData = {
      category,
      description: description.trim(),
      reproductionSteps: steps.trim() || undefined,
      allowContact,
    };

    const success = await onSubmit(feedback);

    setIsSubmitting(false);

    if (success) {
      setIsSuccess(true);
      // Reset form after delay
      setTimeout(() => {
        setIsOpen(false);
        setIsSuccess(false);
        setDescription('');
        setSteps('');
        setAllowContact(false);
        setCategory('bug');
      }, 2000);
    }
  }, [category, description, steps, allowContact, onSubmit]);

  const handleClose = useCallback(() => {
    setIsOpen(false);
    setIsSuccess(false);
  }, []);

  const positionStyle =
    position === 'bottom-right'
      ? styles['position-bottom-right']
      : position === 'bottom-left'
        ? styles['position-bottom-left']
        : position === 'top-right'
          ? styles['position-top-right']
          : styles['position-top-left'];

  const isLeftSide = position.includes('left');

  return (
    <div style={{ ...styles.container, ...positionStyle }}>
      {/* Floating Button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          onMouseEnter={() => setIsButtonHovered(true)}
          onMouseLeave={() => setIsButtonHovered(false)}
          style={{
            ...styles.button,
            ...(isButtonHovered ? styles.buttonHover : {}),
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
            <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H6l-2 2V4h16v12z" />
          </svg>
          {buttonText}
        </button>
      )}

      {/* Modal */}
      {isOpen && (
        <div
          style={{
            ...styles.modal,
            ...(isLeftSide ? styles['modal-left'] : {}),
          }}
        >
          {/* Header */}
          <div style={{ ...styles.header, position: 'relative' }}>
            <h3 style={styles.headerTitle}>Send Feedback</h3>
            <button onClick={handleClose} style={styles.headerClose}>
              ×
            </button>
          </div>

          {/* Body */}
          <div style={styles.body}>
            {isSuccess ? (
              <div style={styles.successMessage}>
                <div style={styles.successIcon}>✓</div>
                <p style={styles.successText}>Thank you!</p>
                <p style={styles.successSubtext}>Your feedback has been submitted.</p>
              </div>
            ) : (
              <>
                {/* Category Selection */}
                <div style={styles.categoryButtons}>
                  {(['bug', 'feature', 'feedback'] as Category[]).map((cat) => (
                    <button
                      key={cat}
                      onClick={() => setCategory(cat)}
                      style={{
                        ...styles.categoryButton,
                        ...(category === cat ? styles.categoryButtonActive : {}),
                      }}
                    >
                      {cat === 'bug' ? '🐛 Bug' : cat === 'feature' ? '✨ Feature' : '💬 Feedback'}
                    </button>
                  ))}
                </div>

                {/* Description */}
                <textarea
                  value={description}
                  onInput={(e) => setDescription((e.target as HTMLTextAreaElement).value)}
                  placeholder={
                    category === 'bug'
                      ? "What's the issue?"
                      : category === 'feature'
                        ? "What feature would you like?"
                        : "What's on your mind?"
                  }
                  style={styles.textarea}
                />

                {/* Steps (for bugs) */}
                {category === 'bug' && (
                  <textarea
                    value={steps}
                    onInput={(e) => setSteps((e.target as HTMLTextAreaElement).value)}
                    placeholder="Steps to reproduce (optional)"
                    style={{ ...styles.textarea, minHeight: '60px' }}
                  />
                )}

                {/* Allow Contact */}
                <label style={styles.checkbox}>
                  <input
                    type="checkbox"
                    checked={allowContact}
                    onChange={(e) => setAllowContact((e.target as HTMLInputElement).checked)}
                  />
                  You can contact me about this
                </label>

                {/* Submit */}
                <button
                  onClick={handleSubmit}
                  disabled={!description.trim() || isSubmitting}
                  style={{
                    ...styles.submitButton,
                    ...(!description.trim() || isSubmitting ? styles.submitButtonDisabled : {}),
                  }}
                >
                  {isSubmitting ? 'Sending...' : 'Send Feedback'}
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
