import type {AppiumWincoreDriver} from '../driver';

const ISO_8061_FORMAT = 'yyyy-MM-ddTHH:mm:sszzz';

/**
 * moment.js tokens and their .NET custom date/time equivalents, longest first so that the
 * tokenizer always takes the longest match (`YYYY` before `YY`, `SSS` before `S`).
 */
const MOMENT_TO_DOTNET_TOKENS: [string, string][] = [
  ['YYYY', 'yyyy'],
  ['MMMM', 'MMMM'],
  ['dddd', 'dddd'],
  ['SSS', 'fff'],
  // .NET has no offset specifier without the colon, so `ZZ` (+0700) also yields `+07:00`
  ['ZZ', 'zzz'],
  ['MMM', 'MMM'],
  ['ddd', 'ddd'],
  ['YY', 'yy'],
  ['MM', 'MM'],
  ['DD', 'dd'],
  ['HH', 'HH'],
  ['hh', 'hh'],
  ['mm', 'mm'],
  ['ss', 'ss'],
  ['SS', 'ff'],
  ['M', '%M'],
  ['D', '%d'],
  ['H', '%H'],
  ['h', '%h'],
  ['m', '%m'],
  ['s', '%s'],
  ['S', '%f'],
  ['A', 'tt'],
  ['Z', 'zzz'],
];

/**
 * Translates a moment.js format string (the notation Appium clients document for
 * `getDeviceTime`) into a .NET custom date/time format string. Used by `windows: getDeviceTime`
 * when called with `formatSyntax: 'moment'`.
 *
 * Supported tokens: `YYYY YY MMMM MMM MM M DD D dddd ddd HH H hh h mm m ss s SSS SS S A Z ZZ`
 * (`ZZ` is written with a colon, as `Z`).
 * Text in square brackets (`[at]`) and every other character are kept literally. Single-letter
 * tokens are emitted with the .NET `%` prefix so they are never read as a standard format.
 * @param format - A moment.js format string.
 * @returns The equivalent .NET custom format string.
 */
export function momentToDotNetFormat(format: string): string {
  let result = '';
  let literal = '';
  const flushLiteral = () => {
    if (literal) {
      // .NET quoted literal: a single quote inside is written as \'
      result += `'${literal.replace(/'/g, "'\\''")}'`;
      literal = '';
    }
  };
  let i = 0;
  while (i < format.length) {
    if (format[i] === '[') {
      const end = format.indexOf(']', i + 1);
      if (end !== -1) {
        literal += format.slice(i + 1, end);
        i = end + 1;
        continue;
      }
    }
    const match = MOMENT_TO_DOTNET_TOKENS.find(([token]) => format.startsWith(token, i));
    if (match) {
      flushLiteral();
      const [token, dotnet] = match;
      // `%` is only meaningful when the token is the whole format string
      result += dotnet.startsWith('%') && format.length !== token.length ? dotnet.slice(1) : dotnet;
      i += token.length;
      continue;
    }
    literal += format[i];
    i++;
  }
  flushLiteral();
  return result;
}

/**
 * Gets the current date/time on the machine running the session, formatted via the C# server.
 * @param _sessionId - Unused; present to match the WebDriver command signature.
 * @param format - A .NET custom date/time format string; defaults to an ISO 8601 format.
 * @returns The formatted date/time string.
 */
export async function getDeviceTime(this: AppiumWincoreDriver, _sessionId?: string, format?: string): Promise<string> {
  const fmt = format ?? ISO_8061_FORMAT;
  // Use the C# server to get formatted date/time
  const script = `(Get-Date).ToString('${fmt.replace(/'/g, "''")}')`;
  return (await this.sendCommand('executePowerShellScript', {script})) as string;
}
