import { shortWaitingName } from './display.types';

describe('shortWaitingName', () => {
  it('uses the first name and the surname initial', () => {
    expect(shortWaitingName({ firstName: 'Ada', surname: 'Obi' })).toBe('Ada O.');
  });

  it('falls back when the name is missing', () => {
    expect(shortWaitingName({ firstName: '  ', surname: null })).toBe('Patient');
  });
});
