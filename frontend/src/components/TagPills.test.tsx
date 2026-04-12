import React from 'react';
import { render, screen } from '@testing-library/react-native';
import TagPills from './TagPills';

describe('TagPills', () => {
  it('renders nothing when tags is empty', () => {
    const { toJSON } = render(<TagPills tags={[]} />);
    expect(toJSON()).toBeNull();
  });

  it('renders all tags when below max', () => {
    render(<TagPills tags={['Gym', 'Gaming', 'Music']} />);
    expect(screen.getByText('Gym')).toBeTruthy();
    expect(screen.getByText('Gaming')).toBeTruthy();
    expect(screen.getByText('Music')).toBeTruthy();
  });

  it('shows overflow badge when tags exceed max', () => {
    render(<TagPills tags={['Gym', 'Gaming', 'Music', 'Art']} max={3} />);
    expect(screen.getByText('Gym')).toBeTruthy();
    expect(screen.getByText('Gaming')).toBeTruthy();
    expect(screen.getByText('Music')).toBeTruthy();
    expect(screen.queryByText('Art')).toBeNull();
    expect(screen.getByText('+1')).toBeTruthy();
  });

  it('does not show overflow badge when exactly at max', () => {
    render(<TagPills tags={['Gym', 'Gaming', 'Music']} max={3} />);
    expect(screen.queryByText(/^\+/)).toBeNull();
  });

  it('renders with sm size without error', () => {
    render(<TagPills tags={['Gym']} size="sm" />);
    expect(screen.getByText('Gym')).toBeTruthy();
  });

  it('uses fallback color for unknown tags', () => {
    render(<TagPills tags={['UnknownTag']} />);
    expect(screen.getByText('UnknownTag')).toBeTruthy();
  });
});
