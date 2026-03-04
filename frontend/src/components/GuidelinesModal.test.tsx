import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import GuidelinesModal from './GuidelinesModal';

describe('GuidelinesModal', () => {
  it('renders all guideline headings when visible', () => {
    render(<GuidelinesModal visible onAccept={jest.fn()} onClose={jest.fn()} />);
    expect(screen.getByText('Community Guidelines')).toBeTruthy();
    expect(screen.getByText('Be respectful')).toBeTruthy();
    expect(screen.getByText('Show up')).toBeTruthy();
    expect(screen.getByText('Keep it safe')).toBeTruthy();
    expect(screen.getByText('Stay on topic')).toBeTruthy();
    expect(screen.getByText('Report issues')).toBeTruthy();
    expect(screen.getByText('I Agree & Continue')).toBeTruthy();
  });

  it('does not render when not visible', () => {
    render(<GuidelinesModal visible={false} onAccept={jest.fn()} onClose={jest.fn()} />);
    expect(screen.queryByText('Community Guidelines')).toBeNull();
  });

  it('calls onAccept when agree button is pressed', () => {
    const onAccept = jest.fn();
    render(<GuidelinesModal visible onAccept={onAccept} onClose={jest.fn()} />);
    fireEvent.press(screen.getByText('I Agree & Continue'));
    expect(onAccept).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when dismiss button is pressed', () => {
    const onClose = jest.fn();
    render(<GuidelinesModal visible onAccept={jest.fn()} onClose={onClose} />);
    fireEvent.press(screen.getByLabelText('Dismiss'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
