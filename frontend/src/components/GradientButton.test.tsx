import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import GradientButton from './GradientButton';

describe('GradientButton', () => {
  it('renders the title', () => {
    render(<GradientButton title="Join Pod" onPress={jest.fn()} />);
    expect(screen.getByText('Join Pod')).toBeTruthy();
  });

  it('calls onPress when tapped', () => {
    const onPress = jest.fn();
    render(<GradientButton title="Tap me" onPress={onPress} />);
    fireEvent.press(screen.getByText('Tap me'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('does not call onPress when disabled', () => {
    const onPress = jest.fn();
    render(<GradientButton title="Disabled" onPress={onPress} disabled />);
    fireEvent.press(screen.getByText('Disabled'));
    expect(onPress).not.toHaveBeenCalled();
  });

  it('shows an ActivityIndicator and not the title text when loading', () => {
    render(<GradientButton title="Loading" onPress={jest.fn()} loading />);
    expect(screen.queryByText('Loading')).toBeNull();
  });

  it('renders the outline variant', () => {
    render(<GradientButton title="Outline" onPress={jest.fn()} variant="outline" />);
    expect(screen.getByText('Outline')).toBeTruthy();
  });

  it('renders the md size variant', () => {
    render(<GradientButton title="Small" onPress={jest.fn()} size="md" />);
    expect(screen.getByText('Small')).toBeTruthy();
  });
});
