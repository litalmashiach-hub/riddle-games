import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { APP_NAME, WEBSITE_NAME } from './appInfo';
import { NAME_TOKEN, nameForMode, pageNameProblems, withShownName } from './pageName';

const SOURCE = readFileSync(join(__dirname, '..', '..', 'index.html'), 'utf8');
const built = (mode: string) => withShownName(SOURCE, nameForMode(mode));

describe('the name in index.html: page title and spoken loading label', () => {
  it('the source page writes the token in both places, and the name nowhere', () => {
    expect(SOURCE).toContain(`<title>${NAME_TOKEN}</title>`);
    expect(SOURCE).toContain(`aria-label="Loading ${NAME_TOKEN}"`);
    expect(SOURCE).not.toContain(APP_NAME);
    expect(SOURCE).not.toContain(WEBSITE_NAME);
  });

  it('the app build: title and loading label say the working name, and the website name is gone', () => {
    const html = built('app');
    expect(html).toContain(`<title>${APP_NAME}</title>`);
    expect(html).toContain(`aria-label="Loading ${APP_NAME}"`);
    expect(html).not.toContain(WEBSITE_NAME);
    expect(pageNameProblems(html, 'app')).toEqual([]);
  });

  it('the website build keeps its own name, as before', () => {
    const html = built('production');
    expect(html).toContain('<title>Riddle Games</title>');
    expect(html).toContain('aria-label="Loading Riddle Games"');
    expect(html).not.toContain(APP_NAME);
    expect(pageNameProblems(html, 'production')).toEqual([]);
    expect(built('development')).toBe(html);
  });

  it('the build check catches a page that says the other name or lost its token', () => {
    expect(pageNameProblems(built('production'), 'app')).toHaveLength(3);
    expect(pageNameProblems(SOURCE.replace(`<title>${NAME_TOKEN}</title>`, `<title>${WEBSITE_NAME}</title>`).split(NAME_TOKEN).join(APP_NAME), 'app')).toEqual([
      expect.stringMatching(/page title/),
      expect.stringMatching(/website's name/),
    ]);
    expect(() => withShownName('<title>Riddle Games</title>', APP_NAME)).toThrow(/no %SHOWN_NAME%/);
  });

  it('a name with HTML characters is written safely', () => {
    expect(withShownName(`<title>${NAME_TOKEN}</title>`, 'Tom & "Jerry"')).toBe('<title>Tom &amp; &quot;Jerry&quot;</title>');
  });
});
