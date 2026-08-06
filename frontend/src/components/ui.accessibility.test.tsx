import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { ThemeProvider } from '../theme';
import { Button, Chip, CountBubble, Field, ProgressBar } from './ui';

jest.mock('../dev/previewMode', () => ({
  getUiPreviewTheme: () => 'light',
}));

function renderWithTheme(children: React.ReactNode) {
  return render(<ThemeProvider>{children}</ThemeProvider>);
}

describe('shared UI accessibility contracts', () => {
  it('keeps a loading button exposed with busy and disabled state', () => {
    renderWithTheme(<Button label="Save changes" onPress={jest.fn()} loading />);

    const button = screen.getByRole('button', { name: 'Save changes' });
    expect(button.props.accessibilityState).toMatchObject({ busy: true, disabled: true });
    expect(screen.getByText('Save changes').props.maxFontSizeMultiplier).toBe(2);
  });

  it('derives an input name and announces validation details', () => {
    renderWithTheme(
      <Field
        label="Email address"
        placeholder="name.#@osu.edu"
        error="Enter an eligible OSU email"
      />,
    );

    const input = screen.getByLabelText('Email address');
    expect(input.props.accessibilityHint).toBe('Enter an eligible OSU email');
    expect(screen.getByRole('alert').props.accessibilityLiveRegion).toBe('polite');
  });

  it('hides the count badge from assistive technology so it is never a bare number', () => {
    // The badge always sits inside a container that collapses into one
    // accessibility element. Announcing it here would read as a contextless
    // "3", so callers must fold the count into the container's label instead.
    const badge = renderWithTheme(<CountBubble count={3} />).toJSON() as {
      props: Record<string, unknown>;
    };

    // The default queries omit it precisely because it is hidden from the
    // accessibility tree, which is the behaviour under test.
    expect(screen.queryByText('3')).toBeNull();

    expect(badge.props.accessibilityElementsHidden).toBe(true);
    expect(badge.props.importantForAccessibility).toBe('no-hide-descendants');
  });

  it('lets the count badge scale to the full 200% Dynamic Type range', () => {
    renderWithTheme(<CountBubble count={7} />);

    expect(
      screen.getByText('7', { includeHiddenElements: true }).props.maxFontSizeMultiplier,
    ).toBe(2);
  });

  it('lets a chip carry an accessible name that differs from its visible label', () => {
    renderWithTheme(
      <Chip label="General" accessibilityLabel="General, 4 unread messages" onPress={jest.fn()} />,
    );

    expect(screen.getByRole('button', { name: 'General, 4 unread messages' })).toBeTruthy();
    expect(screen.getByText('General')).toBeTruthy();
  });

  it('exposes progress as a bounded percentage', () => {
    renderWithTheme(<ProgressBar value={0.63} />);

    expect(screen.getByLabelText('Progress').props.accessibilityValue).toEqual({
      min: 0,
      max: 100,
      now: 63,
      text: '63 percent',
    });
  });
});
