// src/templates/loader.test.ts

import { describe, it, expect } from 'bun:test';
import { render } from './render';

describe('render', () => {
  it('should replace simple variables', () => {
    const template = 'Hello {{name}}!';
    const data = { name: 'World' };
    expect(render(template, data)).toBe('Hello World!');
  });

  it('should handle nested properties', () => {
    const template = '{{user.name}} is {{user.age}} years old';
    const data = { user: { name: 'Alice', age: 30 } };
    expect(render(template, data)).toBe('Alice is 30 years old');
  });

  it('should return empty string for undefined values', () => {
    const template = 'Value: {{missing}}';
    const data = {};
    expect(render(template, data)).toBe('Value: ');
  });

  it('should join arrays with newlines', () => {
    const template = 'Items:\n{{items}}';
    const data = { items: ['a', 'b', 'c'] };
    expect(render(template, data)).toBe('Items:\na\nb\nc');
  });

  it('should handle multiple occurrences', () => {
    const template = '{{greeting}} {{name}}! {{greeting}} again!';
    const data = { greeting: 'Hi', name: 'Bob' };
    expect(render(template, data)).toBe('Hi Bob! Hi again!');
  });
});
