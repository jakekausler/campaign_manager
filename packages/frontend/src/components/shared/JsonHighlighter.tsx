/**
 * JsonHighlighter component for syntax-highlighted JSON display
 *
 * A lightweight custom JSON syntax highlighter with zero external dependencies.
 * Provides color-coded highlighting for JSON tokens with built-in dark mode support
 * and WCAG 2.1 Level AA color contrast compliance.
 */

import { memo, useMemo } from 'react';

export interface JsonHighlighterProps {
  /**
   * The JSON string to highlight
   */
  json: string;

  /**
   * CSS class name for container
   */
  className?: string;

  /**
   * Enable dark mode colors (default: false)
   */
  darkMode?: boolean;
}

/**
 * Token types for JSON syntax
 */
type TokenType = 'key' | 'string' | 'number' | 'boolean' | 'null' | 'punctuation' | 'whitespace';

interface Token {
  type: TokenType;
  value: string;
}

/**
 * Tokenize JSON string into classified tokens
 */
function tokenizeJson(json: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;

  // Track if we're in an object key context (after { or ,)
  let expectKey = false;
  let depth = 0;

  while (i < json.length) {
    const char = json[i];

    // Whitespace
    if (/\s/.test(char)) {
      let whitespace = '';
      while (i < json.length && /\s/.test(json[i])) {
        whitespace += json[i];
        i++;
      }
      tokens.push({ type: 'whitespace', value: whitespace });
      continue;
    }

    // String (key or value)
    if (char === '"') {
      let string = '"';
      i++;
      while (i < json.length) {
        if (json[i] === '\\' && i + 1 < json.length) {
          // Escaped character
          string += json[i] + json[i + 1];
          i += 2;
        } else if (json[i] === '"') {
          string += '"';
          i++;
          break;
        } else {
          string += json[i];
          i++;
        }
      }

      // Determine if this is a key or value
      // Keys come after { or , and before :
      const type = expectKey ? 'key' : 'string';
      tokens.push({ type, value: string });
      expectKey = false;
      continue;
    }

    // Number (including negative, decimal, scientific notation)
    if (/[-\d]/.test(char)) {
      let number = '';
      while (i < json.length && /[-\d.eE+]/.test(json[i])) {
        number += json[i];
        i++;
      }
      tokens.push({ type: 'number', value: number });
      continue;
    }

    // Boolean or null
    if (/[tfn]/.test(char)) {
      if (json.slice(i, i + 4) === 'true') {
        tokens.push({ type: 'boolean', value: 'true' });
        i += 4;
        continue;
      }
      if (json.slice(i, i + 5) === 'false') {
        tokens.push({ type: 'boolean', value: 'false' });
        i += 5;
        continue;
      }
      if (json.slice(i, i + 4) === 'null') {
        tokens.push({ type: 'null', value: 'null' });
        i += 4;
        continue;
      }
    }

    // Punctuation
    if (/[{}[\]:,]/.test(char)) {
      tokens.push({ type: 'punctuation', value: char });

      // Track context for key detection
      if (char === '{') {
        depth++;
        expectKey = true;
      } else if (char === '}') {
        depth--;
        expectKey = false;
      } else if (char === '[') {
        expectKey = false;
      } else if (char === ',') {
        // After comma in object, expect key
        expectKey = depth > 0;
      } else if (char === ':') {
        expectKey = false;
      }

      i++;
      continue;
    }

    // Unknown character (shouldn't happen with valid JSON)
    i++;
  }

  return tokens;
}

/**
 * Get Tailwind CSS classes for token type
 */
function getTokenClasses(type: TokenType): string {
  switch (type) {
    case 'key':
      // Dark blue for keys (high contrast)
      return 'json-key text-blue-700 dark:text-blue-300';
    case 'string':
      // Green for string values
      return 'json-string text-green-700 dark:text-green-300';
    case 'number':
      // Purple for numbers
      return 'json-number text-purple-700 dark:text-purple-300';
    case 'boolean':
      // Orange for booleans
      return 'json-boolean text-orange-700 dark:text-orange-300';
    case 'null':
      // Red for null
      return 'json-null text-red-700 dark:text-red-300';
    case 'punctuation':
      // Gray for punctuation
      return 'json-punctuation text-gray-600 dark:text-gray-400';
    case 'whitespace':
      return '';
    default:
      return '';
  }
}

/**
 * JsonHighlighter component
 *
 * Renders JSON with syntax highlighting using Tailwind CSS classes.
 * Colors are WCAG 2.1 Level AA compliant for accessibility.
 */
export const JsonHighlighter = memo(function JsonHighlighter({
  json,
  className = '',
  darkMode = false,
}: JsonHighlighterProps) {
  // Tokenize JSON
  const tokens = useMemo(() => tokenizeJson(json), [json]);

  return (
    <pre
      className={`whitespace-pre font-mono text-sm overflow-x-auto ${darkMode ? 'dark' : ''} ${className}`}
      data-testid="json-highlighter"
      aria-label="Syntax-highlighted JSON"
    >
      <code>
        {tokens.map((token, index) => {
          const classes = getTokenClasses(token.type);

          if (token.type === 'whitespace') {
            // Preserve whitespace without wrapping
            return <span key={index}>{token.value}</span>;
          }

          return (
            <span key={index} className={classes}>
              {token.value}
            </span>
          );
        })}
      </code>
    </pre>
  );
});
