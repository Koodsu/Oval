import { getPodTitleValidationError } from './podTitleValidation';

describe('pod title validation', () => {
  it('allows course codes, acronyms, and descriptive titles', () => {
    for (const title of [
      'CSE 2221',
      'MATH 1151 study group',
      'BUSMHR 2292 review',
      'RPAC pickup basketball',
      'Euchre at Morrill Tower',
      'Pickleball',
      'Ashwaganda supplements',
      'Ashwagandha discussion',
      'Availability',
      'Aboveboard',
      'Birthplace',
      'Postscript',
      'Backstroke',
      'Matchstick',
      'Swashbuckle',
      'Kalashnikov history discussion',
      'Oxybenzaldehyde study session',
      'Twelvefold',
    ]) {
      expect(getPodTitleValidationError(title)).toBeNull();
    }
  });

  it('rejects likely keyboard mash', () => {
    for (const title of ['asfoiashdoi', 'AFOISUDOIAS', 'qwertyuiop', 'bcdfghjklm']) {
      expect(getPodTitleValidationError(title)).toContain('random letters');
    }
  });

  it('requires a title', () => {
    expect(getPodTitleValidationError('   ')).toContain('specific title');
  });
});
