import { describe, expect, it } from 'vitest';
import { formStory, type Form } from './form';

const form = (process: number | null, outcome: number) => ({ process, outcome }) as Form;

describe('formStory', () => {
  it('speaks only when the two halves are a point or more apart', () => {
    expect(formStory(form(7.3, 6.5))).toBeNull();
    expect(formStory(form(6.2, 5.1))?.better).toBe(true);
    expect(formStory(form(7.8, 9.9))?.better).toBe(false);
  });

  it('says nothing on a round with no tags', () => {
    expect(formStory(form(null, 3))).toBeNull();
  });
});
