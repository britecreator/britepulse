/**
 * Widget Module
 * Mounts the feedback widget to the DOM
 */

import { render } from 'preact';
import { jsx } from 'preact/jsx-runtime';
import { Widget } from './Widget.js';
import type { BritePulseConfig, FeedbackData } from '../types.js';

let widgetContainer: HTMLElement | null = null;
let unmountWidget: (() => void) | null = null;

/**
 * Mount the feedback widget
 */
export function mountWidget(
  config: BritePulseConfig,
  onSubmit: (feedback: FeedbackData) => Promise<boolean>
): void {
  if (typeof document === 'undefined') return;
  if (!config.enableWidget) return;
  if (widgetContainer) return; // Already mounted

  // Create container
  widgetContainer = document.createElement('div');
  widgetContainer.id = 'britepulse-widget';
  document.body.appendChild(widgetContainer);

  // Render widget
  render(jsx(Widget, { config, onSubmit }), widgetContainer);

  unmountWidget = () => {
    if (widgetContainer) {
      render(null, widgetContainer);
      widgetContainer.remove();
      widgetContainer = null;
    }
  };

  if (config.debug) {
    console.log('[BritePulse] Widget mounted');
  }
}

/**
 * Unmount the feedback widget
 */
export function destroyWidget(): void {
  if (unmountWidget) {
    unmountWidget();
    unmountWidget = null;
  }
}

/**
 * Check if widget is mounted
 */
export function isWidgetMounted(): boolean {
  return widgetContainer !== null;
}
