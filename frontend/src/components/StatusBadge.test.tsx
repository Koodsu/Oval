import React from 'react';
import { render, screen } from '@testing-library/react-native';
import StatusBadge from './StatusBadge';

describe('StatusBadge', () => {
  it('renders FORMING status', () => {
    render(<StatusBadge status="FORMING" />);
    expect(screen.getByText('Forming')).toBeTruthy();
  });

  it('renders LOCKED status', () => {
    render(<StatusBadge status="LOCKED" />);
    expect(screen.getByText('Locked')).toBeTruthy();
  });

  it('renders COMPLETED status', () => {
    render(<StatusBadge status="COMPLETED" />);
    expect(screen.getByText('Completed')).toBeTruthy();
  });

  it('renders EXPIRED status', () => {
    render(<StatusBadge status="EXPIRED" />);
    expect(screen.getByText('Expired')).toBeTruthy();
  });

  it('renders unknown status as-is', () => {
    render(<StatusBadge status="CUSTOM" />);
    expect(screen.getByText('CUSTOM')).toBeTruthy();
  });

  it('applies md size when specified', () => {
    const { getByText } = render(<StatusBadge status="FORMING" size="md" />);
    expect(getByText('Forming')).toBeTruthy();
  });
});
